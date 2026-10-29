import { describe, expect, it } from 'vitest';
import { clampSegment, clampSegmentKeepStart, computePeaks, formatTime, parseTime } from '../waveform';

describe('computePeaks', () => {
  it('takes the loudest sample per bucket and normalises to 1', () => {
    const data = new Float32Array([0.1, -0.2, 0.05, 0.5, -0.4, 0.25, 0, 0]);
    const peaks = computePeaks(data, 4);
    [0.4, 1, 0.8, 0].forEach((v, i) => expect(peaks[i]).toBeCloseTo(v, 5));
  });

  it('returns zeros for silence and handles empty input', () => {
    expect(Array.from(computePeaks(new Float32Array(10), 5))).toEqual([0, 0, 0, 0, 0]);
    expect(computePeaks(new Float32Array(0), 3).length).toBe(3);
  });
});

describe('clampSegment', () => {
  it('keeps the window inside the track', () => {
    expect(clampSegment(95, 10, 100)).toEqual({ start: 90, duration: 10 });
    expect(clampSegment(-5, 10, 100)).toEqual({ start: 0, duration: 10 });
  });

  it('enforces the minimum and maximum length', () => {
    expect(clampSegment(10, 0.2, 100).duration).toBe(1);
    expect(clampSegment(10, 500, 100)).toEqual({ start: 0, duration: 100 });
  });

  it('survives NaN and unknown track length', () => {
    expect(clampSegment(NaN, NaN, 100)).toEqual({ start: 0, duration: 1 });
    expect(clampSegment(5, 10, 0)).toEqual({ start: 0, duration: 10 });
  });
});

describe('clampSegmentKeepStart', () => {
  it('shrinks the window instead of moving the typed start', () => {
    expect(clampSegmentKeepStart(10, 15, 20)).toEqual({ start: 10, duration: 10 });
  });

  it('keeps room for the minimum length when the start is at the very end', () => {
    expect(clampSegmentKeepStart(500, 15, 20)).toEqual({ start: 19, duration: 1 });
  });

  it('leaves a window that already fits unchanged', () => {
    expect(clampSegmentKeepStart(3, 5, 20)).toEqual({ start: 3, duration: 5 });
  });
});

describe('parseTime / formatTime', () => {
  it('parses seconds and m:ss', () => {
    expect(parseTime('75')).toBe(75);
    expect(parseTime('1:15')).toBe(75);
    expect(parseTime(' 1:02:05 ')).toBe(3725);
    expect(parseTime('1:15.5')).toBe(75.5);
  });

  it('rejects junk', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('a:10')).toBeNull();
    expect(parseTime('-5')).toBeNull();
    expect(parseTime('1:2:3:4')).toBeNull();
  });

  it('formats back', () => {
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});
