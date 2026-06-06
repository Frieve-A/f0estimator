import { readFile } from "node:fs/promises";
import vm from "node:vm";

const eventHandlers = new Map();

function createClassList() {
  const classes = new Set();
  return {
    add: (name) => classes.add(name),
    remove: (name) => classes.delete(name),
    contains: (name) => classes.has(name),
    toggle: (name, force) => {
      const enabled = force === undefined ? !classes.has(name) : Boolean(force);
      if (enabled) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      return enabled;
    },
  };
}

function createElement(id) {
  const attrs = new Map();
  const element = {
    id,
    clientHeight: id === "pitchScrollbar" ? 420 : 0,
    disabled: false,
    hidden: false,
    innerHTML: "",
    style: {},
    textContent: "",
    title: "",
    value: "",
    classList: createClassList(),
    addEventListener(type, handler) {
      eventHandlers.set(`${id}:${type}`, handler);
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
    closest() {
      return null;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      if (id === "canvasWrap") {
        return { left: 0, top: 0, right: 800, width: 800, height: 420 };
      }
      if (id === "pitchScrollbar") {
        return { left: 780, top: 8, right: 794, width: 14, height: 404 };
      }
      if (id === "pitchScrollbarThumb") {
        return { left: 782, top: 8, right: 792, width: 10, height: 80 };
      }
      if (id === "hoverHint") {
        return element.classList.contains("selection-hint")
          ? { left: 0, top: 0, right: 360, width: 360, height: 150 }
          : { left: 0, top: 0, right: 178, width: 178, height: 92 };
      }
      return { left: 0, top: 0, right: 0, width: 0, height: 0 };
    },
  };

  if (id.endsWith("Canvas")) {
    element.width = 0;
    element.height = 0;
    element.getContext = () => canvasContext;
  }

  return element;
}

const canvasContext = {
  shadowBlur: 0,
  lineDash: [],
  operations: [],
  resetOperations() {
    this.operations = [];
  },
  setTransform() {},
  clearRect() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  fillRect(x, y, width, height) {
    this.operations.push({
      type: "fillRect",
      x,
      y,
      width,
      height,
      fillStyle: this.fillStyle,
    });
  },
  beginPath() {},
  moveTo() {},
  lineTo() {
    this.operations.push({
      type: "lineTo",
      strokeStyle: this.strokeStyle,
      lineDash: [...this.lineDash],
    });
  },
  stroke() {},
  save() {},
  restore() {},
  clip() {},
  rect() {},
  fillText() {},
  strokeText(text, x, y) {
    this.operations.push({
      type: "strokeText",
      text,
      x,
      y,
      font: this.font,
    });
  },
  measureText(text) {
    const textValue = String(text);
    const charWidth = typeof this.font === "string" && this.font.includes("38px") ? 22 : 8;
    return { width: textValue.length * charWidth };
  },
  arc() {},
  fill() {},
  setLineDash(value) {
    this.lineDash = [...value];
    this.operations.push({ type: "setLineDash", value: [...value] });
  },
};

const elementIds = [
  "modeToggleBtn",
  "modeValue",
  "overlayStartBtn",
  "pauseBtn",
  "clearBtn",
  "exportBtn",
  "timeZoomInBtn",
  "timeZoomOutBtn",
  "pitchZoomInBtn",
  "pitchZoomOutBtn",
  "thresholdInput",
  "thresholdValue",
  "engineBadge",
  "currentStatus",
  "currentCents",
  "currentHz",
  "currentMidi",
  "currentConf",
  "rangeStatus",
  "windowStatus",
  "messageStatus",
  "canvasWrap",
  "backgroundCanvas",
  "traceCanvas",
  "hoverHint",
  "pitchScrollbar",
  "pitchScrollbarThumb",
  "startOverlay",
];

const elements = new Map(elementIds.map((id) => [id, createElement(id)]));
const analyticsEvents = [];

const context = {
  console,
  document: {
    visibilityState: "visible",
    head: { appendChild() {} },
    createElement: (tag) => createElement(tag),
    querySelector: () => null,
    getElementById: (id) => elements.get(id),
    addEventListener() {},
  },
  window: {
    innerWidth: 1280,
    devicePixelRatio: 1,
    isSecureContext: true,
    gtag(...args) {
      analyticsEvents.push(args);
    },
    addEventListener() {},
  },
  navigator: {},
  localStorage: {
    getItem: () => null,
    setItem() {},
  },
  ResizeObserver: class {
    observe() {}
  },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
  Blob: class {},
  URL: {
    createObjectURL: () => "blob:test",
    revokeObjectURL() {},
  },
};

vm.createContext(context);
vm.runInContext(await readFile("app.js", "utf8"), context, { filename: "app.js" });

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function click(id) {
  const handler = eventHandlers.get(`${id}:click`);
  assert(handler, `missing click handler for ${id}`);
  handler({
    preventDefault() {},
    stopPropagation() {},
    target: elements.get(id),
  });
}

function canvasPointer(type, overrides = {}) {
  const handler = eventHandlers.get(`canvasWrap:${type}`);
  assert(handler, `missing ${type} handler for canvasWrap`);
  handler({
    type,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 0,
    clientY: 0,
    shiftKey: false,
    target: elements.get("canvasWrap"),
    preventDefault() {},
    stopPropagation() {},
    ...overrides,
  });
}

context.setMicState("running");
assert(
  elements.get("messageStatus").textContent === "Running (10.0 ms hop, max res)",
  "running status should show the current adaptive hop at min resolution",
);
context.setAdaptiveHopSamples(320);
context.updateStatus();
assert(
  elements.get("messageStatus").textContent === "Running (20.0 ms hop, adapting)",
  "running status should show adaptive hop changes",
);
context.setMicState("idle");
context.setMessage("Idle");

assert(elements.get("modeValue").textContent === "Graph", "initial mode should be Graph");
assert(elements.get("pitchZoomInBtn").disabled === false, "pitch zoom in should start enabled");
assert(elements.get("pitchZoomOutBtn").disabled === false, "pitch zoom out should start enabled");
assert(elements.get("rangeStatus").textContent.includes("E2-C6"), "default graph range should stay E2-C6");
assert(elements.get("pitchScrollbar").getAttribute("aria-valuemax") === "108", "pitch scrollbar should expose the C8 display ceiling");
assert(analyticsEvents.length === 0, "initial mode restore should not send mode analytics");

for (let i = 0; i < 6; i += 1) {
  click("pitchZoomOutBtn");
}
assert(elements.get("rangeStatus").textContent.includes("C1-C8"), "graph pitch zoom should reach the C8 display ceiling");

click("modeToggleBtn");
assert(elements.get("modeValue").textContent === "Tuner", "mode should switch to Tuner");
assert(elements.get("pitchZoomInBtn").disabled === true, "pitch zoom in should be disabled in Tuner");
assert(elements.get("pitchZoomOutBtn").disabled === true, "pitch zoom out should be disabled in Tuner");
assert(elements.get("pitchScrollbar").getAttribute("aria-disabled") === "true", "pitch scrollbar should be marked disabled in Tuner");
assert(elements.get("rangeStatus").textContent.includes("Tuner: A4"), "Tuner should default to A4 before detection");
assert(
  JSON.stringify(analyticsEvents.at(-1)) === JSON.stringify(["event", "view_mode_switch", { view_mode: "Tuner" }]),
  "switching to Tuner should send one mode analytics event",
);

const frequencyFromMidi = (midi) => 440 * (2 ** ((midi - 69) / 12));
const c4Frequency = frequencyFromMidi(60);
const d4Frequency = frequencyFromMidi(62);
context.addPitchSample(0, c4Frequency, 0.7);
assert(elements.get("rangeStatus").textContent.includes("Tuner: A4"), "Tuner should ignore low-confidence note changes");
context.addPitchSample(0.01, c4Frequency, 0.95);
assert(elements.get("rangeStatus").textContent.includes("Tuner: C4"), "Tuner should follow high-confidence detected notes");
context.addPitchSample(0.02, d4Frequency, 0.95);
assert(elements.get("rangeStatus").textContent.includes("Tuner: C4"), "Tuner should not switch notes on one instantaneous high-confidence sample");
context.addPitchSample(0.59, d4Frequency, 0.95);
assert(elements.get("rangeStatus").textContent.includes("Tuner: D4"), "Tuner should switch notes after EMA moves to the new high-confidence note");
canvasContext.resetOperations();
context.draw();
assert(
  !canvasContext.operations.some((operation) => (
    operation.type === "lineTo"
    && typeof operation.strokeStyle === "string"
    && /^rgba\(37, 223, 210, 0\.[3-9]/.test(operation.strokeStyle)
  )),
  "Tuner should draw per-frame detections as unconnected points",
);
assert(
  !canvasContext.operations.some((operation) => (
    operation.type === "setLineDash"
    && operation.value.join(",") === "8,5"
  )),
  "Tuner average trace should be solid",
);
assert(
  canvasContext.operations.some((operation) => (
    operation.type === "strokeText"
    && operation.text === "D4"
    && operation.x > 54
    && operation.y > 300
  )),
  "Current note label should be drawn in the lower-left graph area",
);

click("modeToggleBtn");
assert(elements.get("modeValue").textContent === "Graph", "mode should switch back to Graph");
assert(elements.get("pitchZoomInBtn").disabled === false, "pitch zoom in should re-enable in Graph");
assert(elements.get("rangeStatus").textContent.startsWith("Range:"), "Graph should restore range status");
assert(
  JSON.stringify(analyticsEvents.at(-1)) === JSON.stringify(["event", "view_mode_switch", { view_mode: "Graph" }]),
  "switching to Graph should send one mode analytics event",
);
assert(analyticsEvents.length === 2, "only mode switches should send custom analytics events");

const thresholdInputHandler = eventHandlers.get("thresholdInput:input");
assert(thresholdInputHandler, "missing input handler for confidence threshold");
elements.get("thresholdInput").value = "0.80";
thresholdInputHandler();
context.clearHistory();
context.addPitchSample(0, frequencyFromMidi(60.10), 0.95);
context.addPitchSample(0.25, frequencyFromMidi(59.80), 0.95);
context.addPitchSample(0.5, frequencyFromMidi(60.05), 0.95);
context.addPitchSample(0.75, frequencyFromMidi(59.85), 0.95);
canvasContext.resetOperations();
context.draw();
assert(
  !canvasContext.operations.some((operation) => operation.type === "strokeText" && operation.text.startsWith("MAD ")),
  "Sustained deviation should be hidden before one second of one note",
);
context.addPitchSample(1, frequencyFromMidi(60), 0.95);
canvasContext.resetOperations();
context.draw();
assert(
  canvasContext.operations.some((operation) => (
    operation.type === "strokeText"
    && operation.text === "MAD 10.0 cent"
    && operation.x > 120
    && operation.y > 300
  )),
  "Sustained deviation should appear to the right of the note label after one second",
);
context.addPitchSample(1.25, frequencyFromMidi(60.30), 0.95);
canvasContext.resetOperations();
context.draw();
assert(
  canvasContext.operations.some((operation) => operation.type === "strokeText" && operation.text === "MAD 10.0 cent"),
  "Sustained deviation should hold its value between one-second update boundaries",
);
context.addPitchSample(1.5, frequencyFromMidi(59.60), 0.95);
context.addPitchSample(1.75, frequencyFromMidi(60.49), 0.95);
context.addPitchSample(2, frequencyFromMidi(59.80), 0.95);
canvasContext.resetOperations();
context.draw();
assert(
  canvasContext.operations.some((operation) => operation.type === "strokeText" && operation.text === "MAD 21.0 cent"),
  "Sustained deviation should update on the next one-second boundary",
);
context.addPitchSample(2.25, d4Frequency, 0.95);
canvasContext.resetOperations();
context.draw();
assert(
  !canvasContext.operations.some((operation) => operation.type === "strokeText" && operation.text.startsWith("MAD ")),
  "Sustained deviation should reset when the detected note changes",
);

const e4Frequency = frequencyFromMidi(64);
const g4Frequency = frequencyFromMidi(67);
context.clearHistory();
context.addPitchSample(0, e4Frequency, 0.7);
context.addPitchSample(0.02, g4Frequency, 0.92);
context.addPitchSample(0.04, g4Frequency, 0.95);
canvasContext.resetOperations();
context.draw();
const noteRollRects = canvasContext.operations.filter((operation) => (
  operation.type === "fillRect"
  && typeof operation.fillStyle === "string"
  && operation.fillStyle.startsWith("rgba(255, 207, 74,")
));
const e4Y = context.midiToY(64);
const g4Y = context.midiToY(67);
const containsY = (rect, y) => y >= rect.y && y <= rect.y + rect.height;
assert(
  noteRollRects.some((rect) => containsY(rect, g4Y)),
  "Graph should draw confidence-weighted note detections as a piano roll behind the trace",
);
assert(
  !noteRollRects.some((rect) => containsY(rect, e4Y)),
  "Graph note detection should ignore samples below the confidence threshold",
);

elements.get("thresholdInput").value = "0.50";
thresholdInputHandler();
context.clearHistory();
context.addPitchSample(0, c4Frequency, 0.95);
context.addPitchSample(0.5, e4Frequency, 0.74);
context.addPitchSample(1, g4Frequency, 0.96);
const rightTime = context.getRightTime();
const selectLeft = context.timeToX(0, rightTime);
const selectRight = context.timeToX(2, rightTime);
const selectTop = context.midiToY(68);
const selectBottom = context.midiToY(59);
canvasPointer("pointerdown", {
  shiftKey: true,
  clientX: selectLeft,
  clientY: selectTop,
});
canvasPointer("pointermove", {
  shiftKey: true,
  clientX: selectRight,
  clientY: selectBottom,
});
canvasPointer("pointerup", {
  shiftKey: true,
  clientX: selectRight,
  clientY: selectBottom,
});
const selectionHint = elements.get("hoverHint");
assert(selectionHint.hidden === false, "range selection should show a tooltip hint");
assert(selectionHint.classList.contains("selection-hint"), "range selection should use the table hint style");
assert(selectionHint.innerHTML.includes("Upper"), "selection hint should include the upper pitch row");
assert(selectionHint.innerHTML.includes("Lower"), "selection hint should include the lower pitch row");
assert(selectionHint.innerHTML.includes("MAD"), "selection hint should include the MAD row");
assert(selectionHint.innerHTML.includes("G4"), "selection hint should include the high pitch note name");
assert(selectionHint.innerHTML.includes("C4"), "selection hint should include the low pitch note name");
assert(selectionHint.innerHTML.includes("n=2"), "selection stats should ignore pitches below the high-confidence threshold");

console.log("verify-tuner-mode ok");
