/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fixWebmDuration from 'fix-webm-duration';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { globalAudioEngine } from './audioEngine';
import { SceneInputs, createLoopRenderer } from './loopRenderer';

export interface VideoExportOptions {
  canvas: HTMLCanvasElement;
  durationSeconds: number; // e.g. 5 seconds for loop / Spotify Canvas
  fps: number; // 30 or 60
  includeAudio: boolean; // Spotify Canvas must be silent
  onProgress?: (progressPercent: number) => void;
  signal?: AbortSignal;
}

export interface VideoExportResult {
  blob: Blob;
  mimeType: string;
  extension: 'mp4' | 'webm';
}

// H.264 MP4 first: it plays everywhere (Spotify, Instagram, iOS). Without H.264 (e.g. Chromium,
// Firefox) prefer WebM over a bare 'video/mp4', which may hold VP9 that many players reject.
// Bare 'video/mp4' stays last for Safari, which records MP4 only.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

export function pickVideoMimeType(isSupported: (mime: string) => boolean = (m) => MediaRecorder.isTypeSupported(m)): string {
  return MIME_CANDIDATES.find((mime) => isSupported(mime)) ?? 'video/webm';
}

export async function exportVideo(options: VideoExportOptions): Promise<VideoExportResult> {
  const { canvas, durationSeconds, fps, includeAudio, onProgress, signal } = options;

  // 1. Get canvas video stream
  const canvasStream = canvas.captureStream(fps);
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

  // 2. Rewind and start the audio so the recording begins at the top of the track with sound
  const wasPlaying = globalAudioEngine.getIsPlaying();
  if (includeAudio) {
    const audioDestination = globalAudioEngine.getStreamDestination();
    const audioTrack = audioDestination?.stream.getAudioTracks()[0];
    if (audioTrack) tracks.push(audioTrack);
    globalAudioEngine.seek(0);
    globalAudioEngine.play();
  }

  const combinedStream = new MediaStream(tracks);
  const mimeType = pickVideoMimeType();
  const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const durationMs = durationSeconds * 1000;
    let aborted = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(99, Math.round((elapsed / durationMs) * 100));
      if (onProgress) onProgress(progress);
    }, 100);

    const cleanup = () => {
      clearInterval(interval);
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      canvasStream.getVideoTracks().forEach((t) => t.stop());
      if (includeAudio && !wasPlaying) globalAudioEngine.pause();
    };

    const onAbort = () => {
      aborted = true;
      if (recorder.state === 'recording') recorder.stop();
    };

    recorder.onstop = () => {
      cleanup();
      if (aborted) {
        reject(new DOMException('Export cancelled', 'AbortError'));
        return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      const finish = (result: Blob) => {
        if (onProgress) onProgress(100);
        resolve({ blob: result, mimeType, extension });
      };
      // MediaRecorder writes WebM without a duration header, so players can't seek; patch it in
      if (extension === 'webm') {
        fixWebmDuration(blob, performance.now() - startTime, { logger: false }).then(finish, () => finish(blob));
      } else {
        finish(blob);
      }
    };

    recorder.onerror = (err) => {
      cleanup();
      reject(err);
    };

    signal?.addEventListener('abort', onAbort);
    recorder.start(1000);
    if (signal?.aborted) onAbort();

    timeout = setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, durationMs);
  });
}

export interface LoopExportOptions {
  inputs: SceneInputs;
  durationSeconds: number; // should come from seamlessLoopDuration()
  fps: number;
  onProgress?: (progressPercent: number) => void;
  signal?: AbortSignal;
}

function abortError() {
  return new DOMException('Export cancelled', 'AbortError');
}

/**
 * Records a silent, seamless loop. Frames are rendered from the loop phase onto an offscreen canvas
 * and pushed to the recorder one by one at the target frame rate, so the last frame meets the first.
 */
