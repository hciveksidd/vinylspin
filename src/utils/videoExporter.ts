/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalAudioEngine } from './audioEngine';

export interface VideoExportOptions {
  canvas: HTMLCanvasElement;
  durationSeconds: number; // e.g. 5 seconds for loop / Spotify Canvas
  fps: number; // 30 or 60
  filename: string;
  onProgress?: (progressPercent: number) => void;
}

export async function exportVideo(options: VideoExportOptions): Promise<Blob> {
  const { canvas, durationSeconds, fps, onProgress } = options;

  // 1. Get canvas video stream
  const canvasStream = canvas.captureStream(fps);

  // 2. Get audio stream from Web Audio engine
  const audioDestination = globalAudioEngine.getStreamDestination();
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

  if (audioDestination && audioDestination.stream.getAudioTracks().length > 0) {
    tracks.push(audioDestination.stream.getAudioTracks()[0]);
  }

  const combinedStream = new MediaStream(tracks);

  // 3. Supported MIME types
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  let selectedMime = 'video/webm';
  for (const mime of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mime)) {
      selectedMime = mime;
      break;
    }
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 6_000_000, // 6 Mbps high quality
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

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(99, Math.round((elapsed / durationMs) * 100));
      if (onProgress) onProgress(progress);
    }, 100);

    recorder.onstop = () => {
      clearInterval(interval);
      if (onProgress) onProgress(100);
      const blob = new Blob(chunks, { type: selectedMime });
      resolve(blob);
    };

    recorder.onerror = (err) => {
      clearInterval(interval);
      reject(err);
    };

    recorder.start();

    setTimeout(() => {
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
