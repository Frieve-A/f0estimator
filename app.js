"use strict";

const MODEL_SAMPLE_RATE = 16000;
const MIN_HOP_MS = 10;
const MAX_HOP_MS = 250;
const MIN_HOP_SAMPLES = Math.round((MODEL_SAMPLE_RATE * MIN_HOP_MS) / 1000);
const MAX_HOP_SAMPLES = Math.round((MODEL_SAMPLE_RATE * MAX_HOP_MS) / 1000);
const FRAME_SIZE = 1024;
const FRAME_CENTER_MS = (FRAME_SIZE / 2 / MODEL_SAMPLE_RATE) * 1000;
const MAX_HISTORY_SECONDS = 10 * 60;
const HARD_MIN_MIDI = 24;
const HARD_MAX_MIDI = 108;
const MIN_PITCH_SPAN = 12;
const VIEW_MODE_GRAPH = "graph";
const VIEW_MODE_TUNER = "tuner";
const VIEW_MODE_MULTI = "multi";
const modeHistories = {};
const RENDERER_WORKER_URL = "renderer-worker.js?v=15";
const TUNER_DEFAULT_CENTER_MIDI = 69;
const TUNER_HALF_RANGE_MIDI = 0.5;
const TUNER_CENT_GRID_STEP = 10;
const TUNER_AVERAGE_TIME_CONSTANT_SEC = 0.35;
const TUNER_AVERAGE_RESET_GAP_SEC = 0.6;
const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const NOTE_ROLL_MAX_GAP_SEC = 0.32;
const NOTE_ROLL_MIN_DURATION_SEC = 0.035;
const NOTE_ROLL_SINGLE_SAMPLE_SEC = 0.045;
const NOTE_ROLL_PITCH_TOLERANCE_MIDI = 0.62;
const NOTE_ROLL_MIN_WIDTH_PX = 3;
const SUSTAINED_DEVIATION_MIN_DURATION_SEC = 1;
const SUSTAINED_DEVIATION_UPDATE_INTERVAL_SEC = 1;
const STATUS_UPDATE_INTERVAL_MS = 100;
const DEFAULT_VOCAL_MIN_MIDI = 40;
const DEFAULT_VOCAL_MAX_MIDI = 84;
const PITCH_AXIS_WIDTH = 54;
const CURRENT_NOTE_LABEL_FONT = "800 38px ui-sans-serif, system-ui, sans-serif";
const CURRENT_DEVIATION_LABEL_FONT_SIZE = 16;
const CURRENT_DEVIATION_LABEL_FONT_FAMILY = "ui-sans-serif, system-ui, sans-serif";
const CURRENT_DEVIATION_LABEL_GAP_PX = 16;
const PITCH_AUTO_SCROLL_MARGIN_MIDI = 1.5;
const GRAPH_TAP_MOVE_PX = 6;
const RANGE_LONG_PRESS_MS = 420;
const RANGE_SELECTION_MIN_SIZE_PX = 4;
const SCROLLBAR_TIME_CLEARANCE_PX = 4;
const TARGET_INFERENCE_LOAD = 0.7;
const INFERENCE_EWMA_ALPHA = 0.12;
const MAX_TRACKED_INFERENCE_MS = 1000;
const HOP_CONTROL_INTERVAL_MS = 1500;
const HOP_INCREASE_RATIO = 1.12;
const HOP_DECREASE_RATIO = 0.8;
const QUEUE_RELAXED_MS = 90;
const QUEUE_PRESSURE_MS = 220;
const QUEUE_LATENCY_LIMIT_MS = 300;
const QUEUE_TARGET_LATENCY_MS = 180;
const QUEUE_RECOVERY_MS = 140;
const RUNNING_STATUS_CATCHUP_MS = 2500;
const RUNNING_STATUS_ADAPTING_MS = 2500;
const UPLOAD_PROGRESS_DECODE_END = 0.14;
const UPLOAD_PROGRESS_PREPARE_END = 0.22;
const UPLOAD_PROGRESS_ENGINE_END = 0.28;
const UPLOAD_PROGRESS_ANALYSIS_END = 0.98;
const UPLOAD_PROGRESS_COMMIT_END = 1;
const UPLOAD_ANALYSIS_YIELD_FRAMES = 4;
const UPLOAD_AUDIO_CHUNK_SAMPLES = 65536;
const CREPE_TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
const CREPE_MODEL_URL = "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/model.json";
const STORAGE_KEY = "frieve-f0-estimator-settings-v1";
const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const UI_THEME = {
  canvasBgTop: "#101722",
  canvasBgBottom: "#070b11",
  accidentalBand: "rgba(255, 255, 255, 0.045)",
  cLine: "rgba(255, 183, 3, 0.42)",
  pitchLine: "rgba(255, 255, 255, 0.105)",
  timeLineStrong: "rgba(37, 223, 210, 0.2)",
  timeLine: "rgba(255, 255, 255, 0.075)",
  timeLabel: "rgba(165, 173, 186, 0.92)",
  axisBg: "rgba(8, 11, 16, 0.86)",
  axisLine: "rgba(37, 223, 210, 0.28)",
  labelStrong: "#ffcf4a",
  label: "#b8c1cf",
  whiteKeyC: "rgba(255, 255, 255, 0.11)",
  whiteKey: "rgba(255, 255, 255, 0.07)",
  whiteKeyLineC: "rgba(255, 183, 3, 0.2)",
  whiteKeyLine: "rgba(255, 255, 255, 0.08)",
  blackKey: "rgba(0, 0, 0, 0.38)",
  blackKeyLine: "rgba(37, 223, 210, 0.12)",
  trace: "37, 223, 210",
  traceHot: "#25dfd2",
  traceWarm: "#ffb703",
  noteRoll: "255, 207, 74",
  noteRollEdge: "255, 255, 255",
  tunerAverage: "#ffcf4a",
  now: "#ff4d8d",
  hoverFill: "#f7f4ec",
  selectionFill: "rgba(37, 223, 210, 0.13)",
  selectionStroke: "rgba(255, 207, 74, 0.82)",
};

const els = {
  modeToggleBtn: document.getElementById("modeToggleBtn"),
  modeValue: document.getElementById("modeValue"),
  overlayStartBtn: document.getElementById("overlayStartBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  clearBtn: document.getElementById("clearBtn"),
  uploadBtn: document.getElementById("uploadBtn"),
  uploadInput: document.getElementById("uploadInput"),
  exportBtn: document.getElementById("exportBtn"),
  timeZoomInBtn: document.getElementById("timeZoomInBtn"),
  timeZoomOutBtn: document.getElementById("timeZoomOutBtn"),
  pitchZoomInBtn: document.getElementById("pitchZoomInBtn"),
  pitchZoomOutBtn: document.getElementById("pitchZoomOutBtn"),
  thresholdInput: document.getElementById("thresholdInput"),
  thresholdValue: document.getElementById("thresholdValue"),
  engineBadge: document.getElementById("engineBadge"),
  currentStatus: document.getElementById("currentStatus"),
  currentCents: document.getElementById("currentCents"),
  currentHz: document.getElementById("currentHz"),
  currentMidi: document.getElementById("currentMidi"),
  currentConf: document.getElementById("currentConf"),
  rangeStatus: document.getElementById("rangeStatus"),
  windowStatus: document.getElementById("windowStatus"),
  messageStatus: document.getElementById("messageStatus"),
  canvasWrap: document.getElementById("canvasWrap"),
  backgroundCanvas: document.getElementById("backgroundCanvas"),
  traceCanvas: document.getElementById("traceCanvas"),
  hoverHint: document.getElementById("hoverHint"),
  uploadOverlay: document.getElementById("uploadOverlay"),
  uploadProgressLabel: document.getElementById("uploadProgressLabel"),
  uploadProgressBar: document.getElementById("uploadProgressBar"),
  uploadProgressPercent: document.getElementById("uploadProgressPercent"),
  cancelUploadBtn: document.getElementById("cancelUploadBtn"),
  pitchScrollbar: document.getElementById("pitchScrollbar"),
  pitchScrollbarThumb: document.getElementById("pitchScrollbarThumb"),
  startOverlay: document.getElementById("startOverlay"),
};

const state = {
  micState: "idle",
  audioContext: null,
  stream: null,
  sourceNode: null,
  captureNode: null,
  silentGain: null,
  scriptNode: null,
  resampler: null,
  engine: null,
  modelQueue: new Float32Array(0),
  processingQueue: false,
  analysisGeneration: 0,
  animationFrameId: null,
  pausedByDeactivation: false,
  frameStartSample: 0,
  pitchSamples: [],
  currentSample: null,
  latestTimeSec: 0,
  tunerAverage: {
    midiFloat: null,
    noteMidi: null,
    timeSec: null,
  },
  sustainedDeviation: {
    noteMidi: null,
    startTimeSec: null,
    lastVoicedTimeSec: null,
    sampleCount: 0,
    absoluteCentSum: 0,
    displayMeanAbsCents: null,
    displayBucket: 0,
  },
  view: {
    mode: VIEW_MODE_GRAPH,
    visibleSeconds: 10,
    minMidi: DEFAULT_VOCAL_MIN_MIDI,
    maxMidi: DEFAULT_VOCAL_MAX_MIDI,
    tunerCenterMidi: null,
    followNow: true,
    manualRightTime: 10,
    hoverSample: null,
    hoverPosition: { x: 0, y: 0 },
    pointerDrag: null,
    pitchScrollbarDrag: null,
    selectionRange: null,
  },
  analysis: {
    sampleRateInput: 0,
    sampleRateModel: MODEL_SAMPLE_RATE,
    hopSizeMs: samplesToMs(MIN_HOP_SAMPLES),
    hopSizeSamples: MIN_HOP_SAMPLES,
    inferMsEwma: null,
    inferenceCount: 0,
    lastHopControlAt: 0,
    lastHopChangeAt: 0,
    lastQueueDropAt: 0,
    pressureWindows: 0,
    relaxWindows: 0,
    pendingQueueSkipSamples: 0,
    confidenceThreshold: 0.5,
  },
  canvas: {
    width: 0,
    height: 0,
    dpr: 1,
    backgroundDirty: true,
    backgroundKey: "",
  },
  renderer: {
    worker: null,
    useWorker: false,
    pendingSamples: [],
    sampleFlushFrameId: null,
  },
  ui: {
    statusUpdatePending: false,
    statusUpdateTimerId: null,
    statusUpdateFrameId: null,
    lastStatusUpdateAt: 0,
  },
  upload: {
    active: false,
    cancelRequested: false,
    token: null,
    snapshot: null,
    pausedRunningInput: false,
    progress: 0,
  },
};

class StreamingResampler {
  constructor(fromRate, toRate) {
    this.fromRate = fromRate;
    this.toRate = toRate;
    this.step = fromRate / toRate;
    this.tail = null;
    this.position = 0;
  }

  process(input) {
    if (!input || input.length === 0) {
      return new Float32Array(0);
    }

    const hasTail = this.tail !== null;
    const data = new Float32Array(input.length + (hasTail ? 1 : 0));
    if (hasTail) {
      data[0] = this.tail;
      data.set(input, 1);
    } else {
      data.set(input);
    }

    const values = [];
    let position = this.position;
    while (position < data.length - 1) {
      const index = Math.floor(position);
      const fraction = position - index;
      values.push(data[index] * (1 - fraction) + data[index + 1] * fraction);
      position += this.step;
    }

    this.tail = data[data.length - 1];
    this.position = position - (data.length - 1);
    return Float32Array.from(values);
  }
}

class CrepePitchEngine {
  constructor() {
    this.kind = "CREPE";
    this.model = null;
    this.modelType = "layers";
    this.ready = false;
  }

  async initialize(onStatus) {
    onStatus("Loading PitchCREPE model");
    await loadScript(CREPE_TFJS_URL);

    if (!window.tf) {
      throw new Error("TensorFlow.js is not available");
    }

    try {
      await window.tf.setBackend("webgl");
    } catch (error) {
      await window.tf.setBackend("cpu");
    }
    await window.tf.ready();

    try {
      this.model = await window.tf.loadLayersModel(CREPE_MODEL_URL);
      this.modelType = "layers";
    } catch (layersError) {
      this.model = await window.tf.loadGraphModel(CREPE_MODEL_URL);
      this.modelType = "graph";
    }

    this.ready = true;
    this.kind = "CREPE TFJS";
    onStatus(`PitchCREPE ready (${window.tf.getBackend()})`);
  }

  async estimate(frame) {
    if (!this.ready) {
      return yinEstimate(frame, MODEL_SAMPLE_RATE);
    }

    const normalized = normalizeAudioFrame(frame);
    const tf = window.tf;
    const input = tf.tensor(normalized, [1, FRAME_SIZE]);
    let output = null;
    let tensor = null;

    try {
      output = this.modelType === "graph"
        ? await this.model.executeAsync(input)
        : this.model.predict(input);
      tensor = Array.isArray(output) ? output[0] : output;
      const activations = await tensor.data();
      return activationToPitch(activations);
    } finally {
      input.dispose();
      disposeTensorOutput(output);
    }
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function normalizeAudioFrame(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i += 1) {
    sum += frame[i];
  }
  const mean = sum / frame.length;

  let variance = 0;
  for (let i = 0; i < frame.length; i += 1) {
    const centered = frame[i] - mean;
    variance += centered * centered;
  }

  const std = Math.sqrt(variance / frame.length) || 1;
  const normalized = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i += 1) {
    normalized[i] = (frame[i] - mean) / std;
  }
  return normalized;
}

function disposeTensorOutput(output) {
  if (!output) {
    return;
  }
  if (Array.isArray(output)) {
    output.forEach((item) => item && typeof item.dispose === "function" && item.dispose());
    return;
  }
  if (typeof output.dispose === "function") {
    output.dispose();
  }
}

function activationToPitch(activations) {
  let maxIndex = 0;
  let confidence = -Infinity;
  for (let i = 0; i < activations.length; i += 1) {
    if (activations[i] > confidence) {
      confidence = activations[i];
      maxIndex = i;
    }
  }

  const start = Math.max(0, maxIndex - 4);
  const end = Math.min(activations.length - 1, maxIndex + 4);
  let weight = 0;
  let weightedCents = 0;

  for (let i = start; i <= end; i += 1) {
    const value = Math.max(0, activations[i]);
    const cents = 1997.3794084376191 + 20 * i;
    weight += value;
    weightedCents += cents * value;
  }

  const cents = weight > 0
    ? weightedCents / weight
    : 1997.3794084376191 + 20 * maxIndex;
  return {
    frequency: 10 * Math.pow(2, cents / 1200),
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

function yinEstimate(frame, sampleRate) {
  const minFrequency = 32.7;
  const maxFrequency = midiToFrequency(HARD_MAX_MIDI);
  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxTau = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(frame.length / 2));
  const difference = new Float32Array(maxTau + 1);

  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    for (let i = 0; i < frame.length - tau; i += 1) {
      const delta = frame[i] - frame[i + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }

  let runningSum = 0;
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let tauEstimate = -1;
  const threshold = 0.12;

  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += difference[tau];
    cmnd[tau] = difference[tau] * tau / (runningSum || 1);
    if (tau >= minTau && tauEstimate < 0 && cmnd[tau] < threshold) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) {
        tau += 1;
      }
      tauEstimate = tau;
    }
  }

  if (tauEstimate < 0) {
    let bestTau = minTau;
    for (let tau = minTau + 1; tau <= maxTau; tau += 1) {
      if (cmnd[tau] < cmnd[bestTau]) {
        bestTau = tau;
      }
    }
    tauEstimate = bestTau;
  }

  const betterTau = parabolicTau(cmnd, tauEstimate);
  const confidence = Math.max(0, Math.min(1, 1 - cmnd[tauEstimate]));
  return {
    frequency: sampleRate / betterTau,
    confidence,
  };
}

function parabolicTau(values, tau) {
  if (tau <= 0 || tau >= values.length - 1) {
    return tau;
  }
  const left = values[tau - 1];
  const center = values[tau];
  const right = values[tau + 1];
  const divisor = 2 * (2 * center - right - left);
  if (!Number.isFinite(divisor) || Math.abs(divisor) < 1e-9) {
    return tau;
  }
  return tau + (right - left) / divisor;
}

function loadSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (error) {
    stored = {};
  }

  const width = window.innerWidth;
  state.view.mode = stored.mode === VIEW_MODE_MULTI ? VIEW_MODE_MULTI : stored.mode === VIEW_MODE_TUNER
    ? VIEW_MODE_TUNER
    : VIEW_MODE_GRAPH;
  state.view.visibleSeconds = Number.isFinite(stored.visibleSeconds)
    ? clamp(stored.visibleSeconds, 2, 60)
    : initialVisibleSeconds(width);

  const range = initialMidiRange();
  state.view.minMidi = Number.isFinite(stored.minMidi)
    ? clamp(stored.minMidi, HARD_MIN_MIDI, HARD_MAX_MIDI - MIN_PITCH_SPAN)
    : range.minMidi;
  state.view.maxMidi = Number.isFinite(stored.maxMidi)
    ? clamp(stored.maxMidi, state.view.minMidi + MIN_PITCH_SPAN, HARD_MAX_MIDI)
    : range.maxMidi;
  state.analysis.confidenceThreshold = Number.isFinite(stored.confidenceThreshold)
    ? clamp(stored.confidenceThreshold, 0.05, 0.95)
    : 0.5;
  state.view.tunerCenterMidi = Number.isFinite(stored.tunerCenterMidi)
    ? clamp(Math.round(stored.tunerCenterMidi), HARD_MIN_MIDI, HARD_MAX_MIDI)
    : null;
  els.thresholdInput.value = state.analysis.confidenceThreshold.toFixed(2);
  els.thresholdValue.value = state.analysis.confidenceThreshold.toFixed(2);
  normalizePitchRange();
  setTunerCenterFromCurrentOrHistory();
  updateModeControls();
}

