"use strict";

const MODEL_SAMPLE_RATE = 16000;
const MAX_HISTORY_SECONDS = 10 * 60;
const HARD_MIN_MIDI = 24;
const HARD_MAX_MIDI = 96;
const MIN_PITCH_SPAN = 12;
const VIEW_MODE_TUNER = "tuner";
const TUNER_DEFAULT_CENTER_MIDI = 69;
const TUNER_HALF_RANGE_MIDI = 0.5;
const TUNER_CENT_GRID_STEP = 10;
const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const PITCH_AXIS_WIDTH = 54;
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
  tunerAverage: "#ffcf4a",
  now: "#ff4d8d",
  hoverFill: "#f7f4ec",
};

const state = {
  backgroundCanvas: null,
  traceCanvas: null,
  backgroundCtx: null,
  traceCtx: null,
  pitchSamples: [],
  renderState: null,
  canvas: {
    width: 1,
    height: 1,
    dpr: 1,
    backgroundDirty: true,
    backgroundKey: "",
  },
};

self.addEventListener("message", (event) => {
  try {
    handleMessage(event.data || {});
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error && error.message ? error.message : String(error),
    });
  }
});

function handleMessage(message) {
  if (message.type === "init") {
    initializeRenderer(message);
  } else if (message.type === "resize") {
    resizeCanvases(message);
  } else if (message.type === "appendSamples") {
    appendSamples(message.samples || []);
  } else if (message.type === "setSamples") {
    state.pitchSamples = (message.samples || []).filter(Boolean);
  } else if (message.type === "clearSamples") {
    state.pitchSamples = [];
  } else if (message.type === "draw") {
    draw(message.renderState, message.backgroundDirty === true);
  }
}

function initializeRenderer(message) {
  state.backgroundCanvas = message.backgroundCanvas;
  state.traceCanvas = message.traceCanvas;
  state.backgroundCtx = state.backgroundCanvas.getContext("2d");
  state.traceCtx = state.traceCanvas.getContext("2d");
  if (!state.backgroundCtx || !state.traceCtx) {
    throw new Error("2D canvas context is unavailable in renderer worker");
  }
}

function resizeCanvases(message) {
  state.canvas.width = Math.max(1, message.width || 1);
  state.canvas.height = Math.max(1, message.height || 1);
  state.canvas.dpr = Math.max(1, message.dpr || 1);

  const pixelWidth = Math.max(1, message.pixelWidth || Math.round(state.canvas.width * state.canvas.dpr));
  const pixelHeight = Math.max(1, message.pixelHeight || Math.round(state.canvas.height * state.canvas.dpr));

  for (const canvas of [state.backgroundCanvas, state.traceCanvas]) {
    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }
    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }
  }

  state.backgroundCtx.setTransform(state.canvas.dpr, 0, 0, state.canvas.dpr, 0, 0);
  state.traceCtx.setTransform(state.canvas.dpr, 0, 0, state.canvas.dpr, 0, 0);
  markBackgroundDirty();
}

function appendSamples(samples) {
  if (samples.length === 0) {
    return;
  }

  for (const sample of samples) {
    if (sample) {
      state.pitchSamples.push(sample);
    }
  }

  const latest = state.pitchSamples[state.pitchSamples.length - 1];
  if (!latest || !Number.isFinite(latest.timeSec)) {
    return;
  }

  const cutoff = latest.timeSec - MAX_HISTORY_SECONDS;
  while (state.pitchSamples.length > 0 && state.pitchSamples[0].timeSec < cutoff) {
    state.pitchSamples.shift();
  }
}

function markBackgroundDirty() {
  state.canvas.backgroundDirty = true;
}

function draw(renderState, backgroundDirty) {
  if (!renderState || !state.backgroundCtx || !state.traceCtx) {
    return;
  }

  state.renderState = renderState;
  state.canvas.width = Math.max(1, renderState.canvas.width || state.canvas.width);
  state.canvas.height = Math.max(1, renderState.canvas.height || state.canvas.height);
  state.canvas.dpr = Math.max(1, renderState.canvas.dpr || state.canvas.dpr);

  const backgroundKey = getBackgroundKey();
  if (backgroundDirty || state.canvas.backgroundDirty || state.canvas.backgroundKey !== backgroundKey) {
    drawBackground();
    state.canvas.backgroundDirty = false;
    state.canvas.backgroundKey = backgroundKey;
  }

  drawTrace();
}

