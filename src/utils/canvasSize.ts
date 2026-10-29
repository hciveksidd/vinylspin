/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AspectRatio } from '../types';

export interface CanvasSize {
  width: number;
  height: number;
  /** CSS aspect-ratio value for the preview element */
  css: string;
  label: string;
}

export const CANVAS_SIZES: Record<AspectRatio, CanvasSize> = {
  '1:1': { width: 1080, height: 1080, css: '1 / 1', label: '1080×1080 (Square)' },
  '9:16': { width: 1080, height: 1920, css: '9 / 16', label: '1080×1920 (Reels/TikTok)' },
  '16:9': { width: 1920, height: 1080, css: '16 / 9', label: '1920×1080 (YouTube)' },
  '4:5': { width: 1080, height: 1350, css: '4 / 5', label: '1080×1350 (Instagram Feed)' },
};

export function getCanvasSize(aspectRatio: AspectRatio): CanvasSize {
  return CANVAS_SIZES[aspectRatio];
}
