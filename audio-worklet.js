class F0InputProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0 || !channels[0]) {
      return true;
    }

    const length = channels[0].length;
    const mono = new Float32Array(length);

    if (channels.length === 1) {
      mono.set(channels[0]);
    } else {
      for (let i = 0; i < length; i += 1) {
        let sum = 0;
        for (let ch = 0; ch < channels.length; ch += 1) {
          sum += channels[ch][i] || 0;
        }
        mono[i] = sum / channels.length;
      }
    }

    this.port.postMessage({ type: "audio", buffer: mono }, [mono.buffer]);
    return true;
  }
}

registerProcessor("f0-input-processor", F0InputProcessor);
