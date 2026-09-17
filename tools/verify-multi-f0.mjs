import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { createChain } from "../vendor/effetune/dist/index.js";

const multiF0Source = await readFile(new URL("../multi-f0.js", import.meta.url), "utf8");
const { noteChain, observations } = await import(
  `data:text/javascript;base64,${Buffer.from(multiF0Source).toString("base64")}`,
);

const sr = 48000;
function createPcmWav(samples) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((x, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2));
  return wav;
}

const chord = Float32Array.from({ length: sr * 3 }, (_, i) =>
  [220, 329.6276, 440].reduce((sum, f) => sum + [1, 2, 3, 4].reduce(
    (v, h) => v + 0.07 / h * Math.sin(2 * Math.PI * f * h * i / sr), 0), 0));
const chain = await createChain(noteChain);
const detections = [];
await chain.process([chord], { sampleRate: sr, blockSize: 128, onTelemetry(frame) {
  detections.push(...observations(frame));
} });
chain.close();
assert(detections.some(x => x.confidence >= 0.5));
const groups = new Map();
for (const detection of detections) {
  if (detection.confidence < 0.5) continue;
  const group = groups.get(detection.timeSec) || [];
  group.push(detection);
  groups.set(detection.timeSec, group);
}
assert([...groups.values()].some(x => x.length >= 2), "simultaneous notes from real WASM");
assert(detections.every(x => Number.isFinite(x.volumeDb)));

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_NODE_MODULES
  ? createRequire(`${process.env.PLAYWRIGHT_NODE_MODULES.replace(/\\/g, "/")}/playwright/package.json`)("playwright")
  : require("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
try {
  for (const fallback of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, permissions: ["microphone"] });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    if (fallback) await page.addInitScript(() => { HTMLCanvasElement.prototype.transferControlToOffscreen = undefined; });
    await page.goto(process.argv[2] || "http://localhost:4173");
    assert.equal(await page.evaluate(() => state.renderer.useWorker), !fallback);
    const tone = Float32Array.from({ length: sr }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 440 * i / sr));
    await page.setInputFiles("#uploadInput", {
      name: "tone.wav", mimeType: "audio/wav", buffer: createPcmWav(tone),
    });
    await page.waitForFunction(() => !state.upload.active);
    assert(await page.evaluate(() => state.pitchSamples.some(sample =>
      sample.confidence > 0.5 && Math.abs(sample.frequency - 440) < 2)),
    await page.locator("#messageStatus").textContent());
    const monoHistory = await page.evaluate(() => state.pitchSamples.map(sample => ({
      timeSec: sample.timeSec,
      frequency: sample.frequency,
      confidence: sample.confidence,
      volumeDb: sample.volumeDb,
    })));
    await page.click("#multiModeBtn");
    await page.evaluate(() => { state.view.minMidi = 45; state.view.maxMidi = 84; });
    // A PCM WAV drives the complete decode -> dedicated worker -> history path.
    const wav = createPcmWav(chord);
    await page.setInputFiles("#uploadInput", { name: "chord.wav", mimeType: "audio/wav", buffer: wav });
    await page.waitForFunction(() => !state.upload.active);
    assert(await page.evaluate(() => state.pitchSamples.length > 0), await page.locator("#messageStatus").textContent());
    const count = await page.evaluate(() => state.pitchSamples.length);
    assert(await page.evaluate(() => state.pitchSamples.every(x => Number.isFinite(x.volumeDb))));
    assert.equal(await page.evaluate(() => getCurrentNoteLabel()), "");
    const thresholds = await page.evaluate(() => {
      const confidences = state.pitchSamples
        .filter(sample => Number.isFinite(sample.confidence) && sample.frequency > 0)
        .map(sample => sample.confidence);
      const maximum = Math.max(...confidences);
      const visibleThreshold = Math.max(0.05, Math.min(0.95, Math.floor(maximum * 100) / 100));
      const hiddenThreshold = Math.ceil(maximum * 100) / 100 + 0.01;
      return { visibleThreshold, hiddenThreshold };
    });
    const setThreshold = async (threshold) => {
      await page.evaluate((value) => {
        const input = document.getElementById("thresholdInput");
        input.max = String(Math.max(Number(input.max), value));
        input.value = String(value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, threshold);
      await page.waitForFunction(value => state.analysis.confidenceThreshold === value, threshold);
      await page.waitForTimeout(100);
    };
    await setThreshold(thresholds.visibleThreshold);
    assert(await page.evaluate(value => state.pitchSamples.some(sample => sample.confidence >= value), thresholds.visibleThreshold));
    const visibleTrace = await page.locator("#traceCanvas").screenshot();
    await setThreshold(thresholds.hiddenThreshold);
    assert(await page.evaluate(value => state.pitchSamples.every(sample => sample.confidence < value), thresholds.hiddenThreshold));
    const hiddenTrace = await page.locator("#traceCanvas").screenshot();
    assert.notDeepEqual(visibleTrace, hiddenTrace, "Multi F0 point rendering differs by confidence threshold");
    const downloadPromise = page.waitForEvent("download");
    await page.click("#exportBtn");
    const download = await downloadPromise;
    const csv = await readFile(await download.path(), "utf8");
    assert(csv.split("\n")[0].endsWith(",volume_db"));
    assert(csv.split("\n")[1].split(",").length === 9);
    await page.waitForTimeout(300);
    await mkdir("artifacts", { recursive: true });
    await page.screenshot({ path: `artifacts/multi-f0-${fallback ? "fallback" : "worker"}.png` });
    await page.click("#modeToggleBtn");
    assert.equal(await page.evaluate(() => state.pitchSamples.length), monoHistory.length);
    assert.deepEqual(await page.evaluate(() => state.pitchSamples.map(sample => ({
      timeSec: sample.timeSec,
      frequency: sample.frequency,
      confidence: sample.confidence,
      volumeDb: sample.volumeDb,
    }))), monoHistory);
    assert.deepEqual(await page.evaluate(() => [state.view.minMidi, state.view.maxMidi]), [45, 84]);
    await page.click("#multiModeBtn");
    assert.equal(await page.evaluate(() => state.pitchSamples.length), count);
    assert.deepEqual(await page.evaluate(() => [state.view.minMidi, state.view.maxMidi]), [45, 84]);
    assert.equal(await page.locator("#exportBtn").isEnabled(), true);
    // Cancellation must retain the last successful analysis, including volume.
    const cancelWav = Buffer.alloc(44 + chord.length * 10 * 2);
    wav.copy(cancelWav, 0, 0, 44);
    cancelWav.writeUInt32LE(cancelWav.length - 8, 4);
    cancelWav.writeUInt32LE(cancelWav.length - 44, 40);
    for (let offset = 44; offset < cancelWav.length; offset += chord.length * 2) {
      wav.copy(cancelWav, offset, 44);
    }
    await page.setInputFiles("#uploadInput", { name: "cancel.wav", mimeType: "audio/wav", buffer: cancelWav });
    await page.waitForFunction(() => typeof state.upload.token?.abort === "function"
      && document.getElementById("uploadProgressLabel").textContent === "Analyzing polyphonic audio");
    await page.evaluate(() => cancelUploadProcessing());
    await page.waitForFunction(() => !state.upload.active);
    assert.equal(await page.evaluate(() => state.pitchSamples.length), count);
    await page.evaluate(() => startMic());
    await page.waitForFunction(() => state.micState === "running" || state.micState === "error");
    assert.equal(await page.evaluate(() => state.micState), "running");
    assert(await page.evaluate(() => !!state.dspNode));
    await page.waitForFunction(() => state.latestTimeSec > 3.1);
    await page.click("#pauseBtn");
    assert.equal(await page.evaluate(() => state.micState), "paused");
    await page.click("#pauseBtn");
    assert.equal(await page.evaluate(() => state.micState), "running");
    const previousTime = await page.evaluate(() => state.latestTimeSec);
    await page.waitForFunction(time => state.latestTimeSec > time, previousTime);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `artifacts/multi-f0-mobile-${fallback}.png` });
    const clearedState = await page.evaluate(() => {
      clearHistory();
      return { sampleCount: state.pitchSamples.length, multiTimeOrigin: state.multiTimeOrigin };
    });
    assert.equal(clearedState.sampleCount, 0);
    assert.equal(clearedState.multiTimeOrigin, null);
    await page.evaluate(() => releaseCaptureResources());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.context().setOffline(true);
    await page.reload();
    assert.equal(await page.locator("#modeValue").textContent(), "Multi F0");
    assert(await page.evaluate(async () => {
      const { createChain } = await import("./vendor/effetune/dist/index.js");
      const { noteChain } = await import("./multi-f0.js");
      const chain = await createChain(noteChain);
      await chain.process([new Float32Array(4800)], { sampleRate: 48000 });
      chain.close();
      return true;
    }));
    await page.close();
  }
  console.log("verify-multi-f0 ok: real WASM, mono/poly uploads, cancellation, worklet, history, both renderers, mobile");
} finally { await browser.close(); }