function getBackgroundKey() {
  const pitchRange = getEffectivePitchRange();
  return [
    state.renderState.view.mode,
    state.canvas.width.toFixed(1),
    state.canvas.height.toFixed(1),
    state.renderState.view.visibleSeconds.toFixed(3),
    pitchRange.minMidi.toFixed(3),
    pitchRange.maxMidi.toFixed(3),
    getRightTime().toFixed(3),
  ].join(":");
}

function drawBackground() {
  const ctx = state.backgroundCtx;
  const width = state.canvas.width;
  const height = state.canvas.height;
  ctx.clearRect(0, 0, width, height);
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, UI_THEME.canvasBgTop);
  background.addColorStop(1, UI_THEME.canvasBgBottom);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const rightTime = getRightTime();
  const leftTime = rightTime - state.renderState.view.visibleSeconds;
  const timeStep = chooseTimeGridStep(state.renderState.view.visibleSeconds);

  if (isTunerMode()) {
    drawTunerPitchGrid(ctx, width);
  } else {
    const view = state.renderState.view;
    for (let midi = Math.floor(view.minMidi); midi <= Math.ceil(view.maxMidi); midi += 1) {
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
    const view = state.renderState.view;
    let lastLabelY = -Infinity;
    for (let midi = Math.floor(view.minMidi); midi <= Math.ceil(view.maxMidi); midi += 1) {
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

function drawPitchAxisKeyboard(ctx, height) {
  const axisRight = PITCH_AXIS_WIDTH - 1;
  const blackKeyWidth = Math.round(PITCH_AXIS_WIDTH * 0.62);
  const view = state.renderState.view;
  const firstMidi = Math.floor(view.minMidi) - 1;
  const lastMidi = Math.ceil(view.maxMidi) + 1;

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
  const ctx = state.traceCtx;
  const width = state.canvas.width;
  const height = state.canvas.height;
  const rightTime = getRightTime();
  const leftTime = rightTime - state.renderState.view.visibleSeconds;
  const pitchRange = getEffectivePitchRange();
  const bounds = sampleBounds(leftTime, rightTime);

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(PITCH_AXIS_WIDTH, 0, Math.max(0, width - PITCH_AXIS_WIDTH), height);
  ctx.clip();

  const tunerMode = isTunerMode();
  if (!tunerMode) {
    let segmentOpen = false;
    let previous = null;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(37, 223, 210, 0.55)";
    ctx.shadowBlur = 9;

    for (let i = bounds.start; i < bounds.end; i += 1) {
      const sample = state.pitchSamples[i];
      if (!sampleIsVisible(sample, pitchRange, leftTime, rightTime)) {
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
  for (let i = bounds.start; i < bounds.end; i += 1) {
    const sample = state.pitchSamples[i];
    if (!sampleIsVisible(sample, pitchRange, leftTime, rightTime)) {
      continue;
    }
    const x = timeToX(sample.timeSec, rightTime);
    const y = midiToY(sample.midiFloat);
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = sample.confidence >= HIGH_CONFIDENCE_THRESHOLD ? UI_THEME.traceHot : UI_THEME.traceWarm;
    ctx.fill();
  }

  if (tunerMode) {
    drawTunerAverageTrace(ctx, leftTime, rightTime, pitchRange, bounds);
  }

  ctx.strokeStyle = UI_THEME.now;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = "rgba(255, 77, 141, 0.52)";
  ctx.shadowBlur = 10;
  const currentTimeX = state.renderState.view.followNow && state.renderState.latestTimeSec > 0
    ? timeToX(state.renderState.latestTimeSec, rightTime)
    : width - 1;
  ctx.beginPath();
  ctx.moveTo(currentTimeX, 0);
  ctx.lineTo(currentTimeX, height);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const hoverSample = state.renderState.view.hoverSample;
  if (hoverSample) {
    const x = timeToX(hoverSample.timeSec, rightTime);
    const y = midiToY(hoverSample.midiFloat);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = UI_THEME.hoverFill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = UI_THEME.traceWarm;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTunerAverageTrace(ctx, leftTime, rightTime, pitchRange, bounds) {
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

  for (let i = bounds.start; i < bounds.end; i += 1) {
    const sample = state.pitchSamples[i];
    if (!tunerAverageSampleIsVisible(sample, pitchRange, leftTime, rightTime)) {
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

function sampleBounds(leftTime, rightTime) {
  const start = lowerBoundTime(leftTime);
  let end = start;
  while (
    end < state.pitchSamples.length
    && state.pitchSamples[end].timeSec <= rightTime
  ) {
    end += 1;
  }
  return { start, end };
}

function lowerBoundTime(timeSec) {
  let low = 0;
  let high = state.pitchSamples.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (state.pitchSamples[mid].timeSec < timeSec) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function tunerAverageSampleIsVisible(sample, pitchRange, leftTime, rightTime) {
  return sample.timeSec >= leftTime
    && sample.timeSec <= rightTime
    && Number.isFinite(sample.tunerAverageMidi)
    && sample.tunerAverageMidi >= pitchRange.minMidi
    && sample.tunerAverageMidi <= pitchRange.maxMidi;
}

function sampleIsVisible(sample, pitchRange, leftTime, rightTime) {
  return sample.timeSec >= leftTime
    && sample.timeSec <= rightTime
    && sample.confidence >= state.renderState.analysis.confidenceThreshold
    && sample.frequency > 0
    && Number.isFinite(sample.midiFloat)
    && sample.midiFloat >= pitchRange.minMidi
    && sample.midiFloat <= pitchRange.maxMidi;
}

function chooseTimeGridStep(seconds) {
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
  const view = state.renderState.view;
  const span = Math.max(MIN_PITCH_SPAN, view.maxMidi - view.minMidi);
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
  if (Number.isFinite(state.renderState.rightTime)) {
    return state.renderState.rightTime;
  }
  if (state.renderState.view.followNow) {
    return Math.max(state.renderState.view.visibleSeconds, state.renderState.latestTimeSec);
  }
  return Math.max(state.renderState.view.visibleSeconds, state.renderState.view.manualRightTime);
}

function timeToX(timeSec, rightTime = getRightTime()) {
  const drawableWidth = Math.max(1, state.canvas.width - PITCH_AXIS_WIDTH);
  const pixelsPerSecond = drawableWidth / state.renderState.view.visibleSeconds;
  return state.canvas.width - (rightTime - timeSec) * pixelsPerSecond;
}

function midiToY(midi) {
  const pitchRange = getEffectivePitchRange();
  const span = pitchRange.maxMidi - pitchRange.minMidi;
  return state.canvas.height - ((midi - pitchRange.minMidi) / span) * state.canvas.height;
}

function getEffectivePitchRange() {
  const view = state.renderState.view;
  if (isTunerMode()) {
    const centerMidi = getTunerCenterMidi();
    return {
      minMidi: centerMidi - TUNER_HALF_RANGE_MIDI,
      maxMidi: centerMidi + TUNER_HALF_RANGE_MIDI,
      centerMidi,
    };
  }

  return {
    minMidi: view.minMidi,
    maxMidi: view.maxMidi,
    centerMidi: null,
  };
}

function isTunerMode() {
  return state.renderState.view.mode === VIEW_MODE_TUNER;
}

function getTunerCenterMidi() {
  const centerMidi = state.renderState.view.tunerCenterMidi;
  if (Number.isFinite(centerMidi)) {
    return clamp(Math.round(centerMidi), HARD_MIN_MIDI, HARD_MAX_MIDI);
  }
  return TUNER_DEFAULT_CENTER_MIDI;
}

function midiLabel(midiValue) {
  const midi = Math.round(midiValue);
  const note = noteInfoFromMidi(midi);
  return `${note.name}${note.octave}`;
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

function formatCentLabel(cents) {
  if (cents > 0) {
    return `+${cents}`;
  }
  return String(cents);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
