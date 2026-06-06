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
  fillRect() {},
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
  "currentNote",
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

click("modeToggleBtn");
assert(elements.get("modeValue").textContent === "Tuner", "mode should switch to Tuner");
assert(elements.get("pitchZoomInBtn").disabled === true, "pitch zoom in should be disabled in Tuner");
assert(elements.get("pitchZoomOutBtn").disabled === true, "pitch zoom out should be disabled in Tuner");
assert(elements.get("pitchScrollbar").getAttribute("aria-disabled") === "true", "pitch scrollbar should be marked disabled in Tuner");
assert(elements.get("rangeStatus").textContent.includes("Tuner: A4"), "Tuner should default to A4 before detection");

const c4Frequency = 440 * (2 ** ((60 - 69) / 12));
const d4Frequency = 440 * (2 ** ((62 - 69) / 12));
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

click("modeToggleBtn");
assert(elements.get("modeValue").textContent === "Graph", "mode should switch back to Graph");
assert(elements.get("pitchZoomInBtn").disabled === false, "pitch zoom in should re-enable in Graph");
assert(elements.get("rangeStatus").textContent.startsWith("Range:"), "Graph should restore range status");

console.log("verify-tuner-mode ok");
