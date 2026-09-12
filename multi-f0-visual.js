"use strict";

// Independent observations: never connect or quantize polyphonic detections.
function drawMultiPoint(ctx, x, y, sample) {
  const confidence = Math.max(0, Math.min(1, sample.confidence));
  const volume = Math.max(0, Math.min(1, ((sample.volumeDb ?? -90) + 72) / 66));
  const radius = 0.8 + 2.4 * Math.sqrt(volume);
  const hue = 205 - 40 * confidence;
  const alpha = (0.12 + 0.76 * confidence ** 1.6) * (0.3 + 0.7 * volume);
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${hue}, 88%, 62%, ${alpha * 0.12})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${hue}, 78%, ${48 + 32 * volume}%, ${alpha})`;
  ctx.fill();
}
