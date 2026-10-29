/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ArtworkMode = 'photo' | 'spin';
export type ArtworkFit = 'cover' | 'contain';

export interface ArtworkRenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  image: HTMLImageElement | null;
  mode: ArtworkMode;
  fit: ArtworkFit; // photo mode only
  rotation: number; // radians, spin mode only
  background: string;
}

export function spinGeometry(width: number, height: number) {
  const radius = Math.min(width, height) * 0.42;
  return { cx: width / 2, cy: height / 2, radius, holeRadius: radius * 0.03 };
}

/** Scale and offset that fit (contain) or fill (cover) a w×h source into a W×H box, centred. */
export function fitRect(srcW: number, srcH: number, boxW: number, boxH: number, fit: ArtworkFit) {
  const scale = fit === 'cover' ? Math.max(boxW / srcW, boxH / srcH) : Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

/** Plain frame: flat background plus the artwork, nothing else. */
export function renderArtwork(o: ArtworkRenderOptions) {
  const { ctx, width, height, image, mode } = o;
  ctx.save();
  ctx.fillStyle = o.background;
  ctx.fillRect(0, 0, width, height);

  if (!image) {
    ctx.restore();
    return;
  }

  if (mode === 'photo') {
    const r = fitRect(image.naturalWidth, image.naturalHeight, width, height, o.fit);
    ctx.drawImage(image, r.x, r.y, r.w, r.h);
  } else {
    const { cx, cy, radius, holeRadius } = spinGeometry(width, height);
    // Square crop from the image centre so a non-square picture fills the circle without stretching
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;

    ctx.translate(cx, cy);
    ctx.rotate(o.rotation);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.arc(0, 0, holeRadius, 0, Math.PI * 2, true); // opposite winding cuts the centre hole out of the clip
    ctx.clip();
    ctx.drawImage(image, sx, sy, side, side, -radius, -radius, radius * 2, radius * 2);
  }
  ctx.restore();
}
