import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bundledNodeModules = process.env.PLAYWRIGHT_NODE_MODULES;
const { chromium } = bundledNodeModules
  ? createRequire(`${bundledNodeModules.replace(/\\/g, "/")}/playwright/package.json`)("playwright")
  : require("playwright");

const url = process.argv[2] || "http://localhost:4173";
const viewport = {
  width: Number(process.env.VERIFY_WIDTH || 1280),
  height: Number(process.env.VERIFY_HEIGHT || 800),
};
const verifyMic = process.env.VERIFY_MIC === "1";
const browser = await chromium.launch({
  headless: true,
  args: verifyMic
    ? ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
    : [],
});
const context = await browser.newContext({
  viewport,
  permissions: verifyMic ? ["microphone"] : [],
});
const page = await context.newPage();
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

try {
  await page.goto(url, { waitUntil: "load", timeout: 15000 });
  await page.waitForSelector("#backgroundCanvas", { timeout: 10000 });
  await page.waitForTimeout(250);

  const before = await readUiState(page);
  await page.click("#timeZoomInBtn");
  const afterTimeZoom = await readUiState(page);
  await page.click("#pitchZoomInBtn");
  const afterPitchZoom = await readUiState(page);
  const selectionCheck = await verifySelectionHint(page);
  let afterMicStart = null;

  if (verifyMic) {
    await page.click("#overlayStartBtn");
    await page.waitForFunction(() => {
      const message = document.getElementById("messageStatus");
      const pause = document.getElementById("pauseBtn");
      return message.classList.contains("error") || !pause.disabled;
    }, null, { timeout: 60000 });

    try {
      await page.waitForFunction(() => !document.getElementById("exportBtn").disabled, null, { timeout: 20000 });
    } catch (error) {
      // The fake device can be silent, but the analysis loop should still enable CSV after frames.
    }
    await page.waitForTimeout(500);
    afterMicStart = await readUiState(page);
  }

  await mkdir("artifacts", { recursive: true });
  const screenshot = `artifacts/browser-check-${viewport.width}x${viewport.height}.png`;
  if (!verifyMic) {
    await page.screenshot({ path: screenshot, fullPage: true });
  }

  const failures = [];
  if (before.title !== "Frieve F0 Estimator") {
    failures.push(`unexpected title: ${before.title}`);
  }
  if (!before.overlayVisible) {
    failures.push("start overlay is not visible on first load");
  }
  if (!before.isSecureContext) {
    failures.push("localhost is not a secure context");
  }
  if (before.canvasWidth <= 0 || before.canvasHeight <= 0) {
    failures.push("canvas has no drawable size");
  }
  if (before.canvasReadbackAvailable && before.nonBackgroundPixels < 20) {
    failures.push("background canvas appears blank");
  }
  if (!before.uploadButtonVisible) {
    failures.push("upload button is not visible");
  }
  if (Math.abs(before.uploadButtonWidth - before.exportButtonWidth) > 1) {
    failures.push(`upload button width ${before.uploadButtonWidth} did not match export button width ${before.exportButtonWidth}`);
  }
  if (!before.uploadOverlayHidden) {
    failures.push("upload overlay should be hidden on first load");
  }
  if (before.windowStatus === afterTimeZoom.windowStatus) {
    failures.push("time zoom button did not change the window status");
  }
  if (afterTimeZoom.rangeStatus === afterPitchZoom.rangeStatus) {
    failures.push("pitch zoom button did not change the range status");
  }
  if (!selectionCheck.ok) {
    failures.push(`selection hint failed: ${selectionCheck.reason}`);
  }
  if (verifyMic && afterMicStart) {
    if (afterMicStart.messageIsError) {
      failures.push(`mic start failed: ${afterMicStart.messageStatus}`);
    }
    if (!afterMicStart.pauseEnabled) {
      failures.push("pause button was not enabled after mic start");
    }
    if (!afterMicStart.overlayHidden) {
      failures.push("start overlay remained visible after mic start");
    }
  }
  if (consoleErrors.length > 0) {
    failures.push(`console errors: ${consoleErrors.join(" | ")}`);
  }

  const report = {
    ok: failures.length === 0,
    url,
    viewport,
    before,
    afterTimeZoom,
    afterPitchZoom,
    selectionCheck,
    afterMicStart,
    screenshot: verifyMic ? null : screenshot,
    failures,
  };

  console.log(JSON.stringify(report, null, 2));
  if (failures.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function verifySelectionHint(page) {
  return page.evaluate(async () => {
    if (
      typeof window.clearHistory !== "function"
      || typeof window.addPitchSample !== "function"
      || typeof window.getRightTime !== "function"
      || typeof window.timeToX !== "function"
      || typeof window.midiToY !== "function"
    ) {
      return { ok: false, reason: "pitch helpers are not exposed" };
    }

    const thresholdInput = document.getElementById("thresholdInput");
    thresholdInput.value = "0.50";
    thresholdInput.dispatchEvent(new Event("input", { bubbles: true }));
    window.clearHistory();

    const frequencyFromMidi = (midi) => 440 * (2 ** ((midi - 69) / 12));
    window.addPitchSample(0, frequencyFromMidi(60), 0.95);
    window.addPitchSample(0.5, frequencyFromMidi(64), 0.74);
    window.addPitchSample(1, frequencyFromMidi(67), 0.96);

    const canvasWrap = document.getElementById("canvasWrap");
    const rect = canvasWrap.getBoundingClientRect();
    const rightTime = window.getRightTime();
    const start = {
      x: window.timeToX(0, rightTime),
      y: window.midiToY(68),
    };
    const end = {
      x: window.timeToX(2, rightTime),
      y: window.midiToY(59),
    };
    const eventBase = {
      pointerId: 77,
      pointerType: "mouse",
      button: 0,
      buttons: 1,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    };
    canvasWrap.dispatchEvent(new PointerEvent("pointerdown", {
      ...eventBase,
      clientX: rect.left + start.x,
      clientY: rect.top + start.y,
    }));
    canvasWrap.dispatchEvent(new PointerEvent("pointermove", {
      ...eventBase,
      clientX: rect.left + end.x,
      clientY: rect.top + end.y,
    }));
    canvasWrap.dispatchEvent(new PointerEvent("pointerup", {
      ...eventBase,
      buttons: 0,
      clientX: rect.left + end.x,
      clientY: rect.top + end.y,
    }));

    const hint = document.getElementById("hoverHint");
    const html = hint.innerHTML;
    const ok = !hint.hidden
      && hint.classList.contains("selection-hint")
      && html.includes("Upper")
      && html.includes("Lower")
      && html.includes("MAD")
      && html.includes("G4")
      && html.includes("C4")
      && html.includes("n=2");
    return {
      ok,
      reason: ok ? "" : "selection table did not contain expected rows",
      hidden: hint.hidden,
      hasClass: hint.classList.contains("selection-hint"),
      html,
    };
  });
}

async function readUiState(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById("backgroundCanvas");
    const uploadBtn = document.getElementById("uploadBtn");
    const exportBtn = document.getElementById("exportBtn");
    const uploadRect = uploadBtn.getBoundingClientRect();
    const exportRect = exportBtn.getBoundingClientRect();
    let nonBackgroundPixels = 0;
    let canvasReadbackAvailable = true;

    try {
      const ctx = canvas.getContext("2d");
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < image.data.length; i += 400) {
        const r = image.data[i];
        const g = image.data[i + 1];
        const b = image.data[i + 2];
        const a = image.data[i + 3];
        if (a > 0 && !(r > 245 && g > 245 && b > 245)) {
          nonBackgroundPixels += 1;
        }
      }
    } catch (error) {
      canvasReadbackAvailable = false;
    }

    return {
      title: document.title,
      currentStatus: document.getElementById("currentStatus").textContent,
      rangeStatus: document.getElementById("rangeStatus").textContent,
      windowStatus: document.getElementById("windowStatus").textContent,
      messageStatus: document.getElementById("messageStatus").textContent,
      messageIsError: document.getElementById("messageStatus").classList.contains("error"),
      overlayVisible: !document.getElementById("startOverlay").hidden,
      overlayHidden: document.getElementById("startOverlay").hidden,
      uploadButtonVisible: uploadRect.width > 0 && uploadRect.height > 0,
      uploadButtonWidth: uploadRect.width,
      exportButtonWidth: exportRect.width,
      uploadOverlayHidden: document.getElementById("uploadOverlay").hidden,
      pauseEnabled: !document.getElementById("pauseBtn").disabled,
      exportEnabled: !document.getElementById("exportBtn").disabled,
      isSecureContext: window.isSecureContext,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      canvasReadbackAvailable,
      nonBackgroundPixels,
    };
  });
}