function saveSettings() {
  const data = {
    mode: state.view.mode,
    visibleSeconds: state.view.visibleSeconds,
    minMidi: state.view.minMidi,
    maxMidi: state.view.maxMidi,
    tunerCenterMidi: state.view.tunerCenterMidi,
    confidenceThreshold: state.analysis.confidenceThreshold,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function initialVisibleSeconds(width) {
  if (width < 600) {
    return 6;
  }
  if (width < 1200) {
    return 10;
  }
  return 15;
}

function initialMidiRange() {
  return { minMidi: DEFAULT_VOCAL_MIN_MIDI, maxMidi: DEFAULT_VOCAL_MAX_MIDI };
}

function normalizePitchRange() {
  const span = state.view.maxMidi - state.view.minMidi;
  const nextSpan = clamp(span, MIN_PITCH_SPAN, HARD_MAX_MIDI - HARD_MIN_MIDI);
  let nextMin = state.view.minMidi;
  let nextMax = nextMin + nextSpan;

  if (nextMin < HARD_MIN_MIDI) {
    nextMin = HARD_MIN_MIDI;
    nextMax = nextMin + nextSpan;
  }
  if (nextMax > HARD_MAX_MIDI) {
    nextMax = HARD_MAX_MIDI;
    nextMin = nextMax - nextSpan;
  }

  state.view.minMidi = nextMin;
  state.view.maxMidi = nextMax;
}

function isTunerMode() {
  return state.view.mode === VIEW_MODE_TUNER;
}

function isMultiMode() {
  return state.view.mode === VIEW_MODE_MULTI;
}

function setViewMode(mode) {
  if (isUploadProcessing() || state.micState === "requesting") {
    return;
  }

  const nextMode = mode === VIEW_MODE_MULTI ? VIEW_MODE_MULTI : mode === VIEW_MODE_TUNER ? VIEW_MODE_TUNER : VIEW_MODE_GRAPH;
  if (state.view.mode === nextMode) {
    return;
  }

  const changesEngine = isMultiMode() !== (nextMode === VIEW_MODE_MULTI);
  const restart = changesEngine && state.micState === "running";
  const preservePausedState = changesEngine && state.micState === "paused";
  // Graph and Multi F0 are alternate analyses of the same piano roll. Keep the
  // user's pitch viewport while swapping their independently retained data.
  const sharedPitchRange = {
    minMidi: state.view.minMidi,
    maxMidi: state.view.maxMidi,
  };
  if (changesEngine) {
    modeHistories[isMultiMode() ? "multi" : "single"] = createAnalysisSnapshot();
    releaseCaptureResources();
    setMicState(preservePausedState ? "paused" : "idle");
  }
  state.view.mode = nextMode;
  if (changesEngine) {
    resetPitchHistoryState();
    const history = modeHistories[isMultiMode() ? "multi" : "single"];
    if (history) restoreAnalysisSnapshot(history);
    state.view.minMidi = sharedPitchRange.minMidi;
    state.view.maxMidi = sharedPitchRange.maxMidi;
    els.exportBtn.disabled = state.pitchSamples.length === 0;
    invalidateAnalysisQueue();
    setMessage(preservePausedState ? "Paused" : isMultiMode() ? "Polyphonic analysis ready" : "Idle");
  }
  if (isTunerMode()) {
    setTunerCenterFromCurrentOrHistory();
    state.view.pitchScrollbarDrag = null;
    state.view.pointerDrag = null;
  }

  state.view.hoverSample = null;
  state.view.selectionRange = null;
  hideHint();
  saveSettings();
  trackViewModeSwitch(nextMode);
  updateModeControls();
  markBackgroundDirty();
  updateStatus();
  draw();
  if (restart) startMic();
}

function toggleViewMode() {
  setViewMode(isTunerMode() || isMultiMode() ? VIEW_MODE_GRAPH : VIEW_MODE_TUNER);
}

function trackViewModeSwitch(mode) {
  const gtag = window.gtag;
  if (typeof gtag !== "function") {
    return;
  }

  try {
    gtag("event", "view_mode_switch", {
      view_mode: mode === VIEW_MODE_MULTI ? "Multi F0" : mode === VIEW_MODE_TUNER ? "Tuner" : "Graph",
    });
  } catch (error) {
    // Analytics must not affect realtime UI operation.
  }
}

function updateModeControls() {
  const tunerMode = isTunerMode();
  const modeName = isMultiMode() ? "Multi F0" : tunerMode ? "Tuner" : "Graph";
  const toggleTitle = "Single F0 history";
  const multiButton = document.getElementById("multiModeBtn");
  if (multiButton) {
    multiButton.disabled = isUploadProcessing() || state.micState === "requesting";
    setAttribute(multiButton, "aria-pressed", String(isMultiMode()));
  }
  const tunerButton = document.getElementById("tunerModeBtn");
  if (tunerButton) {
    tunerButton.disabled = isUploadProcessing() || state.micState === "requesting";
    setAttribute(tunerButton, "aria-pressed", String(tunerMode));
  }
  const legend = document.getElementById("multiLegend");
  if (legend) legend.hidden = !isMultiMode();
  setText(els.engineBadge, isMultiMode() ? "EffeTune DSP" : state.engine?.kind || "CREPE");
  const pitchZoomTitle = tunerMode ? "Pitch zoom disabled in Tuner mode" : "Zoom pitch in";
  const pitchZoomOutTitle = tunerMode ? "Pitch zoom disabled in Tuner mode" : "Zoom pitch out";

  setText(els.modeValue, modeName);
  if (els.modeToggleBtn.title !== toggleTitle) {
    els.modeToggleBtn.title = toggleTitle;
  }
  setAttribute(els.modeToggleBtn, "aria-label", "Graph: single F0 history");
  setAttribute(els.modeToggleBtn, "aria-pressed", String(state.view.mode === VIEW_MODE_GRAPH));

  if (els.pitchZoomInBtn.disabled !== tunerMode) {
    els.pitchZoomInBtn.disabled = tunerMode;
  }
  if (els.pitchZoomOutBtn.disabled !== tunerMode) {
    els.pitchZoomOutBtn.disabled = tunerMode;
  }
  if (els.pitchZoomInBtn.title !== pitchZoomTitle) {
    els.pitchZoomInBtn.title = pitchZoomTitle;
  }
  if (els.pitchZoomOutBtn.title !== pitchZoomOutTitle) {
    els.pitchZoomOutBtn.title = pitchZoomOutTitle;
  }

  setAttribute(els.pitchScrollbar, "aria-disabled", String(tunerMode));
  applyUploadControlLock();
}

function tunerCenterMidiFromSample(sample) {
  if (
    !sample
    || !sample.voiced
    || !Number.isFinite(sample.tunerAverageMidi)
  ) {
    return null;
  }
  return clamp(Math.round(sample.tunerAverageMidi), HARD_MIN_MIDI, HARD_MAX_MIDI);
}

function setTunerCenterFromSample(sample) {
  const centerMidi = tunerCenterMidiFromSample(sample);
  if (centerMidi === null) {
    return false;
  }
  if (state.view.tunerCenterMidi === centerMidi) {
    return false;
  }

  state.view.tunerCenterMidi = centerMidi;
  return true;
}

function setTunerCenterFromCurrentOrHistory() {
  const currentCenterMidi = tunerCenterMidiFromSample(state.currentSample);
  if (currentCenterMidi !== null) {
    state.view.tunerCenterMidi = currentCenterMidi;
    return true;
  }

  for (let i = state.pitchSamples.length - 1; i >= 0; i -= 1) {
    const centerMidi = tunerCenterMidiFromSample(state.pitchSamples[i]);
    if (centerMidi !== null) {
      state.view.tunerCenterMidi = centerMidi;
      return true;
    }
  }

  return false;
}

function resetTunerAverageState() {
  state.tunerAverage.midiFloat = null;
  state.tunerAverage.noteMidi = null;
  state.tunerAverage.timeSec = null;
}

function resetSustainedDeviationState() {
  state.sustainedDeviation.noteMidi = null;
  state.sustainedDeviation.startTimeSec = null;
  state.sustainedDeviation.lastVoicedTimeSec = null;
  state.sustainedDeviation.sampleCount = 0;
  state.sustainedDeviation.absoluteCentSum = 0;
  state.sustainedDeviation.displayMeanAbsCents = null;
  state.sustainedDeviation.displayBucket = 0;
}

function updateTunerAverageForSample(sample) {
  sample.tunerAverageMidi = null;
  if (!sample.voiced || !Number.isFinite(sample.midiFloat)) {
    return false;
  }

  const noteMidi = clamp(Math.round(sample.midiFloat), HARD_MIN_MIDI, HARD_MAX_MIDI);
  const highConfidence = sample.confidence >= HIGH_CONFIDENCE_THRESHOLD;
  const currentAverage = state.tunerAverage.midiFloat;
  const currentNoteMidi = Number.isFinite(currentAverage)
    ? clamp(Math.round(currentAverage), HARD_MIN_MIDI, HARD_MAX_MIDI)
    : state.tunerAverage.noteMidi;
  const currentTimeSec = state.tunerAverage.timeSec;
  const hasAverage = Number.isFinite(currentAverage)
    && Number.isFinite(currentNoteMidi)
    && Number.isFinite(currentTimeSec);
  const deltaTime = hasAverage ? sample.timeSec - currentTimeSec : Infinity;

  if (!hasAverage || deltaTime > TUNER_AVERAGE_RESET_GAP_SEC) {
    if (!highConfidence) {
      resetTunerAverageState();
      return false;
    }

    state.tunerAverage.midiFloat = sample.midiFloat;
    state.tunerAverage.noteMidi = noteMidi;
    state.tunerAverage.timeSec = sample.timeSec;
    sample.tunerAverageMidi = sample.midiFloat;
    return true;
  }

  if (!highConfidence && noteMidi !== currentNoteMidi) {
    sample.tunerAverageMidi = currentAverage;
    return false;
  }

  const alpha = deltaTime <= 0
    ? 0
    : 1 - Math.exp(-deltaTime / TUNER_AVERAGE_TIME_CONSTANT_SEC);
  const nextAverage = currentAverage + alpha * (sample.midiFloat - currentAverage);
  state.tunerAverage.midiFloat = nextAverage;
  state.tunerAverage.noteMidi = clamp(Math.round(nextAverage), HARD_MIN_MIDI, HARD_MAX_MIDI);
  state.tunerAverage.timeSec = sample.timeSec;
  sample.tunerAverageMidi = nextAverage;
  return state.tunerAverage.noteMidi !== currentNoteMidi;
}

function updateSustainedDeviationForSample(sample) {
  if (!sample || !Number.isFinite(sample.timeSec)) {
    resetSustainedDeviationState();
    return;
  }

  if (!sample.voiced || !Number.isFinite(sample.midiFloat)) {
    const lastVoicedTimeSec = state.sustainedDeviation.lastVoicedTimeSec;
    if (
      lastVoicedTimeSec === null
      || sample.timeSec - lastVoicedTimeSec > NOTE_ROLL_MAX_GAP_SEC
    ) {
      resetSustainedDeviationState();
    }
    return;
  }

  const noteMidi = clamp(Math.round(sample.midiFloat), HARD_MIN_MIDI, HARD_MAX_MIDI);
  const sameSustainedNote = state.sustainedDeviation.noteMidi === noteMidi
    && state.sustainedDeviation.lastVoicedTimeSec !== null
    && sample.timeSec - state.sustainedDeviation.lastVoicedTimeSec <= NOTE_ROLL_MAX_GAP_SEC;

  if (!sameSustainedNote) {
    resetSustainedDeviationState();
    state.sustainedDeviation.noteMidi = noteMidi;
    state.sustainedDeviation.startTimeSec = sample.timeSec;
  }

  const absoluteCents = Math.abs((sample.midiFloat - noteMidi) * 100);
  state.sustainedDeviation.lastVoicedTimeSec = sample.timeSec;
  state.sustainedDeviation.sampleCount += 1;
  state.sustainedDeviation.absoluteCentSum += absoluteCents;

  const durationSec = sample.timeSec - state.sustainedDeviation.startTimeSec;
  if (durationSec < SUSTAINED_DEVIATION_MIN_DURATION_SEC) {
    state.sustainedDeviation.displayMeanAbsCents = null;
    state.sustainedDeviation.displayBucket = 0;
    return;
  }

  const displayBucket = Math.floor(durationSec / SUSTAINED_DEVIATION_UPDATE_INTERVAL_SEC);
  if (
    displayBucket > state.sustainedDeviation.displayBucket
    || state.sustainedDeviation.displayMeanAbsCents === null
  ) {
    state.sustainedDeviation.displayMeanAbsCents = state.sustainedDeviation.absoluteCentSum
      / Math.max(1, state.sustainedDeviation.sampleCount);
    state.sustainedDeviation.displayBucket = displayBucket;
  }
}

function recomputeTunerAverageSamples() {
  resetTunerAverageState();
  for (const sample of state.pitchSamples) {
    updateTunerAverageForSample(sample);
  }
}

function recomputeSinglePitchDerivedState() {
  resetTunerAverageState();
  resetSustainedDeviationState();
  for (const sample of state.pitchSamples) {
    sample.voiced = sample.frequency > 0
      && Number.isFinite(sample.midiFloat)
      && sample.midiFloat >= HARD_MIN_MIDI
      && sample.midiFloat <= HARD_MAX_MIDI
      && sample.confidence >= state.analysis.confidenceThreshold;
    updateTunerAverageForSample(sample);
    updateSustainedDeviationForSample(sample);
  }
}

function getTunerCenterMidi() {
  if (Number.isFinite(state.view.tunerCenterMidi)) {
    return clamp(Math.round(state.view.tunerCenterMidi), HARD_MIN_MIDI, HARD_MAX_MIDI);
  }
  return TUNER_DEFAULT_CENTER_MIDI;
}

function getEffectivePitchRange() {
  if (isTunerMode()) {
    const centerMidi = getTunerCenterMidi();
    return {
      minMidi: centerMidi - TUNER_HALF_RANGE_MIDI,
      maxMidi: centerMidi + TUNER_HALF_RANGE_MIDI,
      centerMidi,
    };
  }

  return {
    minMidi: state.view.minMidi,
    maxMidi: state.view.maxMidi,
    centerMidi: null,
  };
}

function canUseWorkerRenderer() {
  return typeof Worker === "function"
    && els.backgroundCanvas
    && els.traceCanvas
    && typeof els.backgroundCanvas.transferControlToOffscreen === "function"
    && typeof els.traceCanvas.transferControlToOffscreen === "function";
}

function setupRenderer() {
  if (!canUseWorkerRenderer()) {
    return;
  }

  let worker = null;
  try {
    worker = new Worker(RENDERER_WORKER_URL);
    const backgroundCanvas = els.backgroundCanvas.transferControlToOffscreen();
    const traceCanvas = els.traceCanvas.transferControlToOffscreen();

    state.renderer.worker = worker;
    state.renderer.useWorker = true;

    worker.onmessage = (event) => {
      if (event.data && event.data.type === "error") {
        console.error("Renderer worker error:", event.data.message);
      }
    };
    worker.onerror = (event) => {
      console.error("Renderer worker failed:", event.message || event);
      setMessage("Renderer worker unavailable", true);
    };

    worker.postMessage({
      type: "init",
      backgroundCanvas,
      traceCanvas,
    }, [backgroundCanvas, traceCanvas]);
  } catch (error) {
    if (worker) {
      worker.terminate();
    }
    state.renderer.worker = null;
    state.renderer.useWorker = false;
    console.warn("Falling back to main-thread canvas rendering", error);
  }
}

function postRendererMessage(message) {
  if (!state.renderer.useWorker || !state.renderer.worker) {
    return;
  }
  state.renderer.worker.postMessage(message);
}

function compactRenderSample(sample) {
  if (!sample) {
    return null;
  }
  return {
    volumeDb: sample.volumeDb,
    timeSec: Number.isFinite(sample.timeSec) ? sample.timeSec : 0,
    frequency: Number.isFinite(sample.frequency) ? sample.frequency : 0,
    midiFloat: Number.isFinite(sample.midiFloat) ? sample.midiFloat : null,
    confidence: Number.isFinite(sample.confidence) ? sample.confidence : 0,
    voiced: Boolean(sample.voiced),
    tunerAverageMidi: Number.isFinite(sample.tunerAverageMidi) ? sample.tunerAverageMidi : null,
  };
}

function compactSelectionRange(range) {
  if (!range) {
    return null;
  }

  return {
    left: Number.isFinite(range.left) ? range.left : 0,
    top: Number.isFinite(range.top) ? range.top : 0,
    width: Number.isFinite(range.width) ? range.width : 0,
    height: Number.isFinite(range.height) ? range.height : 0,
  };
}

function queueRendererSample(sample) {
  if (!state.renderer.useWorker) {
    return;
  }

  state.renderer.pendingSamples.push(compactRenderSample(sample));
  if (state.renderer.sampleFlushFrameId !== null) {
    return;
  }

  if (typeof requestAnimationFrame === "function") {
    state.renderer.sampleFlushFrameId = requestAnimationFrame(flushRendererSamples);
  } else {
    flushRendererSamples();
  }
}

function flushRendererSamples() {
  if (!state.renderer.useWorker || state.renderer.pendingSamples.length === 0) {
    state.renderer.sampleFlushFrameId = null;
    return;
  }

  const samples = state.renderer.pendingSamples;
  state.renderer.pendingSamples = [];
  state.renderer.sampleFlushFrameId = null;
  postRendererMessage({ type: "appendSamples", samples });
}

function replaceRendererSamples() {
  if (!state.renderer.useWorker) {
    return;
  }

  cancelRendererSampleFlush();
  state.renderer.pendingSamples = [];
  postRendererMessage({
    type: "setSamples",
    samples: state.pitchSamples.map(compactRenderSample),
  });
  markBackgroundDirty();
}

function clearRendererSamples() {
  if (!state.renderer.useWorker) {
    return;
  }

  cancelRendererSampleFlush();
  state.renderer.pendingSamples = [];
  postRendererMessage({ type: "clearSamples" });
}

function cancelRendererSampleFlush() {
  if (
    state.renderer.sampleFlushFrameId !== null
    && typeof cancelAnimationFrame === "function"
  ) {
    cancelAnimationFrame(state.renderer.sampleFlushFrameId);
  }
  state.renderer.sampleFlushFrameId = null;
}

function createRenderState() {
  return {
    canvas: {
      width: state.canvas.width,
      height: state.canvas.height,
      dpr: state.canvas.dpr,
    },
    view: {
      mode: state.view.mode,
      visibleSeconds: state.view.visibleSeconds,
      minMidi: state.view.minMidi,
      maxMidi: state.view.maxMidi,
      tunerCenterMidi: state.view.tunerCenterMidi,
      followNow: state.view.followNow,
      manualRightTime: state.view.manualRightTime,
      hoverSample: compactRenderSample(state.view.hoverSample),
      selectionRange: compactSelectionRange(state.view.selectionRange),
    },
    analysis: {
      confidenceThreshold: state.analysis.confidenceThreshold,
    },
    latestTimeSec: state.latestTimeSec,
    currentNoteLabel: getCurrentNoteLabel(),
    currentDeviationLabel: getSustainedDeviationLabel(),
    rightTime: getRightTime(),
  };
}

function drawWithWorker() {
  flushRendererSamples();

  const backgroundKey = getBackgroundKey();
  const backgroundDirty = state.canvas.backgroundDirty || state.canvas.backgroundKey !== backgroundKey;
  state.canvas.backgroundDirty = false;
  state.canvas.backgroundKey = backgroundKey;

  postRendererMessage({
    type: "draw",
    renderState: createRenderState(),
    backgroundDirty,
  });
}

function setupCanvases() {
  setupRenderer();

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvases();
    normalizePitchRange();
    markBackgroundDirty();
    draw();
    updateStatus();
  });
  resizeObserver.observe(els.canvasWrap);
  resizeCanvases();
}

