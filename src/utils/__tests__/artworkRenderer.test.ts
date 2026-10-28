import { describe, expect, it } from 'vitest';
import { fitRect, spinGeometry } from '../artworkRenderer';

describe('spinGeometry', () => {
  it('centres a circle sized by the short side', () => {
    const g = spinGeometry(1920, 1080);
    expect(g.cx).toBe(960);
    expect(g.cy).toBe(540);
    expect(g.radius).toBeCloseTo(1080 * 0.42);
    expect(g.holeRadius).toBeLessThan(g.radius * 0.05);
  });

  it('stays inside the frame in every aspect ratio', () => {
    for (const [w, h] of [[1080, 1080], [1080, 1920], [1920, 1080], [1080, 1350]]) {
      const g = spinGeometry(w, h);
      expect(g.cx - g.radius).toBeGreaterThan(0);
      expect(g.cy - g.radius).toBeGreaterThan(0);
    }
  });
});

describe('fitRect', () => {
  it('contain letterboxes, cover fills', () => {
    expect(fitRect(1000, 500, 1080, 1080, 'contain')).toEqual({ x: 0, y: 270, w: 1080, h: 540 });
    expect(fitRect(1000, 500, 1080, 1080, 'cover')).toEqual({ x: -540, y: 0, w: 2160, h: 1080 });
  });
});
