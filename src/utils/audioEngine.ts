/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { computePeaks } from './waveform';

export interface BuiltinPreset {
  id: string;
  title: string;
  artist: string;
  album: string;
  bpm: number;
  genre: string;
  key: string;
}

export const PRESET_TRACKS: BuiltinPreset[] = [
  {
    id: 'synthwave',
    title: 'Neon Odyssey',
    artist: 'VaporPulse',
    album: 'Synthetic Horizons',
    bpm: 120,
    genre: 'Synthwave / Retrowave',
    key: 'Fm (4A)',
  },
  {
    id: 'lofi',
    title: 'Rainy Cafe Walk',
    artist: 'ChillHop Monk',
    album: 'Cassette Memories',
    bpm: 84,
    genre: 'Lo-Fi Chillhop',
    key: 'C Maj (8B)',
  },
  {
    id: 'deephouse',
    title: 'Subterranean Groove',
    artist: 'Studio 909',
    album: 'Late Night Sessions',
    bpm: 124,
    genre: 'Deep Melodic House',
    key: 'Am (8A)',
  },
  {
    id: 'phonk',
    title: 'Midnight Drift',
    artist: 'Kage Krew',
    album: 'Tokyo Underground',
    bpm: 138,
    genre: 'Drift Phonk',
    key: 'Dm (7A)',
  },
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private gainNode: GainNode | null = null;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private isSynthesizing = false;
  private synthInterval: number | null = null;
  private currentPresetId: string = 'synthwave';
  private crackleNode: AudioBufferSourceNode | null = null;
  private crackleGain: GainNode | null = null;
  private isCrackleEnabled = false;

  private isPlaying = false;
  private volume = 0.9;
  // Playback position bookkeeping for user files: position = offset + (ctx.currentTime - startedAt)
  private startedAt = 0;
  private offset = 0;
  // Set while previewing a segment: playback ends at segmentEnd and rewinds to segmentStart
  private segmentStart: number | null = null;
  private segmentEnd: number | null = null;
  private listeners = new Set<(playing: boolean) => void>();

  constructor() {
    // Lazy initialize upon user gesture
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.volume;

      this.streamDestination = this.ctx.createMediaStreamDestination();

      // Connect master gain to hardware output and to stream destination (for video capture)
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.analyser.connect(this.streamDestination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public getStreamDestination(): MediaStreamAudioDestinationNode | null {
    this.initContext();
    return this.streamDestination;
  }

  // Reused every frame to avoid allocating in the render loop; callers must not keep references
  private freqBuffer = new Uint8Array(128);
  private waveBuffer = new Uint8Array(128);

  public getFrequencyData(): Uint8Array {
    if (this.analyser) this.analyser.getByteFrequencyData(this.freqBuffer);
    return this.freqBuffer;
  }

  public getWaveformData(): Uint8Array {
    if (this.analyser) this.analyser.getByteTimeDomainData(this.waveBuffer);
    return this.waveBuffer;
  }

  public getBassEnergy(): number {
    const freqs = this.getFrequencyData();
    if (freqs.length === 0) return 0;
    // average first 6 bins (low bass / kick)
    let sum = 0;
    const count = Math.min(6, freqs.length);
    for (let i = 0; i < count; i++) {
      sum += freqs[i];
    }
    return sum / (count * 255);
  }

  /** Subscribe to play/pause changes; returns an unsubscribe function. */
  public subscribe(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setPlaying(playing: boolean) {
    if (this.isPlaying === playing) return;
    this.isPlaying = playing;
    this.listeners.forEach((l) => l(playing));
  }

  public async loadUserFile(file: File): Promise<{ duration: number }> {
    this.initContext();
    this.stop();
    this.isSynthesizing = false;

    const arrayBuffer = await file.arrayBuffer();
    if (!this.ctx) throw new Error('AudioContext failed');
    this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.offset = 0;
    return { duration: this.audioBuffer.duration };
  }

  public hasUserTrack(): boolean {
    return this.audioBuffer !== null;
  }

  /** Duration of the loaded user file in seconds, or 0 for procedural presets. */
  public getDuration(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  /** Current position in the loaded user file in seconds, or 0 for procedural presets. */
  public getCurrentTime(): number {
    if (!this.audioBuffer) return 0;
    if (this.isPlaying && this.ctx) {
      return Math.min(this.audioBuffer.duration, this.offset + this.ctx.currentTime - this.startedAt);
    }
    return this.offset;
  }

  public play() {
    this.initContext();
    if (this.isPlaying) return;

    if (this.audioBuffer && this.ctx && this.gainNode) {
      // Play loaded user file from the saved position
      if (this.offset >= this.audioBuffer.duration) this.offset = 0;
      const playLength = this.segmentEnd !== null ? Math.max(0.01, this.segmentEnd - this.offset) : undefined;
      const source = this.ctx.createBufferSource();
      source.buffer = this.audioBuffer;
      source.connect(this.gainNode);
      source.onended = () => {
        // Ignore sources we stopped ourselves (pause / seek / stop)
        if (this.sourceNode !== source) return;
        this.sourceNode = null;
        this.offset = this.segmentStart ?? 0;
        this.segmentStart = null;
        this.segmentEnd = null;
        this.stopVinylCrackle();
        this.setPlaying(false);
      };
      this.sourceNode = source;
      this.startedAt = this.ctx.currentTime;
      source.start(0, this.offset, playLength);
      this.setPlaying(true);
    } else {
      // Play procedural audio synth loop (its step callback checks isPlaying)
      this.setPlaying(true);
      this.startSynthLoop(this.currentPresetId);
    }

    if (this.isCrackleEnabled) {
      this.startVinylCrackle();
    }
  }

  /** Pause playback, keeping the current position. */
  public pause() {
    if (!this.isPlaying) return;
    this.offset = this.getCurrentTime();
    this.segmentStart = null;
    this.segmentEnd = null;
    this.stopSource();
    this.stopSynthLoop();
    this.stopVinylCrackle();
    this.setPlaying(false);
  }

  /** Stop playback and rewind to the start. */
  public stop() {
    this.pause();
    this.offset = 0;
  }

  /** Preview part of the loaded track; it stops by itself at the end of the segment. */
  public playSegment(start: number, duration: number) {
    if (!this.audioBuffer) return;
    this.pause();
    this.offset = Math.max(0, Math.min(start, this.audioBuffer.duration));
    this.segmentStart = this.offset;
    this.segmentEnd = Math.min(this.audioBuffer.duration, this.offset + duration);
    this.play();
  }

  /** Normalised waveform peaks of the loaded track, or null when no file is loaded. */
  public getPeaks(buckets: number): Float32Array | null {
    return this.audioBuffer ? computePeaks(this.audioBuffer.getChannelData(0), buckets) : null;
  }

  /** Jump to a position (seconds) in the user file; restarts the preset loop from its first step. */
  public seek(seconds: number) {
    const wasPlaying = this.isPlaying;
    this.pause();
    this.offset = this.audioBuffer ? Math.max(0, Math.min(seconds, this.audioBuffer.duration)) : 0;
    if (wasPlaying) this.play();
  }

  private stopSource() {
    if (this.sourceNode) {
      const source = this.sourceNode;
      this.sourceNode = null;
      try {
        (source as AudioBufferSourceNode).stop();
        source.disconnect();
      } catch {
        // ignore already stopped
      }
    }
  }

  public togglePlay(): boolean {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public selectPreset(presetId: string) {
    this.currentPresetId = presetId;
    const wasPlaying = this.isPlaying;
    this.stop();
    this.audioBuffer = null; // clear user buffer to use synth preset
    if (wasPlaying) this.play();
  }

  public setVinylCrackle(enabled: boolean) {
    this.isCrackleEnabled = enabled;
    if (enabled && this.isPlaying) {
      this.startVinylCrackle();
    } else {
      this.stopVinylCrackle();
    }
  }

  // Real Web Audio procedural music synthesis for rich demo audio without external files
  private startSynthLoop(presetId: string) {
    if (!this.ctx || !this.gainNode) return;
    this.isSynthesizing = true;

    let step = 0;
    const bpm = presetId === 'lofi' ? 84 : presetId === 'deephouse' ? 124 : presetId === 'phonk' ? 138 : 120;
    const intervalMs = (60 / bpm / 4) * 1000; // 16th notes

    const playStep = () => {
      if (!this.isPlaying || !this.ctx || !this.gainNode) return;
      const t = this.ctx.currentTime;

      // Kick drum on 1, 5, 9, 13 (or breakbeat for lofi)
      const isKick = presetId === 'lofi'
        ? (step % 16 === 0 || step % 16 === 10)
        : (step % 4 === 0);

      if (isKick) {
        this.playKick(t);
      }

      // Snare / Clap on 5, 13
      const isSnare = (step % 8 === 4);
      if (isSnare) {
        this.playSnare(t, presetId === 'lofi');
      }

      // Hi-hat on every 8th note
      if (step % 2 === 0) {
        this.playHiHat(t, step % 4 === 2);
      }

      // Bass notes & chords
      if (step % 4 === 0) {
        this.playBassNote(t, presetId, Math.floor(step / 4) % 4);
      }

      if (step % 8 === 0) {
        this.playChords(t, presetId, Math.floor(step / 8) % 4);
      }

      step++;
    };

    playStep();
    this.synthInterval = window.setInterval(playStep, intervalMs);
  }

  private stopSynthLoop() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  private playKick(t: number) {
    if (!this.ctx || !this.gainNode) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);

    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(g);
    g.connect(this.gainNode);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private playSnare(t: number, soft: boolean) {
    if (!this.ctx || !this.gainNode) return;
    // Noise buffer
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = soft ? 800 : 1200;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(soft ? 0.25 : 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (soft ? 0.12 : 0.18));

    whiteNoise.connect(filter);
    filter.connect(g);
    g.connect(this.gainNode);

    whiteNoise.start(t);
  }

  private playHiHat(t: number, open: boolean) {
    if (!this.ctx || !this.gainNode) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 10000;

    const g = this.ctx.createGain();
    const duration = open ? 0.08 : 0.03;
    g.gain.setValueAtTime(open ? 0.12 : 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.gainNode);

    osc.start(t);
    osc.stop(t + duration);
  }

  private playBassNote(t: number, presetId: string, barIndex: number) {
    if (!this.ctx || !this.gainNode) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    const notes = presetId === 'synthwave'
      ? [43.65, 43.65, 38.89, 48.99] // F1, F1, Eb1, G1
      : presetId === 'phonk'
      ? [36.71, 36.71, 41.20, 32.70] // D1, D1, E1, C1
      : [55.0, 49.0, 43.65, 51.91]; // A1, G1, F1, Ab1

    const freq = notes[barIndex % notes.length];
    osc.type = presetId === 'phonk' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(g);
    g.connect(this.gainNode);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  private playChords(t: number, presetId: string, barIndex: number) {
    if (!this.ctx || !this.gainNode) return;
    const chords: number[][] = presetId === 'synthwave'
      ? [[174.6, 220.0, 261.6], [155.6, 196.0, 233.1], [130.8, 164.8, 196.0], [174.6, 207.7, 261.6]]
      : presetId === 'lofi'
      ? [[261.6, 329.6, 392.0, 493.9], [220.0, 261.6, 329.6, 392.0], [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 349.2]]
      : [[220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7], [164.8, 196.0, 246.9]];

    const chord = chords[barIndex % chords.length];
    chord.forEach((freq) => {
      if (!this.ctx || !this.gainNode) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = presetId === 'lofi' ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      // Low pass filter to make warm
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(presetId === 'lofi' ? 1200 : 2400, t);

      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.gainNode);

      osc.start(t);
      osc.stop(t + 0.72);
    });
  }

  private startVinylCrackle() {
    if (!this.ctx || !this.gainNode || this.crackleNode) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Occasional pops & steady warm pink noise
      const isPop = Math.random() < 0.0003;
      data[i] = isPop ? (Math.random() * 2 - 1) * 0.8 : (Math.random() * 2 - 1) * 0.015;
    }

    this.crackleNode = this.ctx.createBufferSource();
    this.crackleNode.buffer = buffer;
    this.crackleNode.loop = true;

    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.value = 0.15;

    this.crackleNode.connect(this.crackleGain);
    this.crackleGain.connect(this.gainNode);
    this.crackleNode.start();
  }

  private stopVinylCrackle() {
    if (this.crackleNode) {
      try {
        this.crackleNode.stop();
        this.crackleNode.disconnect();
      } catch {
        // ignore
      }
      this.crackleNode = null;
    }
  }
}

export const globalAudioEngine = new AudioEngine();