function resizeCanvases() {
  const rect = els.canvasWrap.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  state.canvas.width = Math.max(1, rect.width);
  state.canvas.height = Math.max(1, rect.height);
  state.canvas.dpr = dpr;

  for (const canvas of [els.backgroundCanvas, els.traceCanvas]) {
    const pixelWidth = Math.round(state.canvas.width * dpr);
    const pixelHeight = Math.round(state.canvas.height * dpr);
    if (state.renderer.useWorker) {
      canvas.style.width = `${state.canvas.width}px`;
      canvas.style.height = `${state.canvas.height}px`;
      continue;
    }

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    canvas.style.width = `${state.canvas.width}px`;
    canvas.style.height = `${state.canvas.height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (state.renderer.useWorker) {
    postRendererMessage({
      type: "resize",
      width: state.canvas.width,
      height: state.canvas.height,
      pixelWidth: Math.round(state.canvas.width * dpr),
      pixelHeight: Math.round(state.canvas.height * dpr),
      dpr,
    });
  }
}

function markBackgroundDirty() {
  state.canvas.backgroundDirty = true;
}

function isUploadProcessing() {
  return state.upload.active;
}

function applyUploadControlLock() {
  const locked = isUploadProcessing();
  const controls = [
    els.modeToggleBtn,
    document.getElementById("multiModeBtn"),
    document.getElementById("tunerModeBtn"),
    els.overlayStartBtn,
    els.pauseBtn,
    els.clearBtn,
    els.uploadBtn,
    els.exportBtn,
    els.timeZoomInBtn,
    els.timeZoomOutBtn,
    els.pitchZoomInBtn,
    els.pitchZoomOutBtn,
    els.thresholdInput,
  ];

  if (locked) {
    for (const control of controls) {
      if (control) control.disabled = true;
    }
    els.uploadInput.disabled = true;
    els.cancelUploadBtn.hidden = false;
    els.cancelUploadBtn.disabled = state.upload.cancelRequested;
    setAttribute(els.pitchScrollbar, "aria-disabled", "true");
    return;
  }

  els.uploadBtn.disabled = false;
  els.modeToggleBtn.disabled = state.micState === "requesting";
  els.clearBtn.disabled = false;
  els.timeZoomInBtn.disabled = false;
  els.timeZoomOutBtn.disabled = false;
  els.uploadInput.disabled = false;
  els.thresholdInput.disabled = false;
  els.cancelUploadBtn.hidden = true;
  els.cancelUploadBtn.disabled = false;
}

function updateStartOverlayVisibility() {
  els.startOverlay.hidden = state.pitchSamples.length > 0
    || (state.micState !== "idle" && state.micState !== "error");
}

function setUploadProgress(label, progress) {
  const value = clamp(progress, 0, 1);
  const percent = Math.round(value * 100);
  state.upload.progress = value;
  setText(els.uploadProgressLabel, label);
  setText(els.uploadProgressPercent, `${percent}%`);
  els.uploadProgressBar.style.width = `${(value * 100).toFixed(1)}%`;

  const progressTrack = els.uploadProgressBar.parentElement;
  if (progressTrack) {
    setAttribute(progressTrack, "aria-valuenow", String(percent));
  }
}

function showUploadOverlay() {
  els.uploadOverlay.hidden = false;
  if (typeof els.cancelUploadBtn.focus === "function") {
    els.cancelUploadBtn.focus({ preventScroll: true });
  }
}

function hideUploadOverlay() {
  els.uploadOverlay.hidden = true;
}

function clonePitchSample(sample) {
  return {
    volumeDb: sample.volumeDb,
    timeSec: sample.timeSec,
    frequency: sample.frequency,
    midiFloat: sample.midiFloat,
    confidence: sample.confidence,
    voiced: sample.voiced,
    tunerAverageMidi: sample.tunerAverageMidi,
  };
}

function cloneSelectionRange(range) {
  if (!range) {
    return null;
  }
  return { ...range };
}

function createAnalysisSnapshot() {
  const pitchSamples = state.pitchSamples.map(clonePitchSample);
  return {
    pitchSamples,
    currentIndex: state.currentSample ? state.pitchSamples.indexOf(state.currentSample) : -1,
    hoverIndex: state.view.hoverSample ? state.pitchSamples.indexOf(state.view.hoverSample) : -1,
    latestTimeSec: state.latestTimeSec,
    frameStartSample: state.frameStartSample,
    modelQueue: new Float32Array(state.modelQueue),
    pendingQueueSkipSamples: state.analysis.pendingQueueSkipSamples,
    tunerAverage: { ...state.tunerAverage },
    sustainedDeviation: { ...state.sustainedDeviation },
    view: {
      minMidi: state.view.minMidi,
      maxMidi: state.view.maxMidi,
      followNow: state.view.followNow,
      manualRightTime: state.view.manualRightTime,
      selectionRange: cloneSelectionRange(state.view.selectionRange),
    },
    message: {
      text: els.messageStatus.textContent,
      isError: els.messageStatus.classList.contains("error"),
    },
  };
}

function restoreAnalysisSnapshot(snapshot) {
  state.pitchSamples = snapshot.pitchSamples.map(clonePitchSample);
  state.currentSample = snapshot.currentIndex >= 0
    ? state.pitchSamples[snapshot.currentIndex]
    : null;
  state.latestTimeSec = snapshot.latestTimeSec;
  state.frameStartSample = snapshot.frameStartSample;
  state.modelQueue = new Float32Array(snapshot.modelQueue);
  state.analysis.pendingQueueSkipSamples = snapshot.pendingQueueSkipSamples;
  Object.assign(state.tunerAverage, snapshot.tunerAverage);
  Object.assign(state.sustainedDeviation, snapshot.sustainedDeviation);
  state.view.followNow = snapshot.view.followNow;
  state.view.minMidi = snapshot.view.minMidi;
  state.view.maxMidi = snapshot.view.maxMidi;
  state.view.manualRightTime = snapshot.view.manualRightTime;
  state.view.hoverSample = snapshot.hoverIndex >= 0
    ? state.pitchSamples[snapshot.hoverIndex]
    : null;
  state.view.selectionRange = cloneSelectionRange(snapshot.view.selectionRange);

  if (!isMultiMode()) {
    recomputeSinglePitchDerivedState();
  }

  if (!state.view.hoverSample && !state.view.selectionRange) {
    hideHint();
  }
  updateStartOverlayVisibility();
  replaceRendererSamples();
  markBackgroundDirty();
  updateStatus();
  draw();
}

function resetPitchHistoryState() {
  state.pitchSamples = [];
  state.currentSample = null;
  state.latestTimeSec = 0;
  state.frameStartSample = 0;
  state.modelQueue = new Float32Array(0);
  state.analysis.pendingQueueSkipSamples = 0;
  resetTunerAverageState();
  resetSustainedDeviationState();
  clearRendererSamples();
  state.view.hoverSample = null;
  state.view.selectionRange = null;
  state.view.followNow = true;
  state.view.manualRightTime = state.view.visibleSeconds;
  els.exportBtn.disabled = true;
  hideHint();
  updateStartOverlayVisibility();
}

function setMicState(nextState) {
  state.micState = nextState;
  if (nextState === "running") {
    state.view.followNow = true;
  }
  const pauseLabel = nextState === "paused" ? "Resume" : "Pause";
  els.overlayStartBtn.disabled = nextState === "requesting";
  els.pauseBtn.disabled = !(nextState === "running" || nextState === "paused");
  els.pauseBtn.textContent = nextState === "paused" ? "▶" : "⏸";
  els.pauseBtn.title = pauseLabel;
  els.pauseBtn.setAttribute("aria-label", pauseLabel);
  els.exportBtn.disabled = state.pitchSamples.length === 0;
  updateStartOverlayVisibility();
  applyUploadControlLock();
  updateStatus();
}

function setMessage(message, isError = false) {
  els.messageStatus.textContent = message;
  els.messageStatus.classList.toggle("error", isError);
}

function setRunningMessage() {
  if (state.micState !== "running") {
    return;
  }
  setMessage(runningStatusMessage());
}

function runningStatusMessage() {
  if (isMultiMode()) return "Running · polyphonic";
  const hopMs = formatAdaptiveHopMs(state.analysis.hopSizeMs);
  return `Running (${hopMs} ms hop, ${adaptiveHopStatusLabel()})`;
}

function adaptiveHopStatusLabel() {
  const now = nowMs();
  if (now - state.analysis.lastQueueDropAt < RUNNING_STATUS_CATCHUP_MS) {
    return "catch-up";
  }
  if (
    Number.isFinite(state.analysis.inferMsEwma)
    && state.analysis.inferMsEwma + FRAME_CENTER_MS > QUEUE_LATENCY_LIMIT_MS
  ) {
    return "limited";
  }
  if (now - state.analysis.lastHopChangeAt < RUNNING_STATUS_ADAPTING_MS) {
    return "adapting";
  }
  if (state.analysis.hopSizeSamples <= MIN_HOP_SAMPLES) {
    return "max res";
  }
  return "stable";
}

function isPageHidden() {
  return document.visibilityState && document.visibilityState !== "visible";
}

function disconnectAudioNode(node) {
  if (!node) {
    return;
  }
  try {
    node.disconnect();
  } catch (error) {
    // Already disconnected.
  }
}

function invalidateAnalysisQueue() {
  state.analysisGeneration += 1;
  state.modelQueue = new Float32Array(0);
  state.analysis.pendingQueueSkipSamples = 0;
}

function releaseCaptureResources() {
  if (state.multiNode) {
    state.multiNode.close();
    state.multiNode = null;
  }
  stopAnimationLoop();
  invalidateAnalysisQueue();
  state.resampler = null;

  if (state.captureNode) {
    state.captureNode.port.onmessage = null;
    if (typeof state.captureNode.port.close === "function") {
      state.captureNode.port.close();
    }
  }
  if (state.scriptNode) {
    state.scriptNode.onaudioprocess = null;
  }

  disconnectAudioNode(state.sourceNode);
  disconnectAudioNode(state.captureNode);
  disconnectAudioNode(state.scriptNode);
  disconnectAudioNode(state.silentGain);

  if (state.stream) {
    for (const track of state.stream.getTracks()) {
      track.stop();
    }
  }

  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.close().catch(() => {});
  }

  state.audioContext = null;
  state.stream = null;
  state.sourceNode = null;
  state.captureNode = null;
  state.silentGain = null;
  state.scriptNode = null;
}

function pauseForDeactivation() {
  if (state.micState !== "requesting" && state.micState !== "running" && state.micState !== "paused") {
    return;
  }

  state.pausedByDeactivation = true;
  releaseCaptureResources();
  setMicState("paused");
  setMessage("Paused while inactive");
}

function startAnimationLoop() {
  if (state.animationFrameId !== null || state.micState !== "running") {
    return;
  }
  state.animationFrameId = requestAnimationFrame(animationLoop);
}

function stopAnimationLoop() {
  if (state.animationFrameId === null) {
    return;
  }
  cancelAnimationFrame(state.animationFrameId);
  state.animationFrameId = null;
}

async function startMic(options = {}) {
  const resumePaused = options.resumePaused === true;
  if (
    isUploadProcessing()
    || state.micState === "requesting"
    || state.micState === "running"
    || (state.micState === "paused" && !resumePaused)
  ) {
    return;
  }

  if (!window.isSecureContext) {
    setMicState("error");
    setMessage("Open this app over HTTPS or localhost", true);
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setMicState("error");
    setMessage("Microphone input is not available in this browser", true);
    return;
  }

  if (isPageHidden()) {
    state.pausedByDeactivation = true;
    setMicState("paused");
    setMessage("Paused while inactive");
    return;
  }

  state.pausedByDeactivation = false;
  setMicState("requesting");
  setMessage("Requesting microphone permission");
  const requestGeneration = state.analysisGeneration;

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    if (requestGeneration !== state.analysisGeneration || isPageHidden()) {
      pauseForDeactivation();
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
    state.analysis.sampleRateInput = state.audioContext.sampleRate;
    state.resampler = new StreamingResampler(state.analysis.sampleRateInput, MODEL_SAMPLE_RATE);
    state.sourceNode = state.audioContext.createMediaStreamSource(state.stream);

    if (isMultiMode()) await setupMultiCapture();
    else await setupAudioCapture();
    if (requestGeneration !== state.analysisGeneration || isPageHidden()) {
      pauseForDeactivation();
      return;
    }

    if (!isMultiMode()) await setupPitchEngine();
    if (requestGeneration !== state.analysisGeneration || isPageHidden()) {
      pauseForDeactivation();
      return;
    }

    resetSessionClock();
    setMicState("running");
    setRunningMessage();
    startAnimationLoop();
  } catch (error) {
    releaseCaptureResources();
    setMicState("error");
    const message = error && error.name === "NotAllowedError"
      ? "Microphone permission was denied"
      : isMultiMode() ? "EffeTune DSP could not start. Please retry in a browser with AudioWorklet support." : "Failed to load the PitchCREPE model";
    setMessage(message, true);
    console.error(error);
  }
}

async function setupAudioCapture() {
  if (!state.audioContext || !state.sourceNode) {
    return;
  }

  try {
    await state.audioContext.audioWorklet.addModule("audio-worklet.js");
    state.captureNode = new AudioWorkletNode(state.audioContext, "f0-input-processor");
    state.captureNode.port.onmessage = (event) => {
      if (event.data && event.data.type === "audio") {
        handleAudioChunk(event.data.buffer);
      }
    };
    state.silentGain = state.audioContext.createGain();
    state.silentGain.gain.value = 0;
    state.sourceNode.connect(state.captureNode);
    state.captureNode.connect(state.silentGain);
    state.silentGain.connect(state.audioContext.destination);
  } catch (error) {
    setupScriptProcessorFallback();
    setMessage("Compatibility mode active");
  }
}

async function setupMultiCapture() {
  setMessage("Loading EffeTune Note Spectrogram");
  const generation = state.analysisGeneration;
  const context = state.audioContext;
  const [{ EffeTuneNode }, api] = await Promise.all([
    import("./vendor/effetune/dist/worklet.js"), import("./multi-f0.js"),
  ]);
  if (generation !== state.analysisGeneration) return;
  const node = await EffeTuneNode.create(context, api.noteChain, { channels: 1 });
  if (generation !== state.analysisGeneration) { node.close(); return; }
  state.multiNode = node;
  state.multiTimeOffset = state.latestTimeSec;
  state.multiTimeOrigin = null;
  node.subscribe((frame) => {
    if (!isMultiMode() || state.multiNode !== node || state.micState !== "running"
      || frame.kind !== "noteSpectrogram") return;
    if (state.multiTimeOrigin === null) state.multiTimeOrigin = frame.timeSeconds;
    const offset = state.multiTimeOffset - state.multiTimeOrigin;
    const samples = api.observations(frame, offset);
    state.latestTimeSec = Math.max(state.latestTimeSec, frame.timeSeconds + offset);
    for (const sample of samples) addPitchSample(sample.timeSec, sample.frequency, sample.confidence,
      { volumeDb: sample.volumeDb, autoScrollPitch: false, updateUi: false, trimHistory: false });
    // Silence advances the clock too, without inventing an F0 observation.
    const cutoff = state.latestTimeSec - MAX_HISTORY_SECONDS;
    let expired = 0;
    while (expired < state.pitchSamples.length && state.pitchSamples[expired].timeSec < cutoff) expired++;
    if (expired) state.pitchSamples.splice(0, expired);
    state.currentSample = samples.length ? state.pitchSamples[state.pitchSamples.length - 1] : null;
    els.exportBtn.disabled = !state.pitchSamples.length;
    state.view.followNow = true;
    markBackgroundDirty();
    requestStatusUpdate();
  });
  node.onprocessorerror = () => {
    releaseCaptureResources();
    setMicState("error");
    setMessage("EffeTune DSP stopped. Start the microphone to retry.", true);
  };
  state.silentGain = context.createGain();
  state.silentGain.gain.value = 0;
  state.sourceNode.connect(node);
  node.connect(state.silentGain);
  state.silentGain.connect(context.destination);
}

function analyzeUploadedMultiAudio(audio, sampleRate, token) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("multi-f0-worker.js", { type: "module" });
    const finish = (error, results) => {
      worker.terminate();
      token.abort = null;
      if (error) reject(error); else resolve(results);
    };
    token.abort = () => finish(createUploadAbortError());
    worker.onerror = (event) => finish(new Error(event.message));
    worker.onmessage = ({ data }) => {
      if (data.error) finish(new Error(data.error));
      else if (data.results) {
        data.results.duration = data.duration;
        finish(null, data.results);
      } else setUploadProgress("Analyzing polyphonic audio", UPLOAD_PROGRESS_ENGINE_END
        + data.progress * (UPLOAD_PROGRESS_ANALYSIS_END - UPLOAD_PROGRESS_ENGINE_END));
    };
    worker.postMessage({ audio, sampleRate }, [audio.buffer]);
  });
}

function currentMultiNotes() {
  const notes = new Map();
  for (let i = state.pitchSamples.length - 1; i >= 0; i--) {
    const sample = state.pitchSamples[i];
    if (sample.timeSec < state.latestTimeSec - 0.08) break;
    if (!Number.isFinite(sample.midiFloat) || sample.confidence < getConfidenceThreshold()) continue;
    const midi = Math.round(sample.midiFloat);
    if (!notes.has(midi)) notes.set(midi, sample);
  }
  return [...notes.values()].sort((a, b) => a.midiFloat - b.midiFloat);
}

function setupScriptProcessorFallback() {
  const bufferSize = 1024;
  state.scriptNode = state.audioContext.createScriptProcessor(bufferSize, 1, 1);
  state.scriptNode.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    handleAudioChunk(new Float32Array(input));
  };
  state.silentGain = state.audioContext.createGain();
  state.silentGain.gain.value = 0;
  state.sourceNode.connect(state.scriptNode);
  state.scriptNode.connect(state.silentGain);
  state.silentGain.connect(state.audioContext.destination);
}

async function setupPitchEngine() {
  if (isMultiMode()) return;
  if (state.engine) {
    return;
  }

  const engine = new CrepePitchEngine();
  try {
    await engine.initialize((message) => setMessage(message));
    state.engine = engine;
    els.engineBadge.textContent = engine.kind;
  } catch (error) {
    state.engine = {
      kind: "YIN fallback",
      estimate: async (frame) => yinEstimate(frame, MODEL_SAMPLE_RATE),
    };
    els.engineBadge.textContent = "YIN";
    setMessage("Compatibility mode: PitchCREPE model unavailable", true);
    console.error(error);
  }
}

function resetSessionClock() {
  state.modelQueue = new Float32Array(0);
  state.processingQueue = false;
  resetAdaptiveHopState();
  if (state.pitchSamples.length === 0) {
    state.frameStartSample = 0;
    state.latestTimeSec = 0;
    state.currentSample = null;
  } else {
    state.frameStartSample = Math.round(state.latestTimeSec * MODEL_SAMPLE_RATE);
  }
}

function handleAudioChunk(inputChunk) {
  if (isMultiMode()) return;
  if (state.micState !== "running" || !state.resampler) {
    return;
  }

  const resampled = state.resampler.process(inputChunk);
  if (resampled.length === 0) {
    return;
  }

  enqueueModelAudio(resampled);
}

function resetAdaptiveHopState() {
  const now = nowMs();
  state.analysis.hopSizeSamples = MIN_HOP_SAMPLES;
  state.analysis.hopSizeMs = samplesToMs(MIN_HOP_SAMPLES);
  state.analysis.inferMsEwma = null;
  state.analysis.inferenceCount = 0;
  state.analysis.lastHopControlAt = now;
  state.analysis.lastHopChangeAt = 0;
  state.analysis.lastQueueDropAt = 0;
  state.analysis.pressureWindows = 0;
  state.analysis.relaxWindows = 0;
  state.analysis.pendingQueueSkipSamples = 0;
}

function consumePendingQueueSkip(chunk) {
  if (state.analysis.pendingQueueSkipSamples <= 0) {
    return chunk;
  }

  const skipSamples = Math.min(state.analysis.pendingQueueSkipSamples, chunk.length);
  state.analysis.pendingQueueSkipSamples -= skipSamples;
  if (skipSamples >= chunk.length) {
    return new Float32Array(0);
  }
  return chunk.subarray(skipSamples);
}

function enqueueModelAudio(chunk) {
  const alignedChunk = consumePendingQueueSkip(chunk);
  if (alignedChunk.length === 0) {
    requestStatusUpdate();
    return;
  }

  const merged = new Float32Array(state.modelQueue.length + alignedChunk.length);
  merged.set(state.modelQueue, 0);
  merged.set(alignedChunk, state.modelQueue.length);
  state.modelQueue = merged;

  enforceQueueLatencyLimit();
  drainAnalysisQueue();
}

function enforceQueueLatencyLimit() {
  const queueMs = samplesToMs(state.modelQueue.length);
  const inferMs = Number.isFinite(state.analysis.inferMsEwma) ? state.analysis.inferMsEwma : 0;
  const predictedLatencyMs = Math.max(0, queueMs - FRAME_CENTER_MS) + inferMs;
  if (queueMs <= QUEUE_LATENCY_LIMIT_MS && predictedLatencyMs <= QUEUE_LATENCY_LIMIT_MS) {
    return 0;
  }

  const minimumQueueMs = samplesToMs(FRAME_SIZE);
  const targetQueueMs = clamp(
    QUEUE_TARGET_LATENCY_MS - inferMs + FRAME_CENTER_MS,
    minimumQueueMs,
    QUEUE_RECOVERY_MS,
  );
  const targetSamples = msToSamples(targetQueueMs);
  const dropSamples = Math.max(0, state.modelQueue.length - targetSamples);
  if (dropSamples <= 0) {
    return 0;
  }

  state.modelQueue = state.modelQueue.slice(dropSamples);
  state.frameStartSample += dropSamples;
  state.analysis.lastQueueDropAt = nowMs();
  state.analysis.pressureWindows = Math.max(state.analysis.pressureWindows, 1);
  return dropSamples;
}

async function drainAnalysisQueue() {
  if (state.processingQueue || !state.engine) {
    return;
  }

  const generation = state.analysisGeneration;
  state.processingQueue = true;
  try {
    while (state.micState === "running" && state.modelQueue.length >= FRAME_SIZE && generation === state.analysisGeneration) {
      const frame = new Float32Array(state.modelQueue.subarray(0, FRAME_SIZE));
      const hopSamples = state.analysis.hopSizeSamples;
      const queuedBeforeStep = state.modelQueue.length;
      const queuedStep = Math.min(hopSamples, queuedBeforeStep);
      state.modelQueue = state.modelQueue.slice(queuedStep);
      state.analysis.pendingQueueSkipSamples += hopSamples - queuedStep;

      const frameCenterSample = state.frameStartSample + FRAME_SIZE / 2;
      const timeSec = frameCenterSample / MODEL_SAMPLE_RATE;
      state.frameStartSample += hopSamples;

      const inferenceStartedAt = nowMs();
      const result = await state.engine.estimate(frame);
      recordInferenceDuration(nowMs() - inferenceStartedAt);
      if (state.micState !== "running" || generation !== state.analysisGeneration) {
        break;
      }
      enforceQueueLatencyLimit();
      maybeAdjustAdaptiveHop();
      addPitchSample(timeSec, result.frequency, result.confidence);
    }
  } finally {
    state.processingQueue = false;
    if (state.micState === "running" && state.modelQueue.length >= FRAME_SIZE) {
      drainAnalysisQueue();
    }
  }
}

function recordInferenceDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }

  const boundedDurationMs = clamp(durationMs, 0, MAX_TRACKED_INFERENCE_MS);
  const previous = state.analysis.inferMsEwma;
  state.analysis.inferMsEwma = Number.isFinite(previous)
    ? previous + INFERENCE_EWMA_ALPHA * (boundedDurationMs - previous)
    : boundedDurationMs;
  state.analysis.inferenceCount += 1;
}

function maybeAdjustAdaptiveHop() {
  if (state.analysis.inferenceCount < 4 || !Number.isFinite(state.analysis.inferMsEwma)) {
    return;
  }

  const now = nowMs();
  if (now - state.analysis.lastHopControlAt < HOP_CONTROL_INTERVAL_MS) {
    return;
  }
  state.analysis.lastHopControlAt = now;

  const currentSamples = state.analysis.hopSizeSamples;
  const currentHopMs = samplesToMs(currentSamples);
  const inferMs = state.analysis.inferMsEwma;
  const load = inferMs / Math.max(1, currentHopMs);
  const queueMs = samplesToMs(state.modelQueue.length);
  const desiredSamples = desiredHopSamplesForInference(inferMs);

  if (queueMs > QUEUE_PRESSURE_MS || load > 0.9 || desiredSamples > currentSamples * HOP_INCREASE_RATIO) {
    state.analysis.pressureWindows += 1;
    state.analysis.relaxWindows = 0;
  } else if (
    queueMs < QUEUE_RELAXED_MS
    && load < 0.55
    && desiredSamples < currentSamples * HOP_DECREASE_RATIO
  ) {
    state.analysis.relaxWindows += 1;
    state.analysis.pressureWindows = 0;
  } else {
    state.analysis.pressureWindows = 0;
    state.analysis.relaxWindows = 0;
  }

  const needsImmediateIncrease = desiredSamples > currentSamples * 1.35 || queueMs > QUEUE_PRESSURE_MS;
  if (desiredSamples > currentSamples && (needsImmediateIncrease || state.analysis.pressureWindows >= 2)) {
    setAdaptiveHopSamples(desiredSamples);
    state.analysis.pressureWindows = 0;
    state.analysis.relaxWindows = 0;
    return;
  }

  if (desiredSamples < currentSamples && state.analysis.relaxWindows >= 2) {
    const halfwayToDesired = Math.floor(currentSamples - (currentSamples - desiredSamples) * 0.5);
    setAdaptiveHopSamples(Math.max(desiredSamples, halfwayToDesired));
    state.analysis.pressureWindows = 0;
    state.analysis.relaxWindows = 0;
  }
}

function desiredHopSamplesForInference(inferMs) {
  const requiredMs = inferMs / TARGET_INFERENCE_LOAD;
  return clampHopSamples(Math.ceil((requiredMs * MODEL_SAMPLE_RATE) / 1000));
}

function setAdaptiveHopSamples(samples) {
  const nextSamples = clampHopSamples(samples);
  if (nextSamples === state.analysis.hopSizeSamples) {
    return;
  }

  state.analysis.hopSizeSamples = nextSamples;
  state.analysis.hopSizeMs = samplesToMs(nextSamples);
  state.analysis.lastHopChangeAt = nowMs();
  requestStatusUpdate();
}

function clampHopSamples(samples) {
  return clamp(Math.round(samples), MIN_HOP_SAMPLES, MAX_HOP_SAMPLES);
}

function addPitchSample(timeSec, frequency, confidence, options = {}) {
  const {
    autoScrollPitch = true,
    queueRender = true,
    trimHistory = true,
    updateUi = true,
  } = options;
  const midiFloat = frequencyToMidi(frequency);
  const hardRangeVoiced = Number.isFinite(midiFloat) && midiFloat >= HARD_MIN_MIDI && midiFloat <= HARD_MAX_MIDI;
  const voiced = Number.isFinite(frequency)
    && frequency > 0
    && hardRangeVoiced
    && confidence >= state.analysis.confidenceThreshold;

  const sample = {
    volumeDb: options.volumeDb,
    timeSec,
    frequency: Number.isFinite(frequency) && frequency > 0 ? frequency : 0,
    midiFloat: hardRangeVoiced ? midiFloat : null,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    voiced,
    tunerAverageMidi: null,
  };

  if (!isMultiMode()) {
    updateTunerAverageForSample(sample);
    updateSustainedDeviationForSample(sample);
  }
  state.pitchSamples.push(sample);
  if (queueRender) {
    queueRendererSample(sample);
  }
  state.latestTimeSec = Math.max(state.latestTimeSec, timeSec);
  state.currentSample = sample;

  if (trimHistory) {
    const cutoff = state.latestTimeSec - MAX_HISTORY_SECONDS;
    while (state.pitchSamples.length > 0 && state.pitchSamples[0].timeSec < cutoff) {
      state.pitchSamples.shift();
    }
  }

  const pitchRangeChanged = autoScrollPitch ? autoScrollPitchToSample(sample) : false;
  if (!updateUi) {
    return sample;
  }

  if (els.exportBtn.disabled) {
    els.exportBtn.disabled = false;
  }
  updateStartOverlayVisibility();
  if (state.micState === "running") {
    state.view.followNow = true;
  }
  if (state.view.followNow || pitchRangeChanged) {
    markBackgroundDirty();
  }
  requestStatusUpdate();
  return sample;
}

function togglePause() {
  if (isUploadProcessing()) {
    return;
  }

  if (!state.audioContext && state.micState !== "paused") {
    return;
  }

  if (state.micState === "running") {
    stopAnimationLoop();
    invalidateAnalysisQueue();
    state.audioContext.suspend().catch(() => {});
    setMicState("paused");
    setMessage("Paused");
  } else if (state.micState === "paused") {
    state.pausedByDeactivation = false;
    if (isMultiMode()) {
      state.multiTimeOrigin = null;
      state.multiTimeOffset = state.latestTimeSec;
    }
    if (!state.audioContext) {
      startMic({ resumePaused: true });
      return;
    }
    state.audioContext.resume().catch(() => {});
    setMicState("running");
    setRunningMessage();
    startAnimationLoop();
  }
}

function toggleTransport() {
  if (isUploadProcessing() || state.micState === "requesting") {
    return;
  }
  if (state.micState === "running" || state.micState === "paused") {
    togglePause();
    return;
  }
  startMic();
}

function clearHistory() {
  if (isUploadProcessing()) {
    return;
  }

  resetPitchHistoryState();
  if (state.multiNode) {
    state.multiTimeOrigin = null;
    state.multiTimeOffset = 0;
  }
  updateStatus();
  draw();
}

function exportCsv() {
  if (isUploadProcessing()) {
    return;
  }

  const header = "time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced" + (isMultiMode() ? ",volume_db" : "");
  const rows = state.pitchSamples.map((sample) => {
    const row = csvRowForSample(sample);
    return [
      row.timeSec.toFixed(3),
      row.frequency.toFixed(3),
      row.voiced ? row.midiFloat.toFixed(3) : "",
      row.voiced ? row.noteName : "",
      row.voiced ? String(row.octave) : "",
      row.voiced ? row.cents.toFixed(1) : "",
      row.confidence.toFixed(3),
      row.voiced ? "1" : "0",
      ...(isMultiMode() ? [Number.isFinite(sample.volumeDb) ? sample.volumeDb.toFixed(2) : ""] : []),
    ].join(",");
  });

  const csv = `${header}\n${rows.join("\n")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pitch-history-${formatTimestamp(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleUploadButtonClick() {
  if (isUploadProcessing()) {
    return;
  }

  els.uploadInput.value = "";
  els.uploadInput.click();
}

function handleUploadInputChange(event) {
  if (isUploadProcessing()) {
    return;
  }

  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  processUploadedAudio(file);
}

function cancelUploadProcessing() {
  if (!isUploadProcessing()) {
    return;
  }

  state.upload.cancelRequested = true;
  if (state.upload.token) {
    state.upload.token.cancelled = true;
    state.upload.token.abort?.();
  }
  setUploadProgress("Cancelling", state.upload.progress);
  applyUploadControlLock();
}

function eventTargetsCancelUpload(event) {
  return event.target === els.cancelUploadBtn
    || (
      typeof els.cancelUploadBtn.contains === "function"
      && els.cancelUploadBtn.contains(event.target)
    );
}

function suppressInteractionDuringUpload(event) {
  if (!isUploadProcessing() || eventTargetsCancelUpload(event)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
}

async function processUploadedAudio(file) {
  const snapshot = createAnalysisSnapshot();
  const token = { cancelled: false };
  const pausedRunningInput = state.micState === "running";

  state.upload.active = true;
  state.upload.cancelRequested = false;
  state.upload.token = token;
  state.upload.snapshot = snapshot;
  state.upload.pausedRunningInput = pausedRunningInput;
  showUploadOverlay();
  setUploadProgress("Preparing upload", 0);
  applyUploadControlLock();

  try {
    if (pausedRunningInput) {
      pauseRunningInputForUpload();
    }

    setUploadProgress(`Decoding ${file.name || "audio"}`, 0.02);
    const audioBuffer = await decodeUploadedAudio(file, token);
    checkUploadCancelled(token);

    const monoAudio = await mixAudioBufferToMono(audioBuffer, token);
    checkUploadCancelled(token);

    const modelAudio = isMultiMode() ? monoAudio : await resampleAudioToModelRate(monoAudio, audioBuffer.sampleRate, token);
    checkUploadCancelled(token);

    setUploadProgress("Preparing estimator", UPLOAD_PROGRESS_PREPARE_END);
    await setupPitchEngine();
    checkUploadCancelled(token);

    setUploadProgress("Analyzing audio", UPLOAD_PROGRESS_ENGINE_END);
    const results = isMultiMode()
      ? await analyzeUploadedMultiAudio(modelAudio, audioBuffer.sampleRate, token)
      : await analyzeUploadedModelAudio(modelAudio, token);
    checkUploadCancelled(token);

    setUploadProgress("Updating graph", UPLOAD_PROGRESS_ANALYSIS_END);
    replacePitchHistoryWithUploadResults(results);
    setUploadProgress("Complete", UPLOAD_PROGRESS_COMMIT_END);
    setMessage(`Upload complete (${results.length} frames)`);
  } catch (error) {
    restoreAnalysisSnapshot(snapshot);
    if (isUploadAbortError(error)) {
      setMessage(pausedRunningInput ? "Paused" : snapshot.message.text, snapshot.message.isError);
    } else {
      setMessage("Failed to process uploaded audio", true);
      console.error(error);
    }
  } finally {
    const currentMicState = state.micState;
    state.upload.active = false;
    state.upload.cancelRequested = false;
    state.upload.token = null;
    state.upload.snapshot = null;
    state.upload.pausedRunningInput = false;
    state.upload.progress = 0;
    hideUploadOverlay();
    els.uploadInput.value = "";
    setMicState(currentMicState);
    updateModeControls();
  }
}

function pauseRunningInputForUpload() {
  if (state.micState !== "running") {
    return;
  }

  stopAnimationLoop();
  invalidateAnalysisQueue();
  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.suspend().catch(() => {});
  }
  setMicState("paused");
  setMessage("Paused");
}

async function decodeUploadedAudio(file, token) {
  checkUploadCancelled(token);
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Audio decoding is not available in this browser");
  }

  const arrayBuffer = await file.arrayBuffer();
  checkUploadCancelled(token);

  const canReuseContext = state.audioContext && state.audioContext.state !== "closed";
  const decodeContext = canReuseContext ? state.audioContext : new AudioContextClass();
  const closeWhenDone = !canReuseContext;

  try {
    const decoded = await decodeContext.decodeAudioData(arrayBuffer);
    setUploadProgress("Preparing audio", UPLOAD_PROGRESS_DECODE_END);
    return decoded;
  } finally {
    if (closeWhenDone && decodeContext.state !== "closed") {
      decodeContext.close().catch(() => {});
    }
  }
}

async function mixAudioBufferToMono(audioBuffer, token) {
  const sampleRate = Math.max(1, audioBuffer.sampleRate || MODEL_SAMPLE_RATE);
  const maxSamples = Math.min(audioBuffer.length, Math.floor(sampleRate * MAX_HISTORY_SECONDS));
  const channelCount = Math.max(1, audioBuffer.numberOfChannels || 1);
  const channels = [];
  for (let channel = 0; channel < channelCount; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel));
  }

  const output = new Float32Array(maxSamples);
  for (let start = 0; start < maxSamples; start += UPLOAD_AUDIO_CHUNK_SAMPLES) {
    checkUploadCancelled(token);
    const end = Math.min(maxSamples, start + UPLOAD_AUDIO_CHUNK_SAMPLES);
    for (let i = start; i < end; i += 1) {
      let sum = 0;
      for (let channel = 0; channel < channels.length; channel += 1) {
        sum += channels[channel][i] || 0;
      }
      output[i] = sum / channels.length;
    }

    const ratio = maxSamples === 0 ? 1 : end / maxSamples;
    const progress = UPLOAD_PROGRESS_DECODE_END
      + (UPLOAD_PROGRESS_PREPARE_END - UPLOAD_PROGRESS_DECODE_END) * 0.45 * ratio;
    setUploadProgress("Preparing audio", progress);
    await yieldToMainThread();
  }

  return output;
}

async function resampleAudioToModelRate(input, fromRate, token) {
  if (input.length === 0) {
    return input;
  }
  if (Math.abs(fromRate - MODEL_SAMPLE_RATE) < 1) {
    setUploadProgress("Preparing audio", UPLOAD_PROGRESS_PREPARE_END);
    return input;
  }

  const outputLength = Math.max(1, Math.floor(((input.length - 1) * MODEL_SAMPLE_RATE) / fromRate) + 1);
  const output = new Float32Array(outputLength);
  const step = fromRate / MODEL_SAMPLE_RATE;
  const progressStart = UPLOAD_PROGRESS_DECODE_END
    + (UPLOAD_PROGRESS_PREPARE_END - UPLOAD_PROGRESS_DECODE_END) * 0.45;

  for (let start = 0; start < outputLength; start += UPLOAD_AUDIO_CHUNK_SAMPLES) {
    checkUploadCancelled(token);
    const end = Math.min(outputLength, start + UPLOAD_AUDIO_CHUNK_SAMPLES);
    for (let i = start; i < end; i += 1) {
      const position = i * step;
      const index = Math.floor(position);
      const nextIndex = Math.min(input.length - 1, index + 1);
      const fraction = position - index;
      output[i] = input[index] * (1 - fraction) + input[nextIndex] * fraction;
    }

    const ratio = end / outputLength;
    const progress = progressStart + (UPLOAD_PROGRESS_PREPARE_END - progressStart) * ratio;
    setUploadProgress("Preparing audio", progress);
    await yieldToMainThread();
  }

  return output;
}

async function analyzeUploadedModelAudio(modelAudio, token) {
  const hopSamples = MIN_HOP_SAMPLES;
  const totalFrames = modelAudio.length >= FRAME_SIZE
    ? Math.floor((modelAudio.length - FRAME_SIZE) / hopSamples) + 1
    : 0;
  const results = [];

  if (totalFrames === 0) {
    setUploadProgress("Analyzing audio", UPLOAD_PROGRESS_ANALYSIS_END);
    return results;
  }

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    checkUploadCancelled(token);
    const start = frameIndex * hopSamples;
    const frame = new Float32Array(modelAudio.subarray(start, start + FRAME_SIZE));
    const result = await state.engine.estimate(frame);
    checkUploadCancelled(token);

    results.push({
      timeSec: (start + FRAME_SIZE / 2) / MODEL_SAMPLE_RATE,
      frequency: result.frequency,
      confidence: result.confidence,
    });

    if (frameIndex % UPLOAD_ANALYSIS_YIELD_FRAMES === 0 || frameIndex === totalFrames - 1) {
      const ratio = (frameIndex + 1) / totalFrames;
      const progress = UPLOAD_PROGRESS_ENGINE_END
        + (UPLOAD_PROGRESS_ANALYSIS_END - UPLOAD_PROGRESS_ENGINE_END) * ratio;
      setUploadProgress("Analyzing audio", progress);
      await yieldToMainThread();
    }
  }

  return results;
}

function replacePitchHistoryWithUploadResults(results) {
  resetPitchHistoryState();

  for (const result of results) {
    addPitchSample(result.timeSec, result.frequency, result.confidence, {
      volumeDb: result.volumeDb,
      autoScrollPitch: false,
      queueRender: false,
      trimHistory: false,
      updateUi: false,
    });
  }

  if (isMultiMode() && Number.isFinite(results.duration)) state.latestTimeSec = results.duration;
  state.view.followNow = false;
  state.view.manualRightTime = isMultiMode()
    ? Math.max(state.view.visibleSeconds, state.latestTimeSec - MAX_HISTORY_SECONDS + state.view.visibleSeconds)
    : state.view.visibleSeconds;
  state.view.hoverSample = null;
  state.view.selectionRange = null;
  els.exportBtn.disabled = state.pitchSamples.length === 0;
  updateStartOverlayVisibility();
  replaceRendererSamples();
  markBackgroundDirty();
  updateStatus();
  draw();
}

function checkUploadCancelled(token) {
  if (token && token.cancelled) {
    throw createUploadAbortError();
  }
}

function createUploadAbortError() {
  const error = new Error("Upload cancelled");
  error.name = "AbortError";
  return error;
}

function isUploadAbortError(error) {
  return error && error.name === "AbortError";
}

function yieldToMainThread() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function csvRowForSample(sample) {
  const midiFloat = sample.midiFloat;
  const hardRangeVoiced = Number.isFinite(midiFloat) && midiFloat >= HARD_MIN_MIDI && midiFloat <= HARD_MAX_MIDI;
  const voiced = sample.confidence >= state.analysis.confidenceThreshold
    && sample.frequency > 0
    && hardRangeVoiced;

  if (!voiced) {
    return {
      timeSec: sample.timeSec,
      frequency: 0,
      midiFloat: null,
      noteName: "",
      octave: "",
      cents: null,
      confidence: sample.confidence,
      voiced: false,
    };
  }

  const note = noteInfoFromMidi(midiFloat);
  return {
    timeSec: sample.timeSec,
    frequency: sample.frequency,
    midiFloat,
    noteName: note.name,
    octave: note.octave,
    cents: note.cents,
    confidence: sample.confidence,
    voiced: true,
  };
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function setCurrentStatusColumns({
  cents = "",
  hz = "",
  midi = "",
  conf = "",
} = {}) {
  setText(els.currentCents, cents);
  setText(els.currentHz, hz);
  setText(els.currentMidi, midi);
  setText(els.currentConf, conf);

  const summary = `Current: ${cents} ${hz} ${midi} ${conf}`.replace(/\s+/g, " ").trim();
  setAttribute(els.currentStatus, "aria-label", summary);
  if (els.currentStatus.title !== summary) {
    els.currentStatus.title = summary;
  }
}

function setText(element, text) {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

function setAttribute(element, name, value) {
  if (element.getAttribute(name) !== String(value)) {
    element.setAttribute(name, value);
  }
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function samplesToMs(samples) {
  return (samples / MODEL_SAMPLE_RATE) * 1000;
}

function msToSamples(ms) {
  return Math.round((MODEL_SAMPLE_RATE * ms) / 1000);
}

function formatAdaptiveHopMs(ms) {
  if (ms >= 100) {
    return ms.toFixed(0);
  }
  return ms.toFixed(1);
}

function requestStatusUpdate() {
  if (state.ui.statusUpdatePending) {
    return;
  }

  const elapsed = nowMs() - state.ui.lastStatusUpdateAt;
  const delay = Math.max(0, STATUS_UPDATE_INTERVAL_MS - elapsed);
  state.ui.statusUpdatePending = true;

  const run = () => {
    state.ui.statusUpdateTimerId = null;
    state.ui.statusUpdateFrameId = null;
    flushStatusUpdate();
  };

  if (delay <= 0 && typeof requestAnimationFrame === "function") {
    state.ui.statusUpdateFrameId = requestAnimationFrame(run);
    return;
  }

  const timer = window.setTimeout || (typeof setTimeout === "function" ? setTimeout : null);
  if (timer) {
    state.ui.statusUpdateTimerId = timer(run, delay);
    return;
  }

  run();
}

function flushStatusUpdate() {
  if (
    state.ui.statusUpdateTimerId !== null
    && (window.clearTimeout || typeof clearTimeout === "function")
  ) {
    const clearTimer = window.clearTimeout || clearTimeout;
    clearTimer(state.ui.statusUpdateTimerId);
  }
  if (
    state.ui.statusUpdateFrameId !== null
    && typeof cancelAnimationFrame === "function"
  ) {
    cancelAnimationFrame(state.ui.statusUpdateFrameId);
  }

  state.ui.statusUpdatePending = false;
  state.ui.statusUpdateTimerId = null;
  state.ui.statusUpdateFrameId = null;
  state.ui.lastStatusUpdateAt = nowMs();
  renderStatusNow();
}

function updateStatus() {
  flushStatusUpdate();
}

function renderStatusNow() {
  const current = state.currentSample && csvRowForSample(state.currentSample);
  if (current && current.voiced) {
    const sign = current.cents >= 0 ? "+" : "";
    setCurrentStatusColumns({
      cents: `${sign}${current.cents.toFixed(0)} cent`,
      hz: `${current.frequency.toFixed(1)} Hz`,
      midi: `MIDI ${current.midiFloat.toFixed(2)}`,
      conf: `conf ${current.confidence.toFixed(2)}`,
    });
  } else if (state.currentSample) {
    setCurrentStatusColumns({
      conf: `conf ${state.currentSample.confidence.toFixed(2)}`,
    });
  } else {
    setCurrentStatusColumns();
  }

  if (isMultiMode()) {
    const notes = currentMultiNotes();
    setCurrentStatusColumns({ hz: `${notes.length} notes`, conf: "Multi F0" });
  }
  if (isTunerMode()) {
    setText(els.rangeStatus, `Tuner: ${midiLabel(getTunerCenterMidi())} ±50 cent`);
  } else {
    setText(els.rangeStatus, `Range: ${midiLabel(state.view.minMidi)}-${midiLabel(state.view.maxMidi)}`);
  }
  setText(els.windowStatus, `Window: ${state.view.visibleSeconds.toFixed(1)} s`);
  setRunningMessage();
  updateModeControls();
  updatePitchScrollbar();
}

function getCurrentNoteLabel() {
  if (isMultiMode()) return "";
  const current = state.currentSample && csvRowForSample(state.currentSample);
  if (!current || !current.voiced) {
    return "--";
  }
  return `${current.noteName}${current.octave}`;
}

function getSustainedDeviationLabel() {
  if (isMultiMode()) return "";
  const metric = state.sustainedDeviation;
  const current = state.currentSample;
  if (
    !current
    || !current.voiced
    || !Number.isFinite(current.midiFloat)
    || metric.displayMeanAbsCents === null
    || metric.noteMidi !== clamp(Math.round(current.midiFloat), HARD_MIN_MIDI, HARD_MAX_MIDI)
    || metric.lastVoicedTimeSec === null
    || current.timeSec - metric.lastVoicedTimeSec > NOTE_ROLL_MAX_GAP_SEC
  ) {
    return "";
  }

  return `MAD ${metric.displayMeanAbsCents.toFixed(1)} cent`;
}

function updatePitchScrollbar() {
  const trackHeight = Math.max(1, els.pitchScrollbar.clientHeight || state.canvas.height);
  const hardSpan = HARD_MAX_MIDI - HARD_MIN_MIDI;
  const pitchRange = getEffectivePitchRange();
  const minSpan = isTunerMode() ? TUNER_HALF_RANGE_MIDI * 2 : MIN_PITCH_SPAN;
  const span = clamp(pitchRange.maxMidi - pitchRange.minMidi, minSpan, hardSpan);
  const thumbHeight = clamp((span / hardSpan) * trackHeight, 24, trackHeight);
  const scrollableMidi = Math.max(0, hardSpan - span);
  const maxTop = Math.max(0, trackHeight - thumbHeight);
  const ratio = scrollableMidi === 0
    ? 0
    : clamp((HARD_MAX_MIDI - pitchRange.maxMidi) / scrollableMidi, 0, 1);
  const top = ratio * maxTop;
  const nextHeight = `${thumbHeight}px`;
  const nextTransform = `translateY(${top}px)`;
  const ariaNow = String(Math.round((pitchRange.minMidi + pitchRange.maxMidi) / 2));
  const ariaText = isTunerMode()
    ? `${midiLabel(pitchRange.centerMidi)} -50 to +50 cent`
    : `${midiLabel(pitchRange.minMidi)}-${midiLabel(pitchRange.maxMidi)}`;

  if (els.pitchScrollbarThumb.style.height !== nextHeight) {
    els.pitchScrollbarThumb.style.height = nextHeight;
  }
  if (els.pitchScrollbarThumb.style.transform !== nextTransform) {
    els.pitchScrollbarThumb.style.transform = nextTransform;
  }
  setAttribute(els.pitchScrollbar, "aria-valuemin", String(HARD_MIN_MIDI));
  setAttribute(els.pitchScrollbar, "aria-valuemax", String(HARD_MAX_MIDI));
  setAttribute(els.pitchScrollbar, "aria-valuenow", ariaNow);
  setAttribute(els.pitchScrollbar, "aria-valuetext", ariaText);
}

function animationLoop() {
  state.animationFrameId = null;
  draw();
  if (state.micState === "running") {
    startAnimationLoop();
  }
}

function draw() {
  if (state.renderer.useWorker) {
    drawWithWorker();
    return;
  }

  const backgroundKey = getBackgroundKey();
  if (state.canvas.backgroundDirty || state.canvas.backgroundKey !== backgroundKey) {
    drawBackground();
    state.canvas.backgroundDirty = false;
    state.canvas.backgroundKey = backgroundKey;
  }
  drawTrace();
}

function getBackgroundKey() {
  const pitchRange = getEffectivePitchRange();
  return [
    state.view.mode,
    state.canvas.width.toFixed(1),
    state.canvas.height.toFixed(1),
    state.view.visibleSeconds.toFixed(3),
    pitchRange.minMidi.toFixed(3),
    pitchRange.maxMidi.toFixed(3),
    getRightTime().toFixed(3),
  ].join(":");
}

function drawBackground() {
  const ctx = els.backgroundCanvas.getContext("2d");
  const width = state.canvas.width;
  const height = state.canvas.height;
  ctx.clearRect(0, 0, width, height);
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, UI_THEME.canvasBgTop);
  background.addColorStop(1, UI_THEME.canvasBgBottom);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const rightTime = getRightTime();
  const leftTime = rightTime - state.view.visibleSeconds;
  const timeStep = chooseTimeGridStep(state.view.visibleSeconds);

  if (isTunerMode()) {
    drawTunerPitchGrid(ctx, width);
  } else {
    for (let midi = Math.floor(state.view.minMidi); midi <= Math.ceil(state.view.maxMidi); midi += 1) {
      const yTop = midiToY(midi + 0.5);
      const yBottom = midiToY(midi - 0.5);
      const noteIndex = positiveModulo(Math.round(midi), 12);
      const isAccidental = NOTE_NAMES[noteIndex].includes("♯") || NOTE_NAMES[noteIndex].includes("♭");
      if (isAccidental) {
        ctx.fillStyle = UI_THEME.accidentalBand;
        ctx.fillRect(0, Math.min(yTop, yBottom), width, Math.abs(yBottom - yTop));
      }

      ctx.beginPath();
      ctx.moveTo(0, midiToY(midi));
      ctx.lineTo(width, midiToY(midi));
      ctx.strokeStyle = noteIndex === 0 ? UI_THEME.cLine : UI_THEME.pitchLine;
      ctx.lineWidth = noteIndex === 0 ? 1.25 : 0.8;
      ctx.stroke();
    }
  }

  const firstGridTime = Math.ceil(leftTime / timeStep) * timeStep;
  for (let t = firstGridTime; t <= rightTime + timeStep; t += timeStep) {
    const x = timeToX(t, rightTime);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.strokeStyle = Math.abs(t % 1) < 1e-6 ? UI_THEME.timeLineStrong : UI_THEME.timeLine;
    ctx.lineWidth = Math.abs(t % 1) < 1e-6 ? 0.8 : 0.6;
    ctx.stroke();

    if (x > PITCH_AXIS_WIDTH && x < width - 12) {
      ctx.fillStyle = UI_THEME.timeLabel;
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(`${Math.max(0, t).toFixed(1)}s`, x + 4, 15);
    }
  }

  ctx.fillStyle = UI_THEME.axisBg;
  ctx.fillRect(0, 0, PITCH_AXIS_WIDTH, height);
  if (isTunerMode()) {
    drawTunerPitchAxis(ctx, height);
  } else {
    drawPitchAxisKeyboard(ctx, height);
  }
  ctx.strokeStyle = UI_THEME.axisLine;
  ctx.beginPath();
  ctx.moveTo(PITCH_AXIS_WIDTH, 0);
  ctx.lineTo(PITCH_AXIS_WIDTH, height);
  ctx.stroke();

  if (!isTunerMode()) {
    const pitchLabelStep = choosePitchLabelStep();
    let lastLabelY = -Infinity;
    for (let midi = Math.floor(state.view.minMidi); midi <= Math.ceil(state.view.maxMidi); midi += 1) {
      const noteIndex = positiveModulo(Math.round(midi), 12);
      const y = midiToY(midi);
      if (y < -10 || y > height + 10) {
        continue;
      }
      if (positiveModulo(Math.round(midi), pitchLabelStep) !== 0 || Math.abs(y - lastLabelY) < 15) {
        continue;
      }
      lastLabelY = y;

      ctx.fillStyle = noteIndex === 0 ? UI_THEME.labelStrong : UI_THEME.label;
      ctx.font = noteIndex === 0 ? "700 11px ui-sans-serif, system-ui, sans-serif" : "11px ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(midiLabel(midi), 8, y);
    }
  }
}

function drawTunerPitchGrid(ctx, width) {
  const centerMidi = getTunerCenterMidi();
  for (let cents = -50; cents <= 50; cents += TUNER_CENT_GRID_STEP) {
    const y = midiToY(centerMidi + cents / 100);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.strokeStyle = cents === 0 ? UI_THEME.cLine : UI_THEME.pitchLine;
    ctx.lineWidth = cents === 0 ? 1.35 : 0.75;
    ctx.stroke();
  }
}

function drawTunerPitchAxis(ctx, height) {
  const centerMidi = getTunerCenterMidi();
  const axisRight = PITCH_AXIS_WIDTH - 1;
  let lastLabelY = -Infinity;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, PITCH_AXIS_WIDTH, height);
  ctx.clip();
  ctx.textBaseline = "middle";

  for (let cents = 50; cents >= -50; cents -= TUNER_CENT_GRID_STEP) {
    const y = midiToY(centerMidi + cents / 100);
    const isCenter = cents === 0;
    const isEdge = Math.abs(cents) === 50;
    const tickLength = isCenter ? 26 : isEdge ? 18 : 10;

    ctx.strokeStyle = isCenter ? UI_THEME.cLine : UI_THEME.axisLine;
    ctx.lineWidth = isCenter ? 1.2 : 0.8;
    ctx.beginPath();
    ctx.moveTo(axisRight - tickLength, y);
    ctx.lineTo(axisRight, y);
    ctx.stroke();

    if (!isCenter && !isEdge && Math.abs(cents) % 20 !== 0) {
      continue;
    }
    if (Math.abs(y - lastLabelY) < 15) {
      continue;
    }

    lastLabelY = y;
    ctx.fillStyle = isCenter ? UI_THEME.labelStrong : UI_THEME.label;
    ctx.font = isCenter ? "700 11px ui-sans-serif, system-ui, sans-serif" : "10px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(isCenter ? midiLabel(centerMidi) : formatCentLabel(cents), 8, y);
  }

  ctx.restore();
}

function formatCentLabel(cents) {
  if (cents > 0) {
    return `+${cents}`;
  }
  return String(cents);
}

function drawPitchAxisKeyboard(ctx, height) {
  const axisRight = PITCH_AXIS_WIDTH - 1;
  const blackKeyWidth = Math.round(PITCH_AXIS_WIDTH * 0.62);
  const firstMidi = Math.floor(state.view.minMidi) - 1;
  const lastMidi = Math.ceil(state.view.maxMidi) + 1;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, PITCH_AXIS_WIDTH, height);
  ctx.clip();

  for (let midi = firstMidi; midi <= lastMidi; midi += 1) {
    const noteIndex = positiveModulo(Math.round(midi), 12);
    if (NOTE_NAMES[noteIndex].includes("♯") || NOTE_NAMES[noteIndex].includes("♭")) {
      continue;
    }

    const yTop = midiToY(midi + 0.5);
    const yBottom = midiToY(midi - 0.5);
    const top = Math.min(yTop, yBottom);
    const keyHeight = Math.abs(yBottom - yTop);
    ctx.fillStyle = noteIndex === 0
      ? UI_THEME.whiteKeyC
      : UI_THEME.whiteKey;
    ctx.fillRect(0, top, axisRight, keyHeight);

    ctx.strokeStyle = noteIndex === 0
      ? UI_THEME.whiteKeyLineC
      : UI_THEME.whiteKeyLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(top) + 0.5);
    ctx.lineTo(axisRight, Math.round(top) + 0.5);
    ctx.stroke();
  }

  for (let midi = firstMidi; midi <= lastMidi; midi += 1) {
    const noteIndex = positiveModulo(Math.round(midi), 12);
    if (!(NOTE_NAMES[noteIndex].includes("♯") || NOTE_NAMES[noteIndex].includes("♭"))) {
      continue;
    }

    const yTop = midiToY(midi + 0.5);
    const yBottom = midiToY(midi - 0.5);
    const top = Math.min(yTop, yBottom);
    const keyHeight = Math.abs(yBottom - yTop);
    const inset = Math.max(0.5, Math.min(2, keyHeight * 0.08));
    const keyTop = top + inset;
    const visibleHeight = Math.max(1, keyHeight - inset * 2);

    ctx.fillStyle = UI_THEME.blackKey;
    ctx.fillRect(0, keyTop, blackKeyWidth, visibleHeight);
    ctx.strokeStyle = UI_THEME.blackKeyLine;
    ctx.beginPath();
    ctx.moveTo(blackKeyWidth + 0.5, keyTop);
    ctx.lineTo(blackKeyWidth + 0.5, keyTop + visibleHeight);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTrace() {
  const ctx = els.traceCanvas.getContext("2d");
  const width = state.canvas.width;
  const height = state.canvas.height;
  const rightTime = getRightTime();
  const leftTime = rightTime - state.view.visibleSeconds;
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(PITCH_AXIS_WIDTH, 0, Math.max(0, width - PITCH_AXIS_WIDTH), height);
  ctx.clip();

  const tunerMode = isTunerMode();
  if (!tunerMode && !isMultiMode()) {
    drawDetectedNoteRoll(ctx, leftTime, rightTime, getEffectivePitchRange());

    let segmentOpen = false;
    let previous = null;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(37, 223, 210, 0.55)";
    ctx.shadowBlur = 9;

    for (const sample of state.pitchSamples) {
      if (!sampleIsVisible(sample, leftTime, rightTime)) {
        if (segmentOpen) {
          ctx.stroke();
        }
        previous = null;
        segmentOpen = false;
        continue;
      }

      const x = timeToX(sample.timeSec, rightTime);
      const y = midiToY(sample.midiFloat);
      const alpha = clamp(0.35 + sample.confidence * 0.6, 0.35, 0.95);
      ctx.strokeStyle = `rgba(${UI_THEME.trace}, ${alpha})`;

      if (!previous || sample.timeSec - previous.timeSec > 0.08) {
        if (segmentOpen) {
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(x, y);
        segmentOpen = true;
      } else {
        ctx.lineTo(x, y);
      }
      previous = sample;
    }

    if (segmentOpen) {
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
  for (const sample of state.pitchSamples) {
    if (!sampleIsVisible(sample, leftTime, rightTime)) {
      continue;
    }
    const x = timeToX(sample.timeSec, rightTime);
    const y = midiToY(sample.midiFloat);
    if (isMultiMode()) {
      drawMultiPoint(ctx, x, y, sample);
      continue;
    }
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = sample.confidence >= HIGH_CONFIDENCE_THRESHOLD ? UI_THEME.traceHot : UI_THEME.traceWarm;
    ctx.fill();
  }

  if (tunerMode) {
    drawTunerAverageTrace(ctx, leftTime, rightTime);
  }

  ctx.strokeStyle = UI_THEME.now;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = "rgba(255, 77, 141, 0.52)";
  ctx.shadowBlur = 10;
  const currentTimeX = state.view.followNow && state.latestTimeSec > 0
    ? timeToX(state.latestTimeSec, rightTime)
    : width - 1;
  ctx.beginPath();
  ctx.moveTo(currentTimeX, 0);
  ctx.lineTo(currentTimeX, height);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (state.view.hoverSample) {
    const x = timeToX(state.view.hoverSample.timeSec, rightTime);
    const y = midiToY(state.view.hoverSample.midiFloat);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = UI_THEME.hoverFill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = UI_THEME.traceWarm;
    ctx.stroke();
  }
  drawSelectionRange(ctx);
  drawCurrentNoteLabel(ctx, getCurrentNoteLabel(), getSustainedDeviationLabel());
  ctx.restore();
}

function drawSelectionRange(ctx) {
  const range = state.view.selectionRange;
  if (!range || range.width <= 0 || range.height <= 0) {
    return;
  }

  const left = clamp(range.left, PITCH_AXIS_WIDTH, state.canvas.width);
  const top = clamp(range.top, 0, state.canvas.height);
  const width = clamp(range.width, 0, state.canvas.width - left);
  const height = clamp(range.height, 0, state.canvas.height - top);
  if (width <= 0 || height <= 0) {
    return;
  }

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = UI_THEME.selectionFill;
  ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = UI_THEME.selectionStroke;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.rect(left + 0.5, top + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  ctx.stroke();
  ctx.restore();
}

function drawDetectedNoteRoll(ctx, leftTime, rightTime, pitchRange) {
  const noteEvents = detectGraphNoteEvents(leftTime, rightTime, pitchRange);
  if (noteEvents.length === 0) {
    return;
  }

  ctx.save();
  ctx.shadowBlur = 0;
  for (const event of noteEvents) {
    const x1 = clamp(timeToX(event.startTime, rightTime), PITCH_AXIS_WIDTH, state.canvas.width);
    const x2 = clamp(timeToX(event.endTime, rightTime), PITCH_AXIS_WIDTH, state.canvas.width);
    const width = Math.max(NOTE_ROLL_MIN_WIDTH_PX, x2 - x1);
    const yTop = midiToY(event.noteMidi + 0.45);
    const yBottom = midiToY(event.noteMidi - 0.45);
    const top = Math.min(yTop, yBottom);
    const height = Math.max(2, Math.abs(yBottom - yTop));
    const confidence = graphNoteConfidenceRatio(event.confidence);
    const fillAlpha = clamp(0.10 + confidence * 0.25, 0.10, 0.35);
    const edgeAlpha = clamp(fillAlpha + 0.10, 0.16, 0.42);

    ctx.fillStyle = `rgba(${UI_THEME.noteRoll}, ${fillAlpha})`;
    ctx.fillRect(x1, top, width, height);
    ctx.fillStyle = `rgba(${UI_THEME.noteRollEdge}, ${edgeAlpha})`;
    ctx.fillRect(x1, top, width, 1);
    ctx.fillRect(x1, top + height - 1, width, 1);
  }
  ctx.restore();
}

function detectGraphNoteEvents(leftTime, rightTime, pitchRange) {
  const events = [];
  const threshold = getConfidenceThreshold();
  let current = null;
  let previousUsableTime = null;

  for (const sample of state.pitchSamples) {
    if (!sample || sample.timeSec < leftTime) {
      continue;
    }
    if (sample.timeSec > rightTime) {
      break;
    }

    if (!graphNoteSampleIsUsable(sample, threshold)) {
      finishGraphNoteEvent(events, current, leftTime, rightTime);
      current = null;
      previousUsableTime = null;
      continue;
    }

    const noteMidi = clamp(Math.round(sample.midiFloat), HARD_MIN_MIDI, HARD_MAX_MIDI);
    const gap = previousUsableTime === null ? Infinity : sample.timeSec - previousUsableTime;
    const sameEvent = current
      && gap <= NOTE_ROLL_MAX_GAP_SEC
      && Math.abs(sample.midiFloat - current.noteMidi) <= NOTE_ROLL_PITCH_TOLERANCE_MIDI;

    if (!sameEvent) {
      finishGraphNoteEvent(events, current, leftTime, rightTime);
      current = startGraphNoteEvent(sample, noteMidi, threshold);
    } else {
      appendGraphNoteEvent(current, sample, threshold);
    }

    previousUsableTime = sample.timeSec;
  }

  finishGraphNoteEvent(events, current, leftTime, rightTime);
  return events.filter((event) => graphNoteEventIntersectsPitchRange(event, pitchRange));
}

function graphNoteSampleIsUsable(sample, threshold) {
  return sample.confidence >= threshold
    && sample.frequency > 0
    && Number.isFinite(sample.midiFloat)
    && sample.midiFloat >= HARD_MIN_MIDI
    && sample.midiFloat <= HARD_MAX_MIDI;
}

function startGraphNoteEvent(sample, noteMidi, threshold) {
  const weight = graphNoteConfidenceWeight(sample.confidence, threshold);
  return {
    startTime: sample.timeSec,
    lastTime: sample.timeSec,
    noteMidi,
    weightedMidi: sample.midiFloat * weight,
    weightSum: weight,
    confidenceSum: sample.confidence,
    samples: 1,
    stepSum: 0,
    stepCount: 0,
  };
}

function appendGraphNoteEvent(event, sample, threshold) {
  const weight = graphNoteConfidenceWeight(sample.confidence, threshold);
  const step = sample.timeSec - event.lastTime;
  if (Number.isFinite(step) && step > 0) {
    event.stepSum += step;
    event.stepCount += 1;
  }
  event.lastTime = sample.timeSec;
  event.weightedMidi += sample.midiFloat * weight;
  event.weightSum += weight;
  event.confidenceSum += sample.confidence;
  event.samples += 1;
  event.noteMidi = clamp(Math.round(event.weightedMidi / event.weightSum), HARD_MIN_MIDI, HARD_MAX_MIDI);
}

function finishGraphNoteEvent(events, event, leftTime, rightTime) {
  if (!event || event.samples <= 0) {
    return;
  }

  const confidence = event.confidenceSum / event.samples;
  const duration = Math.max(0, event.lastTime - event.startTime);
  if (duration < NOTE_ROLL_MIN_DURATION_SEC && event.samples < 2 && confidence < HIGH_CONFIDENCE_THRESHOLD) {
    return;
  }

  const averageStep = event.stepCount > 0
    ? clamp(event.stepSum / event.stepCount, 0.005, NOTE_ROLL_MAX_GAP_SEC)
    : NOTE_ROLL_SINGLE_SAMPLE_SEC;
  events.push({
    startTime: Math.max(leftTime, event.startTime - averageStep * 0.5),
    endTime: Math.min(rightTime, event.lastTime + averageStep * 0.5),
    noteMidi: event.noteMidi,
    confidence,
  });
}

function graphNoteEventIntersectsPitchRange(event, pitchRange) {
  return event.noteMidi + 0.5 >= pitchRange.minMidi
    && event.noteMidi - 0.5 <= pitchRange.maxMidi
    && event.endTime > event.startTime;
}

function graphNoteConfidenceWeight(confidence, threshold) {
  return 0.25 + graphNoteConfidenceRatio(confidence, threshold) * 0.75;
}

function graphNoteConfidenceRatio(confidence, threshold = getConfidenceThreshold()) {
  const usableSpan = Math.max(0.001, 1 - threshold);
  return clamp((confidence - threshold) / usableSpan, 0, 1);
}

function getConfidenceThreshold() {
  return state.analysis.confidenceThreshold;
}

function drawCurrentNoteLabel(ctx, noteLabel, deviationLabel = "") {
  if (!noteLabel) {
    return;
  }

  const x = PITCH_AXIS_WIDTH + 14;
  const y = Math.max(34, state.canvas.height - 16);
  ctx.save();
  ctx.font = CURRENT_NOTE_LABEL_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.72)";
  ctx.shadowBlur = 10;
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(7, 11, 16, 0.82)";
  ctx.strokeText(noteLabel, x, y);
  ctx.fillStyle = UI_THEME.labelStrong;
  ctx.fillText(noteLabel, x, y);

  if (deviationLabel) {
    const noteWidth = measureTextWidth(ctx, noteLabel, noteLabel.length * 24);
    const deviationX = x + noteWidth + CURRENT_DEVIATION_LABEL_GAP_PX;
    const availableWidth = state.canvas.width - deviationX - 8;
    if (availableWidth >= 68) {
      ctx.font = currentDeviationLabelFont(CURRENT_DEVIATION_LABEL_FONT_SIZE);
      const deviationWidth = measureTextWidth(ctx, deviationLabel, deviationLabel.length * 8);
      if (deviationWidth > availableWidth) {
        const scaledSize = clamp(
          Math.floor(CURRENT_DEVIATION_LABEL_FONT_SIZE * (availableWidth / deviationWidth)),
          12,
          CURRENT_DEVIATION_LABEL_FONT_SIZE,
        );
        ctx.font = currentDeviationLabelFont(scaledSize);
      }
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(7, 11, 16, 0.78)";
      ctx.strokeText(deviationLabel, deviationX, y - 2);
      ctx.fillStyle = UI_THEME.label;
      ctx.fillText(deviationLabel, deviationX, y - 2);
    }
  }
  ctx.restore();
}

function currentDeviationLabelFont(size) {
  return `700 ${size}px ${CURRENT_DEVIATION_LABEL_FONT_FAMILY}`;
}

function measureTextWidth(ctx, text, fallbackWidth) {
  if (typeof ctx.measureText !== "function") {
    return fallbackWidth;
  }
  const metrics = ctx.measureText(text);
  return metrics && Number.isFinite(metrics.width) ? metrics.width : fallbackWidth;
}

function drawTunerAverageTrace(ctx, leftTime, rightTime) {
  let segmentOpen = false;
  let previous = null;
  let latest = null;

  ctx.save();
  ctx.lineWidth = 2.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = UI_THEME.tunerAverage;
  ctx.shadowColor = "rgba(255, 183, 3, 0.38)";
  ctx.shadowBlur = 8;
  ctx.setLineDash([]);

  for (const sample of state.pitchSamples) {
    if (!tunerAverageSampleIsVisible(sample, leftTime, rightTime)) {
      if (segmentOpen) {
        ctx.stroke();
      }
      previous = null;
      segmentOpen = false;
      continue;
    }

    const x = timeToX(sample.timeSec, rightTime);
    const y = midiToY(sample.tunerAverageMidi);
    if (!previous || sample.timeSec - previous.timeSec > 0.12) {
      if (segmentOpen) {
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x, y);
      segmentOpen = true;
    } else {
      ctx.lineTo(x, y);
    }

    previous = sample;
    latest = { x, y };
  }

  if (segmentOpen) {
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  if (latest) {
    ctx.beginPath();
    ctx.arc(latest.x, latest.y, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = UI_THEME.tunerAverage;
    ctx.fill();
  }
  ctx.restore();
}

function tunerAverageSampleIsVisible(sample, leftTime, rightTime) {
  const pitchRange = getEffectivePitchRange();
  return sample.timeSec >= leftTime
    && sample.timeSec <= rightTime
    && Number.isFinite(sample.tunerAverageMidi)
    && sample.tunerAverageMidi >= pitchRange.minMidi
    && sample.tunerAverageMidi <= pitchRange.maxMidi;
}

function sampleIsVisible(sample, leftTime, rightTime) {
  const pitchRange = getEffectivePitchRange();
  return sample.timeSec >= leftTime
    && sample.timeSec <= rightTime
    && sample.confidence >= state.analysis.confidenceThreshold
    && sample.frequency > 0
    && Number.isFinite(sample.midiFloat)
    && sample.midiFloat >= pitchRange.minMidi
    && sample.midiFloat <= pitchRange.maxMidi;
}

function chooseTimeGridStep(seconds) {
  const minimumStep = seconds * 56 / Math.max(1, state.canvas.width - PITCH_AXIS_WIDTH);
  if (isMultiMode()) return [0.25, 0.5, 1, 2, 5, 10, 20].find(step => step >= minimumStep) || 20;
  if (seconds <= 4) {
    return 0.25;
  }
  if (seconds <= 8) {
    return 0.5;
  }
  if (seconds <= 20) {
    return 1;
  }
  if (seconds <= 40) {
    return 2;
  }
  return 5;
}

function choosePitchLabelStep() {
  const span = Math.max(MIN_PITCH_SPAN, state.view.maxMidi - state.view.minMidi);
  const semitonePixels = Math.max(0.1, state.canvas.height / span);
  const needed = Math.ceil(15 / semitonePixels);
  if (needed <= 1) {
    return 1;
  }
  if (needed <= 2) {
    return 2;
  }
  if (needed <= 3) {
    return 3;
  }
  if (needed <= 4) {
    return 4;
  }
  if (needed <= 6) {
    return 6;
  }
  return 12;
}

function getRightTime() {
  if (state.view.followNow) {
    return Math.max(state.view.visibleSeconds, state.latestTimeSec + getScrollbarLeadSeconds());
  }
  return Math.max(state.view.visibleSeconds, state.view.manualRightTime);
}

function getScrollbarLeadSeconds() {
  const pixelsPerSecond = Math.max(1, state.canvas.width - PITCH_AXIS_WIDTH) / state.view.visibleSeconds;
  return getScrollbarOverlapWidth() / pixelsPerSecond;
}

function getScrollbarOverlapWidth() {
  const fallback = 22;
  if (!els.pitchScrollbar || !els.canvasWrap) {
    return fallback;
  }

  const wrapRect = els.canvasWrap.getBoundingClientRect();
  const scrollbarRect = els.pitchScrollbar.getBoundingClientRect();
  if (wrapRect.width <= 0 || scrollbarRect.width <= 0) {
    return fallback;
  }

  return clamp(
    wrapRect.right - scrollbarRect.left + SCROLLBAR_TIME_CLEARANCE_PX,
    0,
    Math.max(0, state.canvas.width - PITCH_AXIS_WIDTH),
  );
}

function timeToX(timeSec, rightTime = getRightTime()) {
  const drawableWidth = Math.max(1, state.canvas.width - PITCH_AXIS_WIDTH);
  const pixelsPerSecond = drawableWidth / state.view.visibleSeconds;
  return state.canvas.width - (rightTime - timeSec) * pixelsPerSecond;
}

function xToTime(x, rightTime = getRightTime()) {
  const drawableWidth = Math.max(1, state.canvas.width - PITCH_AXIS_WIDTH);
  const pixelsPerSecond = drawableWidth / state.view.visibleSeconds;
  return rightTime - (state.canvas.width - x) / pixelsPerSecond;
}

function midiToY(midi) {
  const pitchRange = getEffectivePitchRange();
  const span = pitchRange.maxMidi - pitchRange.minMidi;
  return state.canvas.height - ((midi - pitchRange.minMidi) / span) * state.canvas.height;
}

function yToMidi(y) {
  const pitchRange = getEffectivePitchRange();
  const span = pitchRange.maxMidi - pitchRange.minMidi;
  return pitchRange.minMidi + ((state.canvas.height - y) / state.canvas.height) * span;
}

function frequencyToMidi(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }
  return 69 + 12 * Math.log2(frequency / 440);
}

function noteInfoFromMidi(midiFloat) {
  const nearestMidi = Math.round(midiFloat);
  const noteIndex = positiveModulo(nearestMidi, 12);
  return {
    midi: nearestMidi,
    name: NOTE_NAMES[noteIndex],
    octave: Math.floor(nearestMidi / 12) - 1,
    cents: 100 * (midiFloat - nearestMidi),
  };
}

function midiLabel(midiValue) {
  const midi = Math.round(midiValue);
  const note = noteInfoFromMidi(midi);
  return `${note.name}${note.octave}`;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function autoScrollPitchToSample(sample) {
  if (!sample || !sample.voiced || !Number.isFinite(sample.midiFloat)) {
    return false;
  }

  if (isTunerMode()) {
    return setTunerCenterFromSample(sample);
  }

  const span = clamp(state.view.maxMidi - state.view.minMidi, MIN_PITCH_SPAN, HARD_MAX_MIDI - HARD_MIN_MIDI);
  const margin = Math.min(PITCH_AUTO_SCROLL_MARGIN_MIDI, Math.max(0, span / 2 - 0.25));
  let nextMin = state.view.minMidi;
  let nextMax = state.view.maxMidi;

  if (sample.midiFloat < nextMin + margin) {
    nextMin = sample.midiFloat - margin;
    nextMax = nextMin + span;
  } else if (sample.midiFloat > nextMax - margin) {
    nextMax = sample.midiFloat + margin;
    nextMin = nextMax - span;
  } else {
    return false;
  }

  if (nextMin < HARD_MIN_MIDI) {
    nextMin = HARD_MIN_MIDI;
    nextMax = nextMin + span;
  }
  if (nextMax > HARD_MAX_MIDI) {
    nextMax = HARD_MAX_MIDI;
    nextMin = nextMax - span;
  }

  if (Math.abs(nextMin - state.view.minMidi) < 0.001 && Math.abs(nextMax - state.view.maxMidi) < 0.001) {
    return false;
  }

  state.view.minMidi = nextMin;
  state.view.maxMidi = nextMax;
  normalizePitchRange();
  return true;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function zoomTime(factor, anchorX = state.canvas.width - 1) {
  if (isUploadProcessing()) {
    return;
  }

  const rightTime = getRightTime();
  const anchorTime = xToTime(anchorX, rightTime);
  const oldVisible = state.view.visibleSeconds;
  const nextVisible = clamp(oldVisible * factor, 2, 60);
  const anchorRatio = (state.canvas.width - anchorX) / Math.max(1, state.canvas.width - PITCH_AXIS_WIDTH);
  state.view.visibleSeconds = nextVisible;

  if (!state.view.followNow) {
    state.view.manualRightTime = anchorTime + anchorRatio * nextVisible;
  }

  saveSettings();
  markBackgroundDirty();
  updateStatus();
  draw();
}

function zoomPitch(factor, anchorY = state.canvas.height / 2) {
  if (isUploadProcessing() || isTunerMode()) {
    return;
  }

  const anchorMidi = yToMidi(anchorY);
  const oldMin = state.view.minMidi;
  const oldMax = state.view.maxMidi;
  const oldSpan = oldMax - oldMin;
  const newSpan = clamp(oldSpan * factor, MIN_PITCH_SPAN, HARD_MAX_MIDI - HARD_MIN_MIDI);
  const anchorRatio = (anchorMidi - oldMin) / oldSpan;
  let nextMin = anchorMidi - newSpan * anchorRatio;
  let nextMax = nextMin + newSpan;

  if (nextMin < HARD_MIN_MIDI) {
    nextMin = HARD_MIN_MIDI;
    nextMax = nextMin + newSpan;
  }
  if (nextMax > HARD_MAX_MIDI) {
    nextMax = HARD_MAX_MIDI;
    nextMin = nextMax - newSpan;
  }

  state.view.minMidi = nextMin;
  state.view.maxMidi = nextMax;
  normalizePitchRange();
  saveSettings();
  markBackgroundDirty();
  updateStatus();
  draw();
}

function panPitch(deltaMidi) {
  if (isUploadProcessing() || isTunerMode()) {
    return;
  }

  const span = state.view.maxMidi - state.view.minMidi;
  let nextMin = state.view.minMidi + deltaMidi;
  nextMin = clamp(nextMin, HARD_MIN_MIDI, HARD_MAX_MIDI - span);
  state.view.minMidi = nextMin;
  state.view.maxMidi = nextMin + span;
  saveSettings();
  markBackgroundDirty();
  updateStatus();
  draw();
}

function setPitchRangeFromScrollbarTop(top) {
  if (isUploadProcessing() || isTunerMode()) {
    return;
  }

  const trackHeight = Math.max(1, els.pitchScrollbar.clientHeight || state.canvas.height);
  const hardSpan = HARD_MAX_MIDI - HARD_MIN_MIDI;
  const span = clamp(state.view.maxMidi - state.view.minMidi, MIN_PITCH_SPAN, hardSpan);
  const thumbHeight = clamp((span / hardSpan) * trackHeight, 24, trackHeight);
  const maxTop = Math.max(0, trackHeight - thumbHeight);
  const scrollableMidi = Math.max(0, hardSpan - span);
  const ratio = maxTop === 0 ? 0 : clamp(top, 0, maxTop) / maxTop;
  const nextMax = HARD_MAX_MIDI - ratio * scrollableMidi;

  state.view.minMidi = nextMax - span;
  state.view.maxMidi = nextMax;
  normalizePitchRange();
  saveSettings();
  markBackgroundDirty();
  updateStatus();
  draw();
}

function panTime(deltaSeconds) {
  if (isUploadProcessing()) {
    return;
  }

  if (state.view.followNow) {
    state.view.followNow = false;
    state.view.manualRightTime = getRightTime();
  }
  state.view.manualRightTime = clamp(
    state.view.manualRightTime + deltaSeconds,
    state.view.visibleSeconds,
    Math.max(state.view.visibleSeconds, state.latestTimeSec + state.view.visibleSeconds),
  );
  updateStatus();
  markBackgroundDirty();
  draw();
}

function handleWheel(event) {
  event.preventDefault();
  if (isUploadProcessing()) {
    return;
  }

  const rect = els.canvasWrap.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (event.shiftKey) {
    zoomTime(event.deltaY < 0 ? 0.85 : 1.18, x);
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    if (isTunerMode()) {
      return;
    }
    zoomPitch(event.deltaY < 0 ? 0.8 : 1.25, y);
    return;
  }

  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    const pixelsPerSecond = Math.max(1, state.canvas.width - PITCH_AXIS_WIDTH) / state.view.visibleSeconds;
    panTime(event.deltaX / pixelsPerSecond);
    return;
  }

  if (isTunerMode()) {
    return;
  }

  const midiPerPixel = (state.view.maxMidi - state.view.minMidi) / Math.max(1, state.canvas.height);
  panPitch(event.deltaY * midiPerPixel);
}

function handlePitchScrollbarPointerDown(event) {
  event.preventDefault();
  event.stopPropagation();
  if (isUploadProcessing() || isTunerMode()) {
    return;
  }

  const trackRect = els.pitchScrollbar.getBoundingClientRect();
  const thumbRect = els.pitchScrollbarThumb.getBoundingClientRect();
  const clickedThumb = event.target === els.pitchScrollbarThumb;
  const pointerTop = event.clientY - trackRect.top;
  const thumbTop = thumbRect.top - trackRect.top;
  const offsetY = clickedThumb ? pointerTop - thumbTop : thumbRect.height / 2;

  state.view.pitchScrollbarDrag = { pointerId: event.pointerId, offsetY };
  try {
    els.pitchScrollbar.setPointerCapture(event.pointerId);
  } catch (error) {
    // Synthetic pointer events may not have an active pointer capture target.
  }
  setPitchRangeFromScrollbarTop(pointerTop - offsetY);
}

function handlePitchScrollbarPointerMove(event) {
  if (isUploadProcessing()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const drag = state.view.pitchScrollbarDrag;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const trackRect = els.pitchScrollbar.getBoundingClientRect();
  setPitchRangeFromScrollbarTop(event.clientY - trackRect.top - drag.offsetY);
}

function handlePitchScrollbarPointerUp(event) {
  if (isUploadProcessing()) {
    event.stopPropagation();
    state.view.pitchScrollbarDrag = null;
    return;
  }

  const drag = state.view.pitchScrollbarDrag;
  if (drag && drag.pointerId === event.pointerId) {
    event.stopPropagation();
    state.view.pitchScrollbarDrag = null;
  }
}

function isPrimaryMouseOrNonMousePointer(event) {
  return event.pointerType !== "mouse" || event.button === 0;
}

function canvasPointFromPointerEvent(event) {
  const rect = els.canvasWrap.getBoundingClientRect();
  return clampCanvasPoint(event.clientX - rect.left, event.clientY - rect.top);
}

function clampCanvasPoint(x, y) {
  return {
    x: clamp(x, PITCH_AXIS_WIDTH, state.canvas.width),
    y: clamp(y, 0, state.canvas.height),
  };
}

function selectionRangeFromPoints(startX, startY, endX, endY) {
  const start = clampCanvasPoint(startX, startY);
  const end = clampCanvasPoint(endX, endY);
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const timeA = xToTime(left);
  const timeB = xToTime(right);
  const midiA = yToMidi(top);
  const midiB = yToMidi(bottom);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    timeMin: Math.min(timeA, timeB),
    timeMax: Math.max(timeA, timeB),
    midiMin: Math.min(midiA, midiB),
    midiMax: Math.max(midiA, midiB),
  };
}

function selectionHasUsableArea(range) {
  return Boolean(range)
    && range.width >= RANGE_SELECTION_MIN_SIZE_PX
    && range.height >= RANGE_SELECTION_MIN_SIZE_PX;
}

function clearSelectionRange() {
  state.view.selectionRange = null;
}

function scheduleRangeLongPress(drag) {
  if (drag.pointerType === "mouse") {
    return;
  }

  const setTimer = window.setTimeout || (typeof setTimeout === "function" ? setTimeout : null);
  if (typeof setTimer !== "function") {
    return;
  }

  drag.longPressTimerId = setTimer(() => {
    if (state.view.pointerDrag !== drag || drag.mode !== "pending") {
      return;
    }
    drag.longPressTimerId = null;
    startRangeSelection(drag, {
      x: drag.currentX,
      y: drag.currentY,
    });
  }, RANGE_LONG_PRESS_MS);
}

function clearRangeLongPressTimer(drag) {
  if (!drag || drag.longPressTimerId === null || drag.longPressTimerId === undefined) {
    return;
  }

  const clearTimer = window.clearTimeout || (typeof clearTimeout === "function" ? clearTimeout : null);
  if (typeof clearTimer === "function") {
    clearTimer(drag.longPressTimerId);
  }
  drag.longPressTimerId = null;
}

function startRangeSelection(drag, point) {
  clearRangeLongPressTimer(drag);
  drag.mode = "selection";
  drag.moved = true;
  state.view.hoverSample = null;
  updateRangeSelection(drag, point);
}

function updateRangeSelection(drag, point) {
  drag.currentX = point.x;
  drag.currentY = point.y;
  state.view.selectionRange = selectionRangeFromPoints(
    drag.startX,
    drag.startY,
    drag.currentX,
    drag.currentY,
  );
  showSelectionHint(state.view.selectionRange, drag.currentX, drag.currentY);
  draw();
}

function startPanDrag(drag) {
  clearRangeLongPressTimer(drag);
  drag.mode = "pan";
  drag.moved = true;
  state.view.hoverSample = null;
  clearSelectionRange();
  hideHint();
}

function updatePanDrag(event, drag) {
  const dx = event.clientX - drag.lastClientX;
  const dy = event.clientY - drag.lastClientY;
  drag.lastClientX = event.clientX;
  drag.lastClientY = event.clientY;

  const pixelsPerSecond = Math.max(1, state.canvas.width - PITCH_AXIS_WIDTH) / state.view.visibleSeconds;
  if (Math.abs(dx) > 0) {
    panTime(-dx / pixelsPerSecond);
  }

  if (!isTunerMode() && Math.abs(dy) > 0) {
    const midiPerPixel = (state.view.maxMidi - state.view.minMidi) / Math.max(1, state.canvas.height);
    panPitch(dy * midiPerPixel);
  }
}

function releasePointerCaptureIfNeeded(event) {
  if (
    event
    && els.canvasWrap
    && typeof els.canvasWrap.releasePointerCapture === "function"
  ) {
    try {
      els.canvasWrap.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture may already be released by the browser.
    }
  }
}

function handlePointerDown(event) {
  if (isUploadProcessing()) {
    event.preventDefault();
    return;
  }

  if (!isPrimaryMouseOrNonMousePointer(event)) {
    return;
  }
  if (event.target && event.target.closest("button, input, .pitch-scrollbar")) {
    return;
  }
  const point = canvasPointFromPointerEvent(event);
  const hadSelection = Boolean(state.view.selectionRange);
  clearSelectionRange();
  state.view.hoverSample = null;
  hideHint();

  if (typeof els.canvasWrap.setPointerCapture === "function") {
    try {
      els.canvasWrap.setPointerCapture(event.pointerId);
    } catch (error) {
      // Synthetic pointer events may not have an active pointer capture target.
    }
  }
  state.view.pointerDrag = {
    pointerId: event.pointerId,
    pointerType: event.pointerType || "mouse",
    mode: "pending",
    startX: point.x,
    startY: point.y,
    currentX: point.x,
    currentY: point.y,
    startClientX: event.clientX,
    startClientY: event.clientY,
    lastClientX: event.clientX,
    lastClientY: event.clientY,
    longPressTimerId: null,
    moved: false,
  };

  if (event.shiftKey) {
    event.preventDefault();
    startRangeSelection(state.view.pointerDrag, point);
    return;
  }

  scheduleRangeLongPress(state.view.pointerDrag);
  if (hadSelection) {
    draw();
  }
}

function handlePointerMove(event) {
  if (isUploadProcessing()) {
    event.preventDefault();
    return;
  }

  if (state.view.pointerDrag && state.view.pointerDrag.pointerId === event.pointerId) {
    const drag = state.view.pointerDrag;
    const point = canvasPointFromPointerEvent(event);

    if (drag.mode === "selection") {
      event.preventDefault();
      updateRangeSelection(drag, point);
      return;
    }

    drag.currentX = point.x;
    drag.currentY = point.y;

    if (drag.mode === "pending" && event.shiftKey) {
      event.preventDefault();
      startRangeSelection(drag, point);
      return;
    }

    const totalDistance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
    if (drag.mode === "pending" && totalDistance <= GRAPH_TAP_MOVE_PX) {
      return;
    }

    if (drag.mode === "pending") {
      startPanDrag(drag);
    }

    if (drag.mode === "pan") {
      event.preventDefault();
      updatePanDrag(event, drag);
    }
    return;
  }

  updateHover(event);
}

function handlePointerUp(event) {
  if (isUploadProcessing()) {
    event.preventDefault();
    return;
  }

  if (state.view.pointerDrag && state.view.pointerDrag.pointerId === event.pointerId) {
    const drag = state.view.pointerDrag;
    clearRangeLongPressTimer(drag);
    releasePointerCaptureIfNeeded(event);

    if (drag.mode === "selection") {
      event.preventDefault();
      if (event.type === "pointercancel") {
        clearSelectionRange();
        hideHint();
        draw();
      } else {
        updateRangeSelection(drag, canvasPointFromPointerEvent(event));
        if (!selectionHasUsableArea(state.view.selectionRange)) {
          clearSelectionRange();
          hideHint();
          draw();
        }
      }
      state.view.pointerDrag = null;
      return;
    }

    state.view.pointerDrag = null;
    if (!drag.moved && event.type !== "pointercancel" && isPrimaryMouseOrNonMousePointer(event)) {
      event.preventDefault();
      toggleTransport();
    }
  }
}

function updateHover(event) {
  if (isUploadProcessing()) {
    return;
  }

  const rect = els.canvasWrap.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const rightTime = getRightTime();
  const leftTime = rightTime - state.view.visibleSeconds;
  let nearest = null;
  let bestDistance = Infinity;

  clearSelectionRange();
  for (const sample of state.pitchSamples) {
    if (!sampleIsVisible(sample, leftTime, rightTime)) {
      continue;
    }
    const sx = timeToX(sample.timeSec, rightTime);
    const sy = midiToY(sample.midiFloat);
    const distance = Math.hypot(sx - x, sy - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = sample;
    }
  }

  if (nearest && bestDistance <= 14) {
    state.view.hoverSample = nearest;
    state.view.hoverPosition = { x, y };
    showHint(nearest, x, y);
  } else {
    state.view.hoverSample = null;
    hideHint();
  }
  draw();
}

function showHint(sample, x, y) {
  const row = csvRowForSample(sample);
  if (!row.voiced) {
    hideHint();
    return;
  }

  const sign = row.cents >= 0 ? "+" : "";
  els.hoverHint.classList.remove("selection-hint");
  els.hoverHint.innerHTML = [
    `Time: ${row.timeSec.toFixed(3)} s`,
    `Note: ${row.noteName}${row.octave} ${sign}${row.cents.toFixed(1)} cent`,
    `F0: ${row.frequency.toFixed(2)} Hz`,
    `MIDI: ${row.midiFloat.toFixed(3)}`,
    `Confidence: ${row.confidence.toFixed(2)}`,
    ...(Number.isFinite(sample.volumeDb) ? [`Volume: ${sample.volumeDb.toFixed(1)} dB`] : []),
  ].join("<br>");
  positionHint(x, y);
}

function showSelectionHint(range, x, y) {
  const threshold = getSelectionConfidenceThreshold();
  const samples = selectionHasUsableArea(range)
    ? highConfidenceSamplesInSelection(range, threshold)
    : [];
  els.hoverHint.classList.add("selection-hint");
  els.hoverHint.innerHTML = selectionHintHtml(range, samples, threshold);
  positionHint(x, y);
}

function selectionHintHtml(range, samples, threshold) {
  const meta = `<div class="hover-hint-meta">Conf &ge; ${threshold.toFixed(2)} / n=${samples.length}</div>`;
  if (!selectionHasUsableArea(range)) {
    return [
      `<div class="hover-hint-title">Selection</div>`,
      `<div class="hover-hint-empty">Drag to set range</div>`,
      meta,
    ].join("");
  }

  if (samples.length === 0) {
    return [
      `<div class="hover-hint-title">Selection</div>`,
      `<div class="hover-hint-empty">No high-confidence pitch</div>`,
      meta,
    ].join("");
  }

  const stats = selectionPitchStats(samples);
  return [
    `<div class="hover-hint-title">Selection</div>`,
    `<table class="selection-stats">`,
    `<thead><tr><th scope="col"></th><th scope="col">Note</th><th scope="col">Hz</th><th scope="col">MIDI</th><th scope="col">Cent</th></tr></thead>`,
    `<tbody>`,
    selectionPitchRowHtml("Upper", stats.upper),
    selectionPitchRowHtml("Lower", stats.lower),
    selectionMadRowHtml(stats),
    `</tbody>`,
    `</table>`,
    meta,
  ].join("");
}

function highConfidenceSamplesInSelection(range, threshold) {
  const samples = [];
  for (const sample of state.pitchSamples) {
    if (
      !sample
      || sample.timeSec < range.timeMin
      || sample.timeSec > range.timeMax
      || sample.confidence < threshold
      || sample.frequency <= 0
      || !Number.isFinite(sample.midiFloat)
      || sample.midiFloat < range.midiMin
      || sample.midiFloat > range.midiMax
    ) {
      continue;
    }
    samples.push(sample);
  }
  return samples;
}

function getSelectionConfidenceThreshold() {
  return Math.max(state.analysis.confidenceThreshold, HIGH_CONFIDENCE_THRESHOLD);
}

function selectionPitchStats(samples) {
  const byMidi = [...samples].sort((a, b) => a.midiFloat - b.midiFloat);
  const midiValues = samples.map((sample) => sample.midiFloat);
  const frequencyValues = samples.map((sample) => sample.frequency);
  return {
    lower: byMidi[0],
    upper: byMidi[byMidi.length - 1],
    madHz: medianAbsoluteDeviation(frequencyValues),
    madMidi: medianAbsoluteDeviation(midiValues),
    madCent: medianAbsoluteDeviation(midiValues) * 100,
  };
}

function selectionPitchRowHtml(label, sample) {
  const note = noteInfoFromMidi(sample.midiFloat);
  return [
    `<tr>`,
    `<th scope="row">${label}</th>`,
    `<td>${note.name}${note.octave}</td>`,
    `<td>${sample.frequency.toFixed(2)}</td>`,
    `<td>${sample.midiFloat.toFixed(3)}</td>`,
    `<td>${formatSignedNumber(note.cents, 1)}</td>`,
    `</tr>`,
  ].join("");
}

function selectionMadRowHtml(stats) {
  return [
    `<tr>`,
    `<th scope="row">MAD</th>`,
    `<td>&mdash;</td>`,
    `<td>${stats.madHz.toFixed(2)}</td>`,
    `<td>${stats.madMidi.toFixed(3)}</td>`,
    `<td>${stats.madCent.toFixed(1)}</td>`,
    `</tr>`,
  ].join("");
}

function medianAbsoluteDeviation(values) {
  if (values.length === 0) {
    return 0;
  }
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatSignedNumber(value, decimals) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}`;
}

function positionHint(x, y) {
  const offset = 12;
  els.hoverHint.hidden = false;
  const hintRect = els.hoverHint.getBoundingClientRect();
  const hintWidth = hintRect.width || (els.hoverHint.classList.contains("selection-hint") ? 360 : 178);
  const hintHeight = hintRect.height || (els.hoverHint.classList.contains("selection-hint") ? 150 : 92);
  const maxLeft = Math.max(6, state.canvas.width - hintWidth - 6);
  const maxTop = Math.max(6, state.canvas.height - hintHeight - 6);
  const preferredLeft = x + offset + hintWidth > state.canvas.width - 6
    ? x - hintWidth - offset
    : x + offset;
  const preferredTop = y + offset + hintHeight > state.canvas.height - 6
    ? y - hintHeight - offset
    : y + offset;
  const left = clamp(preferredLeft, 6, maxLeft);
  const top = clamp(preferredTop, 6, maxTop);
  els.hoverHint.style.left = `${left}px`;
  els.hoverHint.style.top = `${top}px`;
}

function hideHint() {
  els.hoverHint.hidden = true;
  els.hoverHint.classList.remove("selection-hint");
}

function handleVisibilityChange() {
  if (isPageHidden()) {
    pauseForDeactivation();
  }
}

function handlePageHide() {
  pauseForDeactivation();
}

function bindEvents() {
  document.getElementById("multiModeBtn")?.addEventListener("click", () => setViewMode(VIEW_MODE_MULTI));
  document.getElementById("tunerModeBtn")?.addEventListener("click", () => setViewMode(VIEW_MODE_TUNER));
  els.modeToggleBtn.addEventListener("click", () => setViewMode(VIEW_MODE_GRAPH));
  els.overlayStartBtn.addEventListener("click", startMic);
  els.pauseBtn.addEventListener("click", togglePause);
  els.clearBtn.addEventListener("click", clearHistory);
  els.uploadBtn.addEventListener("click", handleUploadButtonClick);
  els.uploadInput.addEventListener("change", handleUploadInputChange);
  els.cancelUploadBtn.addEventListener("click", cancelUploadProcessing);
  els.exportBtn.addEventListener("click", exportCsv);
  els.timeZoomInBtn.addEventListener("click", () => zoomTime(0.8));
  els.timeZoomOutBtn.addEventListener("click", () => zoomTime(1.25));
  els.pitchZoomInBtn.addEventListener("click", () => zoomPitch(0.8));
  els.pitchZoomOutBtn.addEventListener("click", () => zoomPitch(1.25));
  els.thresholdInput.addEventListener("input", () => {
    if (isUploadProcessing()) {
      return;
    }

    state.analysis.confidenceThreshold = Number(els.thresholdInput.value);
    els.thresholdValue.value = state.analysis.confidenceThreshold.toFixed(2);
    if (isMultiMode()) {
      for (const sample of state.pitchSamples) {
        sample.voiced = sample.frequency > 0
          && Number.isFinite(sample.midiFloat)
          && sample.midiFloat >= HARD_MIN_MIDI
          && sample.midiFloat <= HARD_MAX_MIDI
          && sample.confidence >= state.analysis.confidenceThreshold;
      }
    } else {
      recomputeSinglePitchDerivedState();
    }
    replaceRendererSamples();
    saveSettings();
    const pitchRangeChanged = autoScrollPitchToSample(state.currentSample);
    if (pitchRangeChanged) {
      markBackgroundDirty();
    }
    updateStatus();
    draw();
  });

  els.pitchScrollbar.addEventListener("pointerdown", handlePitchScrollbarPointerDown);
  els.pitchScrollbar.addEventListener("pointermove", handlePitchScrollbarPointerMove);
  els.pitchScrollbar.addEventListener("pointerup", handlePitchScrollbarPointerUp);
  els.pitchScrollbar.addEventListener("pointercancel", handlePitchScrollbarPointerUp);

  els.canvasWrap.addEventListener("wheel", handleWheel, { passive: false });
  els.canvasWrap.addEventListener("pointerdown", handlePointerDown);
  els.canvasWrap.addEventListener("pointermove", handlePointerMove);
  els.canvasWrap.addEventListener("pointerup", handlePointerUp);
  els.canvasWrap.addEventListener("pointercancel", handlePointerUp);
  els.canvasWrap.addEventListener("pointerleave", () => {
    if (state.view.pointerDrag || state.view.selectionRange) {
      return;
    }
    state.view.hoverSample = null;
    hideHint();
    draw();
  });

  window.addEventListener("keydown", (event) => {
    if (isUploadProcessing()) {
      if (eventTargetsCancelUpload(event)) {
        return;
      }
      event.preventDefault();
      return;
    }

    const targetTag = event.target && event.target.tagName;
    if (targetTag && ["INPUT", "TEXTAREA", "SELECT"].includes(targetTag)) {
      return;
    }
    if (event.code === "Space" || event.key === " ") {
      if (targetTag === "BUTTON") {
        return;
      }
      event.preventDefault();
      toggleTransport();
      return;
    }
    if (event.key === "+" || event.key === "=") {
      zoomTime(0.8);
    } else if (event.key === "-") {
      zoomTime(1.25);
    }
  });
  document.addEventListener("click", suppressInteractionDuringUpload, true);
  document.addEventListener("pointerdown", suppressInteractionDuringUpload, true);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);
}

function init() {
  setupCanvases();
  loadSettings();
  bindEvents();
  setMicState("idle");
  setMessage("Idle");
  markBackgroundDirty();
  updateStatus();
  draw();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then((registration) => registration.update())
      .catch(() => {
        // The app still works without offline caching.
      });
  });
}

init();
registerServiceWorker();
