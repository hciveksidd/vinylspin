import { describe, expect, it } from 'vitest';
import { pickVideoMimeType } from '../videoExporter';

describe('pickVideoMimeType', () => {
  it('prefers H.264 MP4 when available', () => {
    expect(pickVideoMimeType(() => true)).toMatch(/^video\/mp4;codecs=avc1/);
  });

  it('prefers WebM over a bare MP4 container', () => {
    expect(pickVideoMimeType((m) => m === 'video/mp4' || m.startsWith('video/webm'))).toMatch(/^video\/webm/);
  });

  it('falls back to bare MP4 for Safari', () => {
    expect(pickVideoMimeType((m) => m === 'video/mp4')).toBe('video/mp4');
  });
});
