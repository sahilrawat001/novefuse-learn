export class AudioPlayerService {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onStateChange?: (isPlaying: boolean) => void;
  private playbackRate: number = 1.0;
  private volume: number = 1.0;

  constructor(onStateChange?: (isPlaying: boolean) => void) {
    this.onStateChange = onStateChange;
  }

  public initAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      } catch {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Output Gain & Analyser chain
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.4;
      this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);
    }
    return this.audioContext;
  }

  public async resume(): Promise<void> {
    const ctx = this.initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
      console.log('[AudioPlayer] AudioContext resumed successfully on user gesture. State:', ctx.state);
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.75, Math.min(2.0, rate));
    if (this.audioContext) {
      for (const source of this.activeSources) {
        try {
          source.playbackRate.setValueAtTime(this.playbackRate, this.audioContext.currentTime);
        } catch {
          // Ignore ended sources
        }
      }
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public getAudioLevel(): number {
    if (!this.analyserNode || !this.dataArray || this.activeSources.length === 0) return 0;
    try {
      this.analyserNode.getByteFrequencyData(this.dataArray as any);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const avg = sum / this.dataArray.length;
      return Math.min(1.0, (avg / 128) * 1.25);
    } catch {
      return 0;
    }
  }

  public playPcm16Chunk(base64Data: string): void {
    if (!base64Data) return;

    try {
      const ctx = this.initAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch((e) => console.warn('[AudioPlayer] Resume notice:', e));
      }

      // Decode base64 string
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const sampleCount = Math.floor(len / 2);
      if (sampleCount === 0) return;

      // Pure bitwise Little-Endian 16-bit PCM to Float32 conversion (-1.0 to 1.0)
      const float32Array = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const b0 = binaryString.charCodeAt(i * 2);
        const b1 = binaryString.charCodeAt(i * 2 + 1);
        let int16 = (b1 << 8) | b0;
        if (int16 >= 0x8000) {
          int16 -= 0x10000;
        }
        float32Array[i] = int16 / 32768.0;
      }

      // Create AudioBuffer (24kHz, mono)
      const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = this.playbackRate;

      if (this.gainNode) {
        source.connect(this.gainNode);
      } else {
        source.connect(ctx.destination);
      }

      const currentTime = ctx.currentTime;
      // Micro-jitter buffer: if scheduling fell behind current time, catch up smoothly
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration / this.playbackRate;

      this.activeSources.push(source);
      if (this.onStateChange && this.activeSources.length === 1) {
        this.onStateChange(true);
      }

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index !== -1) {
          this.activeSources.splice(index, 1);
        }
        if (this.activeSources.length === 0) {
          if (this.onStateChange) this.onStateChange(false);
        }
      };
    } catch (err) {
      console.error('[AudioPlayer] Error decoding or scheduling PCM16 audio chunk:', err);
    }
  }

  public interrupt(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already ended
      }
    }
    this.activeSources = [];
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
    if (this.onStateChange) {
      this.onStateChange(false);
    }
  }

  public playConnectedChime(): void {
    try {
      const ctx = this.initAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      // High-energy upward triad: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.14 * this.volume, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.24);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch (err) {
      console.warn('[AudioPlayer] playConnectedChime notice:', err);
    }
  }

  public playTurnReadyChime(): void {
    try {
      const ctx = this.initAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      // Soft unobtrusive floor-ready cue: A5 (880Hz) gentle chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.07);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08 * this.volume, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (err) {
      console.warn('[AudioPlayer] playTurnReadyChime notice:', err);
    }
  }

  public close(): void {
    this.interrupt();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
      this.gainNode = null;
      this.analyserNode = null;
      this.dataArray = null;
    }
  }
}
