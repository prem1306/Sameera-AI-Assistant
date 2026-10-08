/**
 * AudioPlayer - Receives 24kHz PCM16 chunks from Gemini Live, schedules gapless
 * playback with sample-accurate Web Audio timing, handles immediate interruptions,
 * and ensures browser audio engine unlocking via user gesture.
 */

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private sampleRate = 24000;
  private isSpeaking = false;
  private endCheckTimeout: any = null;

  public onSpeakingChange: ((speaking: boolean) => void) | null = null;

  /**
   * Unlock Web Audio API inside a user gesture (e.g. click event)
   */
  async unlock(): Promise<void> {
    const ctx = this.getOrCreateAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    // Play a microscopic silent buffer to guarantee iOS/Safari/Chrome audio unlock
    try {
      const silentBuf = ctx.createBuffer(1, 1, 24000);
      const src = ctx.createBufferSource();
      src.buffer = silentBuf;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {
      // ignore
    }
  }

  private getOrCreateAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // Do NOT force custom sample rate to avoid browser NotSupportedError;
      // Web Audio API automatically resamples AudioBuffers created at 24000Hz!
      this.audioContext = new AudioContextClass();

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    return this.audioContext;
  }

  /**
   * Enqueue a 24kHz raw PCM16 base64 chunk from Gemini Live
   */
  queueAudioChunk(base64Audio: string): void {
    try {
      const ctx = this.getOrCreateAudioContext();

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Clear any pending end-of-speech timeout since we received a fresh audio chunk
      if (this.endCheckTimeout) {
        clearTimeout(this.endCheckTimeout);
        this.endCheckTimeout = null;
      }

      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 16-bit little-endian signed PCM
      const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      if (int16Array.length === 0) return;

      // Convert to Float32 [-1.0, 1.0]
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create AudioBuffer with Gemini's 24000Hz sample rate.
      // Web Audio API's engine will resample it automatically to hardware rate (e.g. 48kHz).
      const audioBuffer = ctx.createBuffer(1, float32Array.length, this.sampleRate);
      audioBuffer.copyToChannel(float32Array, 0);

      // Create Source
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode!);

      // Adaptive Jitter Buffer Scheduling:
      // When starting a new utterance (or recovering from an underrun gap):
      // Add a 45ms lead time so packet jitter over WebSocket never causes audio crackles or stuttering.
      const currentTime = ctx.currentTime;
      let startTime: number;

      if (!this.isSpeaking || this.nextStartTime < currentTime + 0.01) {
        // Starting fresh burst or recovering from underrun: provide safe 45ms buffer
        startTime = currentTime + 0.045;
      } else {
        // Continuing an existing utterance gaplessly
        startTime = this.nextStartTime;
      }

      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;
      this.activeSources.add(source);

      // Update speaking state
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.onSpeakingChange?.(true);
      }

      source.onended = () => {
        try {
          source.disconnect();
        } catch (e) {
          // ignore
        }
        this.activeSources.delete(source);
        this.scheduleEndOfSpeechCheck();
      };

      this.scheduleEndOfSpeechCheck();
    } catch (err) {
      console.error('[AudioPlayer] Error processing audio chunk:', err);
    }
  }

  private scheduleEndOfSpeechCheck(): void {
    if (this.endCheckTimeout) {
      clearTimeout(this.endCheckTimeout);
    }

    if (!this.audioContext) return;

    // Calculate time until all scheduled audio buffers finish playing
    const remainingTime = Math.max(0, (this.nextStartTime - this.audioContext.currentTime) * 1000);

    // 250ms debounce/hysteresis prevents rapid toggle between speaking & listening across brief pauses
    this.endCheckTimeout = setTimeout(() => {
      if (!this.audioContext) return;

      const allBuffersEnded = this.activeSources.size === 0;
      const timePassed = this.audioContext.currentTime >= (this.nextStartTime - 0.02);

      if (allBuffersEnded || timePassed) {
        if (this.isSpeaking) {
          this.isSpeaking = false;
          this.onSpeakingChange?.(false);
        }
      }
    }, remainingTime + 250);
  }

  /**
   * Immediately stops all currently playing and queued audio
   * Triggered when user interrupts Sameera
   */
  interrupt(): void {
    if (this.endCheckTimeout) {
      clearTimeout(this.endCheckTimeout);
      this.endCheckTimeout = null;
    }

    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // already stopped
      }
    });
    this.activeSources.clear();

    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    } else {
      this.nextStartTime = 0;
    }

    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange?.(false);
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  getAudioLevel(): number {
    if (!this.analyserNode || !this.isSpeaking) return 0;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray as any);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    return Math.min(1, average / 128);
  }

  getFrequencyData(array: Uint8Array): void {
    if (!this.analyserNode || !this.isSpeaking) {
      array.fill(0);
      return;
    }
    this.analyserNode.getByteFrequencyData(array as any);
  }

  getTimeDomainData(array: Uint8Array): void {
    if (!this.analyserNode || !this.isSpeaking) {
      array.fill(128);
      return;
    }
    this.analyserNode.getByteTimeDomainData(array as any);
  }

  destroy(): void {
    this.interrupt();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.gainNode = null;
  }
}
