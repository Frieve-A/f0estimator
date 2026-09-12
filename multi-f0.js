// EffeTune DSP 0.9.0: pitch bins are spaced at 20 cents, A0 through C8.
export const noteChain = {
  version: 1,
  chain: [{ id: "notes", type: "NoteSpectrogram", parameters: {
    minimumMidi: 24, maximumMidi: 108, regularCandidates: 12,
  } }],
};

export function observations(frame, offset = 0) {
  if (frame.kind !== "noteSpectrogram") return [];
  const result = [];
  for (let i = 0; i < frame.levels.length; i++) {
    const confidence = frame.levels[i];
    const volumeDb = frame.volumeDb[i];
    const midi = frame.firstMidi + i / frame.divisionsPerSemitone;
    // Keep all positive DSP detections; the display threshold remains reversible.
    if (!Number.isFinite(confidence) || confidence <= 0 || !Number.isFinite(volumeDb)
      || midi < 24 || midi > 108) continue;
    result.push({ timeSec: offset + frame.timeSeconds,
      frequency: 440 * 2 ** ((midi - 69) / 12), confidence, volumeDb });
  }
  return result;
}
