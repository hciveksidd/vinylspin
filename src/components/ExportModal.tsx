/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Download,
  X,
  Video,
  Image as ImageIcon,
  Check,
  Crown,
  Sparkles,
  Loader2,
  FileCheck,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { UserSubscription, StudioToolId } from '../types';
import { exportVideo, downloadBlob, downloadCanvasSnapshot } from '../utils/videoExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  subscription: UserSubscription;
  onOpenPricing: () => void;
  toolId: StudioToolId;
  trackTitle: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  canvasRef,
  subscription,
  onOpenPricing,
  toolId,
  trackTitle,
}) => {
  const isPro = subscription.status === 'active' && subscription.planId !== 'free';

  const [exportType, setExportType] = useState<'video' | 'canvas-loop' | 'snapshot'>('video');
  const [durationSeconds, setDurationSeconds] = useState<number>(toolId === 'spotify-canvas' ? 5 : 6);
  const [fps, setFps] = useState<number>(isPro ? 60 : 30);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportComplete, setExportComplete] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (exportType === 'snapshot') {
      const cleanTitle = (trackTitle || 'promo').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const filename = `${cleanTitle}-${isPro ? 'pro' : 'watermarked'}.png`;
      downloadCanvasSnapshot(canvas, filename);
      setExportComplete(true);
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportComplete(false);

    try {
      const cleanTitle = (trackTitle || 'spinningvinyl').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const filename = `${cleanTitle}-${toolId}-${isPro ? 'pro-clean' : 'free-watermarked'}.webm`;

      const videoBlob = await exportVideo({
        canvas,
        durationSeconds,
        fps,
        filename,
        onProgress: (p) => setExportProgress(p),
      });

      downloadBlob(videoBlob, filename);
      setExportComplete(true);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-[#14161d] border border-white/10 rounded-2xl shadow-2xl p-6 md:p-7 z-10 text-white">
        
        {/* Close Button */}
        <button
          onClick={onClose}
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

        {/* Watermark Status Alert Card */}
        <div className={`p-3.5 rounded-xl border mb-6 flex items-start justify-between gap-3 ${
          isPro
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-start gap-2.5">
            {isPro ? (
              <Crown className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold">
                {isPro ? 'Pro Subscription Active: Watermark Removed' : 'Free Mode: Watermark will be added'}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {isPro
                  ? 'Your exported file will be 100% clean, pristine and watermark-free.'
                  : 'Free tier exports include the SpinningVinyl watermark badge.'}
              </div>
            </div>
          </div>

          {!isPro && (
            <button
              onClick={() => {
                onClose();
                onOpenPricing();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-[11px] shrink-0 transition-colors shadow-sm"
            >
              Remove Watermark
            </button>
          )}
        </div>

        {/* Export Type Selection */}
        <div className="space-y-4 mb-6">
          <label className="block text-xs font-semibold text-zinc-300">Format</label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => setExportType('video')}
              className={`p-3 rounded-xl border text-left transition-all ${
                exportType === 'video'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white'
                  : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4 text-amber-400 mb-1" />
              <div className="text-xs font-bold">HD Video</div>
              <div className="text-[10px] text-zinc-400">Synced Audio + Video</div>
            </button>

            <button
              onClick={() => setExportType('canvas-loop')}
              className={`p-3 rounded-xl border text-left transition-all ${
                exportType === 'canvas-loop'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white'
                  : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
            >
              <Share2 className="w-4 h-4 text-green-400 mb-1" />
              <div className="text-xs font-bold">Spotify Loop</div>
              <div className="text-[10px] text-zinc-400">3–8s seamless loop</div>
            </button>

            <button
              onClick={() => setExportType('snapshot')}
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
                {[3, 5, 8, 12].map((dur) => (
                  <button
                    key={dur}
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
                  onClick={() => {
                    if (isPro) {
                      setFps(60);
                    } else {
                      onOpenPricing();
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors flex items-center justify-center gap-1 ${
                    fps === 60
                      ? 'bg-white/15 border-amber-400 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>60 FPS</span>
                  {!isPro && <Crown className="w-3 h-3 text-amber-400" />}
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
                <span>Recording video & audio sync...</span>
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
            className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              isPro
                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-500/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
            }`}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Rendering {durationSeconds}s clip...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  {isPro
                    ? 'Download Clean Video (No Watermark)'
                    : 'Download with Watermark (Free)'}
                </span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
