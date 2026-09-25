// AudioWorkletProcessor to record PCM16 mono at 24kHz
class PCMRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0]; // Float32Array of samples (-1.0 to 1.0)

    for (let i = 0; i < channelData.length; i++) {
      // Clamp between -1 and 1
      let s = Math.max(-1, Math.min(1, channelData[i]));
      // Convert Float32 to 16-bit signed PCM
      this.buffer[this.bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7FFF;

      if (this.bufferIndex >= this.bufferSize) {
        // Send buffer copy to main thread
        this.port.postMessage(this.buffer.slice(0, this.bufferSize).buffer, [this.buffer.slice(0, this.bufferSize).buffer]);
        this.buffer = new Int16Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-recorder-worklet', PCMRecorderWorklet);
