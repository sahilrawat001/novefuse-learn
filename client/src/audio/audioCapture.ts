export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private onAudioChunkCallback: ((pcm16Buffer: ArrayBuffer) => void) | null = null;
  private isCapturing = false;
  private animFrameId: number | null = null;
  private volumeCallback: ((volume: number) => void) | null = null;
  private currentDeviceId?: string;

  public static async getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'audioinput');
    } catch (err) {
      console.warn('[AudioCapture] Error enumerating devices:', err);
      return [];
    }
  }

  public async start(
    onChunk: (pcm16Buffer: ArrayBuffer) => void,
    onVolume?: (volume: number) => void,
    deviceId?: string
  ): Promise<void> {
    if (this.isCapturing) return;

    this.onAudioChunkCallback = onChunk;
    this.volumeCallback = onVolume || null;
    this.currentDeviceId = deviceId;

    const audioConstraints: MediaTrackConstraints = {
      channelCount: 1,
      sampleRate: 24000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    if (deviceId) {
      audioConstraints.deviceId = { exact: deviceId };
    }

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    // Create 24kHz AudioContext if supported, else fallback to default and resample
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    } catch {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Load AudioWorklet for PCM16 streaming
    try {
      await this.audioContext.audioWorklet.addModule('/pcm-recorder-worklet.js');
    } catch (e) {
      console.warn('[AudioCapture] AudioWorklet load notice:', e);
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Setup Analyser for live volume meter
    try {
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.4;
      this.sourceNode.connect(this.analyserNode);

      if (this.volumeCallback) {
        this.trackVolume();
      }
    } catch (e) {
      console.warn('[AudioCapture] Analyser setup notice:', e);
    }

    try {
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-recorder-worklet');

      const targetRate = 24000;
      const actualRate = this.audioContext.sampleRate;
      const needsResampling = actualRate !== targetRate;

      this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!this.isCapturing || !this.onAudioChunkCallback) return;

        const rawBuffer = event.data;
        if (!needsResampling) {
          this.onAudioChunkCallback(rawBuffer);
        } else {
          const resampled = this.resamplePcm16(rawBuffer, actualRate, targetRate);
          this.onAudioChunkCallback(resampled);
        }
      };

      this.sourceNode.connect(this.workletNode);
    } catch (e) {
      console.warn('[AudioCapture] Worklet node creation error:', e);
    }

    this.isCapturing = true;
  }

  private trackVolume(): void {
    if (!this.analyserNode || !this.isCapturing) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const check = () => {
      if (!this.isCapturing || !this.analyserNode) return;
      this.analyserNode.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      // Scale avg (0-255) to 0-100 percentage
      const normalized = Math.min(100, Math.round((avg / 128) * 100));

      if (this.volumeCallback) {
        this.volumeCallback(normalized);
      }

      this.animFrameId = requestAnimationFrame(check);
    };

    check();
  }

  public stop(): void {
    this.isCapturing = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.onAudioChunkCallback = null;
    this.volumeCallback = null;
  }

  public async switchDevice(newDeviceId: string): Promise<void> {
    if (this.currentDeviceId === newDeviceId) return;
    const chunkCb = this.onAudioChunkCallback;
    const volCb = this.volumeCallback;
    const wasCapturing = this.isCapturing;

    if (wasCapturing) {
      this.stop();
      if (chunkCb) {
        await this.start(chunkCb, volCb || undefined, newDeviceId);
      }
    } else {
      this.currentDeviceId = newDeviceId;
    }
  }

  private resamplePcm16(buffer: ArrayBuffer, fromRate: number, toRate: number): ArrayBuffer {
    const input = new Int16Array(buffer);
    const ratio = fromRate / toRate;
    const newLength = Math.round(input.length / ratio);
    const output = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const indexFloor = Math.floor(srcIndex);
      const indexCeil = Math.min(input.length - 1, indexFloor + 1);
      const t = srcIndex - indexFloor;
      output[i] = Math.round((1 - t) * input[indexFloor] + t * input[indexCeil]);
    }

    return output.buffer;
  }
}
