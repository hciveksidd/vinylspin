/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  X,
  Video,
  Image as ImageIcon,
  Loader2,
  FileCheck,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { StudioToolId } from '../types';
import { exportVideo, downloadBlob, downloadCanvasSnapshot } from '../utils/videoExporter';
import { globalAudioEngine } from '../utils/audioEngine';

type ExportType = 'video' | 'canvas-loop' | 'snapshot';

// Spotify Canvas spec: 3–8 seconds, no audio
const DURATIONS: Record<Exclude<ExportType, 'snapshot'>, number[]> = {
  video: [5, 10, 15, 30],
  'canvas-loop': [3, 5, 8],
};

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  showWatermark: boolean;
  onToggleWatermark: (value: boolean) => void;
  toolId: StudioToolId;
  trackTitle: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  canvasRef,
  showWatermark,
  onToggleWatermark,
  toolId,
  trackTitle,
}) => {
  const [exportType, setExportType] = useState<ExportType>('video');
  const [durationSeconds, setDurationSeconds] = useState<number>(10);
  const [fps, setFps] = useState<number>(30);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportComplete, setExportComplete] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Pick a sensible default format whenever the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    selectType(toolId === 'spotify-canvas' ? 'canvas-loop' : 'video');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, toolId]);

  if (!isOpen) return null;

  const trackDuration = Math.floor(globalAudioEngine.getDuration());

  function selectType(type: ExportType) {
    setExportType(type);
    setExportComplete(false);
    setExportError(null);
    if (type !== 'snapshot') setDurationSeconds(type === 'canvas-loop' ? 5 : 10);
  }

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  const handleStartExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cleanTitle = (trackTitle || 'spinningvinyl').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    setExportComplete(false);
    setExportError(null);

    if (exportType === 'snapshot') {
      downloadCanvasSnapshot(canvas, `${cleanTitle}.png`);
      setExportComplete(true);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsExporting(true);
    setExportProgress(0);

    try {
      const { blob, extension } = await exportVideo({
        canvas,
        durationSeconds,
        fps,
        includeAudio: exportType === 'video',
        onProgress: (p) => setExportProgress(p),
        signal: controller.signal,
      });

      const suffix = exportType === 'canvas-loop' ? 'spotify-canvas' : toolId;
      downloadBlob(blob, `${cleanTitle}-${suffix}.${extension}`);
      setExportComplete(true);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('Export failed:', err);
        setExportError(err instanceof Error ? err.message : 'Recording failed in this browser.');
      }
    } finally {
      abortRef.current = null;
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative w-full max-w-xl bg-[#14161d] border border-white/10 rounded-2xl shadow-2xl p-6 md:p-7 z-10 text-white">
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Export Video & Visuals</h3>
            <p className="text-xs text-zinc-400">
              Download your motion visual ready for Instagram Reels, TikTok, YouTube & Spotify.
            </p>
          </div>
        </div>

        {/* Optional branding badge */}
        <label className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] mb-6 flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-white">Add SpinningVinyl badge</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Optional credit stamped onto the exported visual.
            </div>
          </div>
          <input
            type="checkbox"
            checked={showWatermark}
            onChange={(e) => onToggleWatermark(e.target.checked)}
            className="w-4 h-4 accent-amber-400 shrink-0"
          />
        </label>

        {/* Export Type Selection */}
        <div className="space-y-4 mb-6">
          <label className="block text-xs font-semibold text-zinc-300">Format</label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              disabled={isExporting}
              onClick={() => selectType('video')}
              className={`p-3 rounded-xl border text-left transition-all ${
                exportType === 'video'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white'
                  : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4 text-amber-400 mb-1" />
              <div className="text-xs font-bold">HD Video</div>
              <div className="text-[10px] text-zinc-400">Video with synced audio</div>
            </button>

            <button
              disabled={isExporting}
              onClick={() => selectType('canvas-loop')}
              className={`p-3 rounded-xl border text-left transition-all ${
                exportType === 'canvas-loop'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white'
                  : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
            >
              <Share2 className="w-4 h-4 text-green-400 mb-1" />
              <div className="text-xs font-bold">Spotify Loop</div>
              <div className="text-[10px] text-zinc-400">3–8s, silent (Spotify spec)</div>
            </button>

            <button
              disabled={isExporting}
              onClick={() => selectType('snapshot')}
              className={`p-3 rounded-xl border text-left transition-all ${
                exportType === 'snapshot'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white'
                  : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-cyan-400 mb-1" />
              <div className="text-xs font-bold">PNG Frame</div>
              <div className="text-[10px] text-zinc-400">Instant HD Still</div>
            </button>
          </div>
        </div>

        {/* Options (Duration & FPS) */}
        {exportType !== 'snapshot' && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Duration (seconds)
              </label>
              <div className="flex gap-2">
                {DURATIONS[exportType].map((dur) => (
                  <button
                    key={dur}
                    disabled={isExporting}
                    onClick={() => setDurationSeconds(dur)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                      durationSeconds === dur
                        ? 'bg-white/15 border-amber-400 text-white'
                        : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {dur}s
                  </button>
                ))}
                {exportType === 'video' && trackDuration > 0 && (
                  <button
                    disabled={isExporting}
                    onClick={() => setDurationSeconds(trackDuration)}
                    title="Record the whole uploaded track (in real time)"
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                      durationSeconds === trackDuration
                        ? 'bg-white/15 border-amber-400 text-white'
                        : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white'
                    }`}
                  >
                    Full
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Framerate
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFps(30)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                    fps === 30
                      ? 'bg-white/15 border-amber-400 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  30 FPS
                </button>
                <button
                  onClick={() => setFps(60)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors flex items-center justify-center gap-1 ${
                    fps === 60
                      ? 'bg-white/15 border-amber-400 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>60 FPS</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Progress Bar */}
        {isExporting && (
          <div className="mb-6 p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-2 text-amber-400 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {exportType === 'video' ? 'Recording video & audio' : 'Recording loop'} in real time...
                </span>
              </span>
              <span className="font-mono text-white font-bold">{exportProgress}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-150 rounded-full"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {exportError && !isExporting && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Export failed: {exportError}</span>
          </div>
        )}

        {/* Success message */}
        {exportComplete && !isExporting && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Download complete! Check your Downloads folder.</span>
          </div>
        )}

        {/* Export Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleStartExport}
            disabled={isExporting}
            className="flex-1 py-3 px-4 rounded-xl font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-amber-400 hover:bg-amber-300 text-black shadow-amber-500/20"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Rendering {durationSeconds}s clip...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download</span>
              </>
            )}
          </button>
          {isExporting && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="py-3 px-4 rounded-xl font-bold text-xs border border-white/15 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
