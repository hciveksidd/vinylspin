/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Taps older than this are forgotten, so a pause starts a fresh measurement. */
export const TAP_WINDOW_MS = 3000;

/** Keeps the taps inside the window ending at `now`. */
export function recentTaps(taps: number[], now: number): number[] {
  return taps.filter((t) => now - t < TAP_WINDOW_MS);
}

/** Average BPM of a series of tap timestamps (ms), or null with fewer than two taps. */
export function bpmFromTaps(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const avgInterval = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  return avgInterval > 0 ? Math.round(60000 / avgInterval) : null;
}
