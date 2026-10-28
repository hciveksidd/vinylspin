/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fixWebmDuration from 'fix-webm-duration';
import { globalAudioEngine } from './audioEngine';

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
