import { describe, expect, it } from 'vitest';
import { CANVAS_SIZES } from '../canvasSize';

describe('CANVAS_SIZES', () => {
  it('matches each aspect ratio', () => {
    for (const [ratio, size] of Object.entries(CANVAS_SIZES)) {
      const [w, h] = ratio.split(':').map(Number);
      expect(size.width / size.height).toBeCloseTo(w / h, 2);
      expect(size.label).toContain(`${size.width}×${size.height}`);
    }
  });
});
