/**
 * AudioStreamer - Captures microphone input, downsamples to 16kHz PCM16,
 * and streams continuous chunks to the server while providing real-time audio visualization metrics
 * and a comprehensive diagnostic utility to log raw PCM chunks, verify encoding, and confirm transmission.
 */

import { AudioChunkMetric, AudioDiagnosticSummary } from '../types/assistant';

export interface DiagnosticOptions {
  logToConsole?: boolean;
  maxHistory?: number;
  onMetric?: (metric: AudioChunkMetric) => void;
}

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isStreaming = false;
  private isMuted = false;
  private onAudioChunkCallback: ((base64PCM: string) => void) | null = null;
  private targetSampleRate = 16000;
  private residualBuffer: Float32Array = new Float32Array(0);
  private isAssistantSpeaking = false;

  // Diagnostic Utility State
  private diagnosticsEnabled = true;
  private logToConsole = true;
  private maxHistory = 100;
  private chunkSequence = 0;
  private totalSamples = 0;
  private speechChunksCount = 0;
  private silenceChunksCount = 0;
  private clippingCount = 0;
  private rmsSum = 0;
  private peakAmplitudeEver = 0;
  private recentChunks: AudioChunkMetric[] = [];
  private lastChunkTime: number | null = null;
  private onDiagnosticMetricCallback: ((metric: AudioChunkMetric) => void) | null = null;

  // Speech boundary tracking
  private speechActive = false;
  private voiceDurationMs = 0;
  private silenceDurationMs = 0;
  public onSpeechStartCallback: (() => void) | null = null;
  public onSpeechEndCallback: (() => void) | null = null;

  /**
   * Pre-warm and unlock audio context synchronously on user gesture
   */
  async unlock(): Promise<void> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Configure diagnostic utility
   */
  enableDiagnostics(options?: DiagnosticOptions): void {
    this.diagnosticsEnabled = true;
    if (options?.logToConsole !== undefined) this.logToConsole = options.logToConsole;
    if (options?.maxHistory !== undefined) this.maxHistory = options.maxHistory;
    if (options?.onMetric !== undefined) this.onDiagnosticMetricCallback = options.onMetric;
    console.log('[AudioStreamer Diagnostics] Enabled. Telemetry logging active.');
  }

  disableDiagnostics(): void {
    this.diagnosticsEnabled = false;
    console.log('[AudioStreamer Diagnostics] Disabled.');
  }

  setOnDiagnosticMetric(callback: ((metric: AudioChunkMetric) => void) | null): void {
    this.onDiagnosticMetricCallback = callback;
  }

  /**
   * Reset diagnostic metrics counters
   */
  clearDiagnostics(): void {
    this.chunkSequence = 0;
    this.totalSamples = 0;
    this.speechChunksCount = 0;
    this.silenceChunksCount = 0;
    this.clippingCount = 0;
    this.rmsSum = 0;
    this.peakAmplitudeEver = 0;
    this.recentChunks = [];
    this.lastChunkTime = null;
  }

  /**
   * Retrieve structured diagnostic telemetry summary
   */
  getDiagnosticSummary(): AudioDiagnosticSummary {
    const hwRate = this.audioContext?.sampleRate || 0;
    const avgRms = this.chunkSequence > 0 ? this.rmsSum / this.chunkSequence : 0;
    const totalDuration = this.totalSamples / this.targetSampleRate;

    return {
      isStreaming: this.isStreaming,
      isMuted: this.isMuted,
      hardwareSampleRate: hwRate,
      targetSampleRate: this.targetSampleRate,
      totalChunks: this.chunkSequence,
      totalSamples: this.totalSamples,
      totalDurationSeconds: Math.round(totalDuration * 10) / 10,
      speechChunksCount: this.speechChunksCount,
      silenceChunksCount: this.silenceChunksCount,
      clippingCount: this.clippingCount,
      averageRms: Math.round(avgRms * 1000) / 1000,
      peakAmplitudeEver: this.peakAmplitudeEver,
      recentChunks: [...this.recentChunks],
      lastChunkTimestamp: this.lastChunkTime,
    };
  }

  async start(onAudioChunk: (base64PCM: string) => void): Promise<void> {
    if (this.isStreaming) {
      return;
    }

    this.onAudioChunkCallback = onAudioChunk;

    // Ensure audio context is ready
    await this.unlock();

    // Request microphone stream
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (this.audioContext!.state === 'suspended') {
      await this.audioContext!.resume();
    }

    this.sourceNode = this.audioContext!.createMediaStreamSource(this.mediaStream);

    // Analyser node for visualizer & live mic volume meter
    this.analyserNode = this.audioContext!.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.75;

    // Buffer size 2048 gives ~42ms at 48kHz, responsive low latency for live speech VAD
    const bufferSize = 2048;
    this.processorNode = this.audioContext!.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      // 1. Prevent mic feedback to speakers while keeping audio graph active in Chrome/Safari
      const outputData = e.outputBuffer.getChannelData(0);
      outputData.fill(0);

      if (!this.isStreaming) return;

      const inputBuffer = e.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);

      // If muted, send silence so model VAD stays synchronized
      if (this.isMuted) {
        const silenceSamples = Math.floor(inputData.length * (this.targetSampleRate / inputBuffer.sampleRate));
        const silencePCM = new Int16Array(silenceSamples);
        const b64 = this.pcm16ToBase64(silencePCM);
        this.observeSpeech(silencePCM);
        if (this.diagnosticsEnabled) {
          this.recordChunkDiagnostic(silencePCM, b64, inputBuffer.sampleRate);
        }
        this.onAudioChunkCallback?.(b64);
        return;
      }

      // Downsample input to 16000 Hz PCM16
      const pcm16Data = this.downsampleToPCM16(
        inputData,
        inputBuffer.sampleRate,
        this.targetSampleRate
      );

      if (pcm16Data.length > 0 && this.onAudioChunkCallback) {
        this.observeSpeech(pcm16Data);
        const base64 = this.pcm16ToBase64(pcm16Data);
        if (this.diagnosticsEnabled) {
          this.recordChunkDiagnostic(pcm16Data, base64, inputBuffer.sampleRate);
        }
        this.onAudioChunkCallback(base64);
      }
    };

    this.sourceNode.connect(this.analyserNode);
    this.sourceNode.connect(this.processorNode);
    // Connecting directly to destination keeps processor alive across all browsers
    this.processorNode.connect(this.audioContext!.destination);

    this.isStreaming = true;
    console.log(
      `%c[AudioStreamer] Microphone streaming started at hardware rate: ${this.audioContext!.sampleRate}Hz -> target: 16000Hz PCM16`,
      'color: #10b981; font-weight: bold;'
    );
  }

  /**
   * Track utterance boundaries independently of optional diagnostic logging.
   * Allow natural pauses in long commands, independent of microphone sample rate.
   */
  private observeSpeech(pcm: Int16Array): void {
    let energy = 0;
    for (const sample of pcm) energy += (sample / 32768) ** 2;
    const voiced = pcm.length > 0 && Math.sqrt(energy / pcm.length) >= 0.008;
    const duration = pcm.length / this.targetSampleRate * 1000;
    if (voiced) {
      this.silenceDurationMs = 0;
      this.voiceDurationMs += duration;
      if (!this.speechActive && this.voiceDurationMs >= 85) {
        this.speechActive = true;
        this.onSpeechStartCallback?.();
      }
    } else {
      this.voiceDurationMs = 0;
      this.silenceDurationMs += duration;
      if (this.speechActive && this.silenceDurationMs >= 1200) {
        this.speechActive = false;
        this.onSpeechEndCallback?.();
      }
    }
  }

  /**
   * Diagnostic verification & metric calculation for raw PCM16 chunk
   */
  private recordChunkDiagnostic(
    pcm16Data: Int16Array,
    base64: string,
    inputSampleRate: number
  ): AudioChunkMetric {
    this.chunkSequence++;
    const now = performance.now();
    const durationMs = Math.round((pcm16Data.length / this.targetSampleRate) * 1000);

    // Analyze raw PCM16 values
    let peak = 0;
    let sumSquares = 0;
    let hasClipping = false;

    for (let i = 0; i < pcm16Data.length; i++) {
      const val = pcm16Data[i];
      const absVal = Math.abs(val);
      if (absVal > peak) peak = absVal;
      sumSquares += (val / 32768.0) * (val / 32768.0);
      if (absVal >= 32760) hasClipping = true;
    }

    const rms = Math.sqrt(sumSquares / pcm16Data.length);
    const isSilence = rms < 0.008;

    this.totalSamples += pcm16Data.length;
    this.rmsSum += rms;
    if (peak > this.peakAmplitudeEver) this.peakAmplitudeEver = peak;
    if (isSilence) {
      this.silenceChunksCount++;
    } else {
      this.speechChunksCount++;
    }
    if (hasClipping) {
      this.clippingCount++;
    }

    // Encoding verification:
    // 1. Array buffer byteLength must be exactly length * 2
    // 2. Base64 must decode back to exact same byte length
    const expectedByteLen = pcm16Data.length * 2;
    const actualByteLen = pcm16Data.byteLength;
    const validByteLength = actualByteLen === expectedByteLen;

    let validBase64 = false;
    try {
      const decodedLen = atob(base64).length;
      validBase64 = decodedLen === actualByteLen;
    } catch (e) {
      validBase64 = false;
    }

    const validPcm = validByteLength && validBase64 && !Number.isNaN(rms);

    const metric: AudioChunkMetric = {
      sequenceNumber: this.chunkSequence,
      timestamp: now,
      sampleCount: pcm16Data.length,
      durationMs,
      inputSampleRate,
      targetSampleRate: this.targetSampleRate,
      peakAmplitude: peak,
      rms: Math.round(rms * 1000) / 1000,
      isSilence,
      isClipping: hasClipping,
      base64Length: base64.length,
      validPcm,
    };

    // Store in recent buffer
    this.recentChunks.unshift(metric);
    if (this.recentChunks.length > this.maxHistory) {
      this.recentChunks.pop();
    }
    this.lastChunkTime = now;

    // Fire callback
    this.onDiagnosticMetricCallback?.(metric);

    // Formatted console logging:
    // Log active speech chunks and every 30th silence chunk to avoid console spam while keeping full visibility
    if (this.logToConsole) {
      const shouldLog = !isSilence || this.chunkSequence % 30 === 1;
      if (shouldLog) {
        const stateColor = isSilence ? '#94a3b8' : '#38bdf8';
        const statusTag = isSilence ? 'SILENCE' : 'VOICE ACTIVE';
        console.log(
          `%c[AudioStreamer PCM]%c #${metric.sequenceNumber} [${statusTag}] | ` +
            `Samples: ${metric.sampleCount} (${metric.durationMs}ms) | ` +
            `Peak: ${metric.peakAmplitude} | RMS: ${metric.rms} | ` +
            `B64: ${metric.base64Length}b | Verified: ${metric.validPcm ? '✓ OK' : '✗ INVALID'}`,
          `color: ${stateColor}; font-weight: bold;`,
          'color: inherit;'
        );
      }
    }

    return metric;
  }

  stop(): void {
    this.isStreaming = false;
    this.speechActive = false;
    this.voiceDurationMs = 0;
    this.silenceDurationMs = 0;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
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
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.onAudioChunkCallback = null;
    console.log('[AudioStreamer] Microphone streaming stopped');
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  setAssistantSpeaking(speaking: boolean): void {
    this.isAssistantSpeaking = speaking;
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Returns current mic input audio volume level from 0 to 1
   */
  getAudioLevel(): number {
    if (!this.analyserNode || this.isMuted || !this.isStreaming) return 0;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray as any);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    return Math.min(1, average / 120);
  }

  getFrequencyData(array: Uint8Array): void {
    if (!this.analyserNode || this.isMuted || !this.isStreaming) {
      array.fill(0);
      return;
    }
    this.analyserNode.getByteFrequencyData(array as any);
  }

  getTimeDomainData(array: Uint8Array): void {
    if (!this.analyserNode || this.isMuted || !this.isStreaming) {
      array.fill(128);
      return;
    }
    this.analyserNode.getByteTimeDomainData(array as any);
  }

  /**
   * High-accuracy, phase-coherent continuous downsampling from inputRate to 16kHz PCM16.
   * Retains residual samples across chunks to prevent sample loss and phase jitter.
   * Applies an adaptive speech enhancer (tanh soft-knee limiter) so Gemini easily picks up
   * normal and quiet conversational inputs without clipping.
   * Applies intelligent acoustic ducking while Sameera is speaking to prevent speaker bleed self-interruptions.
   */
  private downsampleToPCM16(
    inputData: Float32Array,
    inputRate: number,
    targetRate: number
  ): Int16Array {
    // 1. Combine residual samples from previous chunk with fresh input data
    let combinedData: Float32Array;
    if (this.residualBuffer.length > 0) {
      combinedData = new Float32Array(this.residualBuffer.length + inputData.length);
      combinedData.set(this.residualBuffer, 0);
      combinedData.set(inputData, this.residualBuffer.length);
    } else {
      combinedData = inputData;
    }

    if (inputRate === targetRate) {
      const output = new Int16Array(combinedData.length);
      for (let i = 0; i < combinedData.length; i++) {
        let sample = combinedData[i];
        if (this.isAssistantSpeaking) {
          sample *= 0.35; // Acoustic ducking
        } else {
          sample = Math.tanh(sample * 1.35); // Clean speech boost
        }
        output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      this.residualBuffer = new Float32Array(0);
      return output;
    }

    const sampleRateRatio = inputRate / targetRate;
    // Calculate how many complete 16kHz output samples can be synthesized
    const maxOutputLength = Math.max(0, Math.floor((combinedData.length - 1) / sampleRateRatio));
    if (maxOutputLength === 0) {
      this.residualBuffer = combinedData;
      return new Int16Array(0);
    }

    const output = new Int16Array(maxOutputLength);
    let lastInputIndexUsed = 0;

    for (let i = 0; i < maxOutputLength; i++) {
      const position = i * sampleRateRatio;
      const index = Math.floor(position);
      const frac = position - index;

      const s0 = combinedData[index] || 0;
      const s1 = combinedData[index + 1] !== undefined ? combinedData[index + 1] : s0;
      let interpolated = s0 + (s1 - s0) * frac;

      // When Sameera is speaking, laptop speakers play into the mic.
      // Duck slightly (-9dB) to prevent false self-interruption, while allowing intentional loud speech to interrupt.
      if (this.isAssistantSpeaking) {
        interpolated *= 0.35;
      } else {
        // Natural speech boost with soft-knee limiter:
        // Boosts conversational and whisper levels by ~1.35x (+3.5dB) without harsh digital clipping.
        // Solves "doesn't take inputs easily" during long conversations.
        interpolated = Math.tanh(interpolated * 1.38);
      }

      const clamped = Math.max(-1, Math.min(1, interpolated));
      output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      lastInputIndexUsed = index + 1;
    }

    // Preserve residual samples that fall after the last resampled position
    if (lastInputIndexUsed < combinedData.length) {
      this.residualBuffer = combinedData.slice(lastInputIndexUsed);
    } else {
      this.residualBuffer = new Float32Array(0);
    }

    return output;
  }

  /**
   * Converts Int16Array PCM buffer to Base64 string
   */
  private pcm16ToBase64(pcmData: Int16Array): string {
    const uint8 = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const sub = uint8.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, sub as any);
    }
    return btoa(binary);
  }
}
