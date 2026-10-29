import { describe, expect, it } from 'vitest';
import { loopRevolutions, seamlessLoopDuration } from '../loopRenderer';

describe('seamlessLoopDuration', () => {
  it('snaps to a whole number of revolutions', () => {
    const d = seamlessLoopDuration(5, 33);
    expect(loopRevolutions(d, 33)).toBe(3);
    expect(d).toBeCloseTo((3 * 60) / 33, 6);
  });

  it('stays inside the Spotify 3–8s window', () => {
    for (const rpm of [33, 45, 78]) {
      for (const target of [3, 5, 8]) {
        const d = seamlessLoopDuration(target, rpm, 3, 8);
        expect(d).toBeGreaterThanOrEqual(3);
        expect(d).toBeLessThanOrEqual(8);
      }
    }
  });

  it('uses at least one revolution even for tiny targets', () => {
    expect(seamlessLoopDuration(0.1, 33)).toBeCloseTo(60 / 33, 6);
  });

  it('clamps the target when the disc does not spin', () => {
    expect(seamlessLoopDuration(12, 0, 3, 8)).toBe(8);
    expect(seamlessLoopDuration(1, 0, 3, 8)).toBe(3);
  });
});
