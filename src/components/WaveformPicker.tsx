/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { Segment, clampSegment, clampSegmentKeepStart, formatTime, parseTime } from '../utils/waveform';

interface WaveformPickerProps {
  peaks: Float32Array | null;
  total: number; // track length in seconds
  segment: Segment;
  onChange: (segment: Segment) => void;
  /** Current playback position in seconds while previewing, else null */
  playhead: number | null;
  isPreviewing: boolean;
  onTogglePreview: () => void;
}

const DURATION_PRESETS = [5, 10, 15, 30, 60];
const HEIGHT = 96;

const TimeField: React.FC<{
  label: string;
  value: number;
  format: (v: number) => string;
  parse: (text: string) => number | null;
  onCommit: (v: number) => void;
}> = ({ label, value, format, parse, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null) {
      const parsed = parse(draft);
      if (parsed !== null) onCommit(parsed);
    }
    setDraft(null);
  };

  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-zinc-400 mb-1">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? format(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(null);
        }}
        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-amber-400"
      />
    </label>
  );
};

export const WaveformPicker: React.FC<WaveformPickerProps> = ({
  peaks,
  total,
  segment,
  onChange,
  playhead,
  isPreviewing,
  onTogglePreview,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(600);
  const dragRef = useRef<{ grabOffset: number } | null>(null);

  // Track the container width so the canvas stays sharp
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(200, Math.floor(el.clientWidth))));
    ro.observe(el);
    setWidth(Math.max(200, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);

    const x0 = total > 0 ? (segment.start / total) * width : 0;
    const x1 = total > 0 ? ((segment.start + segment.duration) / total) * width : 0;

    // Waveform bars, brighter inside the selected window
    if (peaks) {
      const barW = 2;
      const gap = 1;
      const step = barW + gap;
      const bars = Math.floor(width / step);
      for (let i = 0; i < bars; i++) {
        const peak = peaks[Math.min(peaks.length - 1, Math.floor((i / bars) * peaks.length))];
        const h = Math.max(2, peak * (HEIGHT - 12));
        const x = i * step;
        ctx.fillStyle = x + barW >= x0 && x <= x1 ? '#fbbf24' : '#52525b';
        ctx.fillRect(x, (HEIGHT - h) / 2, barW, h);
      }
    }

    // Window outline + edge handles
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.fillRect(x0, 0, x1 - x0, HEIGHT);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 1, 1, Math.max(2, x1 - x0 - 2), HEIGHT - 2);

    if (playhead !== null && total > 0) {
      const px = (playhead / total) * width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, 0, 2, HEIGHT);
    }
  }, [peaks, total, segment, playhead, width]);

  const secondsAt = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * total;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (total <= 0) return;
    const t = secondsAt(e.clientX);
    const inside = t >= segment.start && t <= segment.start + segment.duration;
    // Click outside the window recentres it on the pointer; inside, it keeps the grab point
    dragRef.current = { grabOffset: inside ? t - segment.start : segment.duration / 2 };
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(clampSegment(t - dragRef.current.grabOffset, segment.duration, total));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    onChange(clampSegment(secondsAt(e.clientX) - dragRef.current.grabOffset, segment.duration, total));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const end = segment.start + segment.duration;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-black/40 border border-white/10 overflow-hidden">
        <canvas
          ref={canvasRef}
          role="slider"
          aria-label="Track segment"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, total - segment.duration)}
          aria-valuenow={segment.start}
          aria-valuetext={`${formatTime(segment.start)} to ${formatTime(end)}`}
          tabIndex={0}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 10 : 1;
            if (e.key === 'ArrowLeft') onChange(clampSegment(segment.start - step, segment.duration, total));
            if (e.key === 'ArrowRight') onChange(clampSegment(segment.start + step, segment.duration, total));
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ width: '100%', height: HEIGHT, touchAction: 'none', cursor: 'grab', display: 'block' }}
        />
      </div>

      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
        <span>0:00</span>
        <span>
          {formatTime(segment.start)} → {formatTime(end)}
        </span>
        <span>{formatTime(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TimeField
          label="Start (m:ss)"
          value={segment.start}
          format={formatTime}
          parse={parseTime}
          onCommit={(v) => onChange(clampSegmentKeepStart(v, segment.duration, total))}
        />
        <TimeField
          label="Length (seconds)"
          value={segment.duration}
          format={(v) => String(Math.round(v * 10) / 10)}
          parse={(t) => (/^\d+(\.\d+)?$/.test(t.trim()) ? Number(t) : null)}
          onCommit={(v) => onChange(clampSegment(segment.start, v, total))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DURATION_PRESETS.filter((d) => d <= total).map((d) => (
          <button
            key={d}
            onClick={() => onChange(clampSegment(segment.start, d, total))}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
              Math.round(segment.duration) === d
                ? 'bg-white/15 border-amber-400 text-white'
                : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white'
            }`}
          >
            {d}s
          </button>
        ))}

        <button
          onClick={onTogglePreview}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors"
        >
          {isPreviewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isPreviewing ? 'Stop' : 'Preview segment'}</span>
        </button>
      </div>
    </div>
  );
};
