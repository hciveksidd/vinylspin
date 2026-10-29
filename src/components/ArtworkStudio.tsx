/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Disc, Download, FileCheck, Image as ImageIcon, Loader2, Music, Upload } from 'lucide-react';
import { AspectRatio } from '../types';
import { globalAudioEngine } from '../utils/audioEngine';
import { ArtworkFit, ArtworkMode, renderArtwork } from '../utils/artworkRenderer';
import { CANVAS_SIZES, getCanvasSize } from '../utils/canvasSize';
import { downloadBlob, downloadCanvasSnapshot, exportVideo } from '../utils/videoExporter';
import { Segment, clampSegment, formatTime } from '../utils/waveform';
import { WaveformPicker } from './WaveformPicker';

const PEAK_BUCKETS = 800;
const SILENT_DURATIONS = [5, 10, 15, 30];
const RPM_OPTIONS = [33, 45, 78];

function baseName(filename: string | null, fallback: string): string {
  const stem = (filename ?? '').replace(/\.[^/.]+$/, '');
  return stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

const Segmented: React.FC<{
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}> = ({ options, value, onChange, disabled }) => (
  <div className="flex items-center p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl">
    {options.map((o) => (
      <button
        key={o.id}
        disabled={disabled}
        onClick={() => onChange(o.id)}
        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
          value === o.id ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const ArtworkStudio: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [mode, setMode] = useState<ArtworkMode>('spin');
  const [fit, setFit] = useState<ArtworkFit>('cover');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [background, setBackground] = useState('#0b0d11');
  const [rpm, setRpm] = useState(33);

  const [trackName, setTrackName] = useState<string | null>(null);
  const [trackDuration, setTrackDuration] = useState(0);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [segment, setSegment] = useState<Segment>({ start: 0, duration: 15 });
  const [trackError, setTrackError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);

  const [silentDuration, setSilentDuration] = useState(10);
  const [fps, setFps] = useState(30);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasTrack = trackDuration > 0;
  const clipSeconds = hasTrack ? segment.duration : silentDuration;

  // Values the animation loop reads every frame, kept out of the effect's dependencies
  const live = useRef({ image, mode, fit, background, rpm, rotating: false });
  live.current = { image, mode, fit, background, rpm, rotating: isPlaying || isExporting };

  // Pick up a track that was already loaded in another tool
  useEffect(() => {
    if (globalAudioEngine.hasUserTrack()) {
      const total = globalAudioEngine.getDuration();
      setTrackName('Loaded track');
      setTrackDuration(total);
      setPeaks(globalAudioEngine.getPeaks(PEAK_BUCKETS));
      setSegment(clampSegment(0, Math.min(15, total), total));
    }
    setIsPlaying(globalAudioEngine.getIsPlaying());
    const unsubscribe = globalAudioEngine.subscribe(setIsPlaying);
    return () => {
      unsubscribe();
      abortRef.current?.abort();
      globalAudioEngine.pause();
    };
  }, []);

  // Playhead while audio runs
  useEffect(() => {
    if (!isPlaying) {
      setPlayhead(null);
      return;
    }
    const id = window.setInterval(() => setPlayhead(globalAudioEngine.getCurrentTime()), 50);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Render loop: flat background + artwork, the disc only turns while audio plays or a clip is recorded
  const size = getCanvasSize(aspectRatio);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = size.width;
    canvas.height = size.height;

    let raf = 0;
    let last = performance.now();
    let angle = 0;
    const loop = (now: number) => {
      const s = live.current;
      const dt = (now - last) / 1000;
      last = now;
      if (s.mode === 'spin' && s.rotating) angle += ((s.rpm * 2 * Math.PI) / 60) * dt;
      renderArtwork({
        ctx,
        width: size.width,
        height: size.height,
        image: s.image,
        mode: s.mode,
        fit: s.fit,
        rotation: angle,
        background: s.background,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size.width, size.height]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageName(file.name);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const handleTrackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setTrackError(null);
    try {
      const { duration } = await globalAudioEngine.loadUserFile(file);
      setTrackName(file.name);
      setTrackDuration(duration);
      setPeaks(globalAudioEngine.getPeaks(PEAK_BUCKETS));
      setSegment(clampSegment(0, Math.min(15, duration), duration));
    } catch (err) {
      console.error('Failed to load audio', err);
      setTrackError('Could not read this audio file. Try an MP3 or WAV.');
    }
  };

  const togglePreview = () => {
    if (globalAudioEngine.getIsPlaying()) globalAudioEngine.pause();
    else globalAudioEngine.playSegment(segment.start, segment.duration);
  };

  const handleExport = async (kind: 'video' | 'png') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setExportDone(false);
    setExportError(null);

    const name = baseName(imageName ?? trackName, 'artwork');
    const at = hasTrack ? `-at${Math.floor(segment.start / 60)}m${String(Math.floor(segment.start % 60)).padStart(2, '0')}` : '';

    if (kind === 'png') {
      downloadCanvasSnapshot(canvas, `${name}-${mode}.png`);
      setExportDone(true);
      return;
    }

    globalAudioEngine.pause();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsExporting(true);
    setExportProgress(0);
    try {
      const { blob, extension } = await exportVideo({
        canvas,
        durationSeconds: clipSeconds,
        fps,
        includeAudio: hasTrack,
        audioStart: segment.start,
        onProgress: setExportProgress,
        signal: controller.signal,
      });
      downloadBlob(blob, `${name}-${mode}${at}.${extension}`);
      setExportDone(true);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('Export failed:', err);
        setExportError(err instanceof Error ? err.message : 'Recording failed in this browser.');
      }
    } finally {
      abortRef.current = null;
      globalAudioEngine.pause();
      setIsExporting(false);
    }
  };

  const aspectOptions = useMemo(() => Object.keys(CANVAS_SIZES).map((id) => ({ id, label: id })), []);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Preview */}
        <div className="lg:col-span-7">
          <div className="relative rounded-2xl bg-[#090b0e] border border-white/10 shadow-2xl overflow-hidden flex flex-col items-center justify-center gap-4 p-4 sm:p-6 min-h-[500px]">
            <div className="relative max-w-full">
              <canvas
                ref={canvasRef}
                className="max-h-[520px] max-w-full rounded-xl shadow-2xl object-contain border border-white/5"
                style={{ aspectRatio: size.css }}
              />
              {!image && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="px-3 py-1.5 rounded-lg bg-black/60 text-xs text-zinc-300">Upload an image to begin</span>
                </div>
              )}
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-black/70 border border-white/10 text-[11px] font-mono text-zinc-300">
              {aspectRatio} · {size.label}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="lg:col-span-5 bg-[#12151c] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          {/* Image */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-2">Image</label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/15 hover:border-amber-400/60 bg-white/[0.02] cursor-pointer transition-colors">
              <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs text-zinc-300 truncate">{imageName ?? 'Upload record artwork (JPG, PNG, WEBP)'}</span>
              <Upload className="w-4 h-4 text-zinc-500 ml-auto shrink-0" />
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          {/* Mode */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-300">Display</label>
            <Segmented
              value={mode}
              onChange={(id) => setMode(id as ArtworkMode)}
              options={[
                { id: 'photo', label: 'Photo' },
                { id: 'spin', label: 'Spinning disc' },
              ]}
            />
            {mode === 'spin' ? (
              <div>
                <span className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Speed</span>
                <Segmented
                  value={String(rpm)}
                  onChange={(id) => setRpm(Number(id))}
                  options={RPM_OPTIONS.map((r) => ({ id: String(r), label: `${r} RPM` }))}
                />
              </div>
            ) : (
              <div>
                <span className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Fit</span>
                <Segmented
                  value={fit}
                  onChange={(id) => setFit(id as ArtworkFit)}
                  options={[
                    { id: 'cover', label: 'Fill frame' },
                    { id: 'contain', label: 'Show whole image' },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Frame */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-300">Frame</label>
            <Segmented value={aspectRatio} onChange={(id) => setAspectRatio(id as AspectRatio)} options={aspectOptions} />
            <label className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
              <span>Background colour</span>
              <input
                type="color"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                className="w-10 h-7 bg-transparent border border-white/10 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Audio */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-300">Track</label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/15 hover:border-amber-400/60 bg-white/[0.02] cursor-pointer transition-colors">
              <Music className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs text-zinc-300 truncate">
                {trackName ? `${trackName} · ${formatTime(trackDuration)}` : 'Upload MP3 or WAV'}
              </span>
              <Upload className="w-4 h-4 text-zinc-500 ml-auto shrink-0" />
              <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/*" onChange={handleTrackUpload} className="hidden" />
            </label>
            {trackError && <p className="text-[11px] text-red-400">{trackError}</p>}

            {hasTrack ? (
              <WaveformPicker
                peaks={peaks}
                total={trackDuration}
                segment={segment}
                onChange={setSegment}
                playhead={playhead}
                isPreviewing={isPlaying}
                onTogglePreview={togglePreview}
              />
            ) : (
              <div>
                <span className="block text-[11px] font-semibold text-zinc-400 mb-1.5">No track — silent clip length</span>
                <div className="flex gap-2">
                  {SILENT_DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSilentDuration(d)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                        silentDuration === d
                          ? 'bg-white/15 border-amber-400 text-white'
                          : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="space-y-3 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300">Export</span>
              <Segmented
                value={String(fps)}
                onChange={(id) => setFps(Number(id))}
                disabled={isExporting}
                options={[
                  { id: '30', label: '30 FPS' },
                  { id: '60', label: '60 FPS' },
                ]}
              />
            </div>

            {isExporting && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-2 text-amber-400 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Recording {formatTime(clipSeconds)} in real time...
                  </span>
                  <span className="font-mono text-white font-bold">{exportProgress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" style={{ width: `${exportProgress}%` }} />
                </div>
              </div>
            )}

            {exportError && !isExporting && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Export failed: {exportError}</span>
              </div>
            )}
            {exportDone && !isExporting && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Download complete!</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleExport('video')}
                disabled={isExporting || !image}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mode === 'spin' ? <Disc className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>Download video ({formatTime(clipSeconds)})</span>
              </button>
              {isExporting ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="py-3 px-4 rounded-xl font-bold text-xs border border-white/15 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => handleExport('png')}
                  disabled={!image}
                  className="py-3 px-4 rounded-xl font-bold text-xs border border-white/15 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  PNG
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
