import { describe, expect, it } from 'vitest';
import { TAP_WINDOW_MS, bpmFromTaps, recentTaps } from '../bpm';

describe('bpmFromTaps', () => {
  it('needs at least two taps', () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([100])).toBeNull();
  });

  it('averages the tap intervals', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
    expect(bpmFromTaps([0, 480, 1000])).toBe(120);
  });
});

describe('recentTaps', () => {
  it('drops taps older than the window', () => {
    expect(recentTaps([0, 1000, TAP_WINDOW_MS + 500], TAP_WINDOW_MS + 500)).toEqual([1000, TAP_WINDOW_MS + 500]);
  });
});
