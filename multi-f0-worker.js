import { createChain } from "./vendor/effetune/dist/index.js";
import { noteChain, observations } from "./multi-f0.js";

self.onmessage = async ({ data }) => {
  let chain, stream;
  try {
    chain = await createChain(noteChain);
    const results = [];
    const cutoff = Math.max(0, data.audio.length / data.sampleRate - 600);
    stream = await chain.stream({ sampleRate: data.sampleRate, channels: 1, blockSize: 128,
      onTelemetry(frame) {
        if (frame.kind === "noteSpectrogram" && frame.timeSeconds >= cutoff) {
          results.push(...observations(frame));
        }
      },
    });
    for (let start = 0; start < data.audio.length; start += 4096) {
      await stream.process([data.audio.subarray(start, start + 4096)]);
      if (start % 32768 === 0) self.postMessage({ progress: start / data.audio.length });
    }
    self.postMessage({ results, duration: data.audio.length / data.sampleRate });
  } catch (error) {
    self.postMessage({ error: error.message });
  } finally {
    stream?.close();
    chain?.close();
  }
};
