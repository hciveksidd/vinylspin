/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Peak |amplitude| per bucket, normalised so the loudest bucket is 1. */
export function computePeaks(channel: Float32Array, buckets: number): Float32Array {
  const peaks = new Float32Array(buckets);
  if (channel.length === 0 || buckets <= 0) return peaks;
  const size = channel.length / buckets;
  let max = 0;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * size);
    const to = Math.max(from + 1, Math.floor((b + 1) * size));
    let peak = 0;
    for (let i = from; i < to && i < channel.length; i++) {
      const v = Math.abs(channel[i]);
      if (v > peak) peak = v;
    }
    peaks[b] = peak;
    if (peak > max) max = peak;
  }
  if (max > 0) for (let b = 0; b < buckets; b++) peaks[b] /= max;
  return peaks;
}

export interface Segment {
  start: number; // seconds
  duration: number; // seconds
}

export const MIN_SEGMENT_SECONDS = 1;

/** Keeps a segment inside [0, total]: at least 1 s long (if the track allows) and never past the end. */
export function clampSegment(start: number, duration: number, total: number): Segment {
  if (!(total > 0)) return { start: 0, duration: Math.max(MIN_SEGMENT_SECONDS, Number.isFinite(duration) ? duration : MIN_SEGMENT_SECONDS) };
  const minLen = Math.min(MIN_SEGMENT_SECONDS, total);
  const len = Math.min(total, Math.max(minLen, Number.isFinite(duration) ? duration : minLen));
  const from = Math.min(total - len, Math.max(0, Number.isFinite(start) ? start : 0));
  return { start: from, duration: len };
}

/**
 * Like clampSegment, but for a typed start time: the start is honoured and the window shrinks to fit
 * instead of sliding back. The start is kept far enough from the end to leave the minimum length.
 */
export function clampSegmentKeepStart(start: number, duration: number, total: number): Segment {
  if (!(total > 0)) return clampSegment(start, duration, total);
  const minLen = Math.min(MIN_SEGMENT_SECONDS, total);
  const from = Math.min(total - minLen, Math.max(0, Number.isFinite(start) ? start : 0));
  return { start: from, duration: Math.min(Math.max(minLen, Number.isFinite(duration) ? duration : minLen), total - from) };
}

/** "75" -> 75, "1:15" -> 75, "1:15.5" -> 75.5; null when it isn't a time. */
export function parseTime(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** 75 -> "1:15", 3725 -> "1:02:05". Fractions are truncated. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