export async function exportSeamlessLoop(options: LoopExportOptions): Promise<VideoExportResult> {
  const { inputs, durationSeconds, fps, onProgress, signal } = options;
  const loop = createLoopRenderer(inputs, durationSeconds, fps);
  loop.renderAt(0);

  const stream = loop.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const mimeType = pickVideoMimeType();
  const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let aborted = false;
    const startTime = performance.now();

    const onAbort = () => {
      aborted = true;
      clearTimeout(timer);
      if (recorder.state === 'recording') recorder.stop();
    };

    // Drift-corrected pacing: frame i is pushed at startTime + i / fps
    const tick = () => {
      if (frame >= loop.totalFrames) {
        recorder.stop();
        return;
      }
      loop.renderAt(frame);
      track.requestFrame();
      frame++;
      if (onProgress) onProgress(Math.min(99, Math.round((frame / loop.totalFrames) * 100)));
      timer = setTimeout(tick, Math.max(0, startTime + (frame * 1000) / fps - performance.now()));
    };

    recorder.onstop = () => {
      signal?.removeEventListener('abort', onAbort);
      track.stop();
      if (aborted) {
        reject(abortError());
        return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      const finish = (result: Blob) => {
        if (onProgress) onProgress(100);
        resolve({ blob: result, mimeType, extension });
      };
      if (extension === 'webm') {
        fixWebmDuration(blob, durationSeconds * 1000, { logger: false }).then(finish, () => finish(blob));
      } else {
        finish(blob);
      }
    };
    recorder.onerror = (err) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      track.stop();
      reject(err);
    };

    signal?.addEventListener('abort', onAbort);
    recorder.start(1000);
    if (signal?.aborted) onAbort();
    else tick();
  });
}

export interface GifExportOptions {
  inputs: SceneInputs;
  durationSeconds: number; // should come from seamlessLoopDuration()
  fps: number; // GIF delays are in 1/100 s, so 10, 20, 25 or 50 keep timing exact
  maxWidth: number;
  onProgress?: (progressPercent: number) => void;
  signal?: AbortSignal;
}

/** Encodes a seamless looping GIF entirely in the browser. */
export async function exportGif(options: GifExportOptions): Promise<Blob> {
  const { inputs, durationSeconds, fps, maxWidth, onProgress, signal } = options;
  const loop = createLoopRenderer(inputs, durationSeconds, fps);

  const scale = Math.min(1, maxWidth / loop.canvas.width);
  const width = Math.round(loop.canvas.width * scale);
  const height = Math.round(loop.canvas.height * scale);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const outCtx = out.getContext('2d', { willReadFrequently: true });
  if (!outCtx) throw new Error('Canvas 2D context unavailable');

  const grab = (frame: number) => {
    loop.renderAt(frame);
    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(loop.canvas, 0, 0, width, height);
    return outCtx.getImageData(0, 0, width, height).data;
  };

  // One shared palette sampled across the loop avoids per-frame colour flicker
  const samples = [0, 1, 2].map((k) => grab(Math.floor((k * loop.totalFrames) / 3)));
  const combined = new Uint8ClampedArray(samples.reduce((n, s) => n + s.length, 0));
  samples.reduce((offset, s) => {
    combined.set(s, offset);
    return offset + s.length;
  }, 0);
  const palette = quantize(combined, 256);

  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (let frame = 0; frame < loop.totalFrames; frame++) {
    if (signal?.aborted) throw abortError();
    const index = applyPalette(grab(frame), palette);
    gif.writeFrame(index, width, height, frame === 0 ? { palette, delay, repeat: 0 } : { delay });
    if (onProgress) onProgress(Math.min(99, Math.round(((frame + 1) / loop.totalFrames) * 100)));
    // Yield so the progress bar repaints and Cancel stays clickable
    await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();
  if (onProgress) onProgress(100);
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCanvasSnapshot(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, filename);
    }
  }, 'image/png');
}
