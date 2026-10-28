/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudioToolId, TrackMetadata, VisualizerSettings } from '../types';
import { renderFrame } from './canvasRenderer';
import { getCanvasSize } from './canvasSize';

export interface SceneInputs {
  toolId: StudioToolId;
  metadata: TrackMetadata;
  settings: VisualizerSettings;
  coverImage: HTMLImageElement | null;
  showWatermark: boolean;
}

/**
 * Length of a seamless loop: a whole number of disc revolutions closest to `target`,
 * kept inside [min, max] when possible. With no rotation any length loops, so `target` is clamped.
 */
export function seamlessLoopDuration(target: number, rpm: number, min = 0, max = Infinity): number {
  if (rpm <= 0) return Math.min(max, Math.max(min, target));
  const period = 60 / rpm;
  const lo = Math.max(1, Math.ceil(min / period - 1e-9));
  const hi = Math.floor(max / period + 1e-9);
  const n = hi < lo ? lo : Math.min(hi, Math.max(lo, Math.round(target / period)));
  return n * period;
}

/** Number of full revolutions in a loop of `duration` seconds. */
export function loopRevolutions(duration: number, rpm: number): number {
  return rpm <= 0 ? 0 : Math.round((duration * rpm) / 60);
}

/**
 * Renders frames of a seamless loop onto an offscreen canvas at full output resolution.
 * Rotation and the stand-in spectrum are driven by loop phase, so frame `totalFrames` equals frame 0.
 */
export function createLoopRenderer(inputs: SceneInputs, durationSeconds: number, fps: number) {
  const { width, height } = getCanvasSize(inputs.settings.aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
  const revolutions = loopRevolutions(durationSeconds, inputs.settings.rotationSpeed);
  // Pulse the stand-in spectrum on whole beats-per-loop so it loops too
  const pulses = Math.max(1, Math.round((durationSeconds * inputs.metadata.bpm) / 60));
  const frequencyData = new Uint8Array(128);
  const waveformData = new Uint8Array(128);

  const renderAt = (frame: number) => {
    const phase = frame / totalFrames;
    const beat = 0.5 + 0.5 * Math.cos(2 * Math.PI * pulses * phase);
    for (let i = 0; i < frequencyData.length; i++) {
      const falloff = 1 - i / frequencyData.length;
      const ripple = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * phase + i * 0.37);
      frequencyData[i] = Math.round(255 * falloff * (0.25 + 0.45 * beat + 0.2 * ripple));
      waveformData[i] = Math.round(128 + 40 * beat * Math.sin(i * 0.3 + 2 * Math.PI * phase));
    }

    renderFrame({
      canvas,
      ctx,
      toolId: inputs.toolId,
      metadata: inputs.metadata,
      settings: inputs.settings,
      coverImage: inputs.coverImage,
      rotationAngle: 2 * Math.PI * revolutions * phase,
      time: frame / fps,
      frequencyData,
      waveformData,
      bassEnergy: 0.1 + 0.3 * beat,
      isWatermarked: inputs.showWatermark,
    });
  };

  return { canvas, totalFrames, renderAt };
}
