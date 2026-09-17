// EffeTune DSP 0.10.0 Pitch Meter covers C1 through C8 for this application.
export const pitchChain = {
  version: 1,
  chain: [{ id: "pitch", type: "PitchMeter", parameters: {
    referenceA4: 440, minimumMidi: 24, maximumMidi: 108,
  } }],
};

export function observation(frame, offset = 0) {
  if (frame.kind !== "pitch") return null;
  return {
    timeSec: offset + frame.timeSeconds,
    frequency: frame.voiced ? frame.f0Hz : 0,
    confidence: frame.voiced ? frame.confidence : 0,
    volumeDb: frame.levelDb,
  };
}
