/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Upload,
  Volume2,
  VolumeX,
  Disc,
  RotateCw,
  Sparkles,
  Sliders,
  Download,
  Crown,
  Eye,
  Layers,
  Image as ImageIcon,
  Music,
  Share2,
  RefreshCw,
  Check,
} from 'lucide-react';
import {
  StudioToolId,
  TrackMetadata,
  VisualizerSettings,
  VinylColor,
  BackgroundStyle,
  AspectRatio,
  UserSubscription,
} from '../types';
import { globalAudioEngine, PRESET_TRACKS } from '../utils/audioEngine';
import { renderFrame } from '../utils/canvasRenderer';

interface VinylStudioProps {
  toolId: StudioToolId;
  onOpenPricing: () => void;
  onOpenExport: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  subscription: UserSubscription;
  onToggleSubscription: () => void;
  metadata: TrackMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<TrackMetadata>>;
  settings: VisualizerSettings;
  setSettings: React.Dispatch<React.SetStateAction<VisualizerSettings>>;
  coverImage: HTMLImageElement | null;
  setCoverImage: (img: HTMLImageElement | null) => void;
}

export const VinylStudio: React.FC<VinylStudioProps> = ({
  toolId,
  onOpenPricing,
  onOpenExport,
  canvasRef,
  subscription,
  onToggleSubscription,
  metadata,
  setMetadata,
  settings,
  setSettings,
  coverImage,
  setCoverImage,
}) => {
  const isPro = subscription.status === 'active' && subscription.planId !== 'free';

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('synthwave');
  const [activeTab, setActiveTab] = useState<'style' | 'audio' | 'visualizer' | 'export-preview'>('style');
  const [customAudioName, setCustomAudioName] = useState<string | null>(null);

  // Animation frame loop refs
  const animationFrameRef = useRef<number | null>(null);
  const rotationAngleRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());

  // Handle Play / Pause
  const togglePlay = () => {
    const playing = globalAudioEngine.togglePlay(() => {
      setIsPlaying(false);
    });
    setIsPlaying(playing);
  };

  // Switch built-in track
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setCustomAudioName(null);
    const p = PRESET_TRACKS.find((item) => item.id === presetId);
    if (p) {
      setMetadata((prev) => ({
        ...prev,
        title: p.title,
        artist: p.artist,
        album: p.album,
        bpm: p.bpm,
        genre: p.genre,
        key: p.key,
      }));
    }
    globalAudioEngine.selectPreset(presetId);
  };

  // Upload custom user audio file (MP3 / WAV)
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCustomAudioName(file.name);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const parts = cleanName.split(' - ');
      if (parts.length >= 2) {
        setMetadata((prev) => ({ ...prev, artist: parts[0].trim(), title: parts[1].trim() }));
      } else {
        setMetadata((prev) => ({ ...prev, title: cleanName }));
      }

      const res = await globalAudioEngine.loadUserFile(file);
      setMetadata((prev) => ({ ...prev, duration: Math.round(res.duration) }));
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed to load user audio', err);
    }
  };

  // Upload custom artwork / vinyl label
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCoverImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Set aspect ratio based on tool
  useEffect(() => {
    if (toolId === 'spotify-canvas') {
      setSettings((prev) => ({ ...prev, aspectRatio: '9:16' }));
    }
  }, [toolId, setSettings]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas resolution according to selected aspect ratio
    const width = 1080;
    let height = 1080;
    if (settings.aspectRatio === '9:16') {
      height = 1920;
    } else if (settings.aspectRatio === '16:9') {
      height = 608;
    } else if (settings.aspectRatio === '4:5') {
      height = 1350;
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      // Update rotation if playing or manual speed > 0
      if (settings.rotationSpeed > 0 && (isPlaying || true)) {
        // 33 RPM = 33.33 * 2pi / 60 radians per sec
        const speedMultiplier = settings.rotationSpeed / 33.33;
        const radPerSec = (33.33 * 2 * Math.PI) / 60;
        rotationAngleRef.current += radPerSec * speedMultiplier * delta * (isPlaying ? 1 : 0.4);
      }

      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const freqData = globalAudioEngine.getFrequencyData();
      const waveData = globalAudioEngine.getWaveformData();
      const bassEnergy = isPlaying ? globalAudioEngine.getBassEnergy() : 0.05;

      renderFrame({
        canvas,
        ctx,
        toolId,
        metadata,
        settings,
        coverImage,
        rotationAngle: rotationAngleRef.current,
        time: elapsed,
        frequencyData: freqData,
        waveformData: waveData,
        bassEnergy,
        isWatermarked: !isPro, // In Pro mode, watermark is REMOVED!
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasRef, toolId, metadata, settings, coverImage, isPlaying, isPro]);

  // Adjust volume
  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setIsMuted(false);
    globalAudioEngine.setVolume(v);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      globalAudioEngine.setVolume(volume);
    } else {
      setIsMuted(true);
      globalAudioEngine.setVolume(0);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
      
      {/* Monetization / Pro Banner Notice */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#171a23] via-[#1a1e29] to-[#171a23] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                {isPro ? 'Pro Subscription: 100% Watermark-Free' : 'Free Mode: Watermark Active'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                isPro ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                {isPro ? 'PRO ACTIVE' : 'FREE TIER'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isPro
                ? 'Your exports will be rendered without watermark in crisp 4K 60fps.'
                : 'Free tier exports include the SpinningVinyl watermark. Upgrade to remove it or test Pro mode instantly.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleSubscription}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 transition-colors"
          >
            {isPro ? 'Switch to Free Mode' : 'Test Pro Mode'}
          </button>
          {!isPro && (
            <button
              onClick={onOpenPricing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Crown className="w-4 h-4 fill-black" />
              <span>Upgrade to Pro ($9)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Studio 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Canvas Preview Viewport (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative rounded-2xl bg-[#090b0e] border border-white/10 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6 min-h-[500px]">
            
            {/* Aspect Ratio Header Overlay */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono text-zinc-300">
                {settings.aspectRatio} · {settings.aspectRatio === '9:16' ? '1080×1920 (Reels/TikTok)' : settings.aspectRatio === '16:9' ? '1920×1080 (YouTube)' : '1080×1080 (Square)'}
              </span>
              {toolId === 'spotify-canvas' && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                  <Share2 className="w-3 h-3" />
                  <span>Spotify Canvas Ready</span>
                </span>
              )}
            </div>

            {/* Simulated Watermark Badge on Top-Right */}
            {!isPro && (
              <div className="absolute top-4 right-4 z-10">
                <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Watermarked Preview</span>
                </div>
              </div>
            )}

            {/* The Real Canvas Render Element */}
            <div className="w-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="max-h-[520px] max-w-full rounded-xl shadow-2xl object-contain border border-white/5 transition-all"
                style={{
                  aspectRatio: settings.aspectRatio === '9:16' ? '9/16' : settings.aspectRatio === '16:9' ? '16/9' : '1/1',
                }}
              />
            </div>

            {/* Floating Audio Playback Bar */}
            <div className="w-full max-w-md mt-6 p-2.5 rounded-2xl bg-[#141720]/90 backdrop-blur-md border border-white/10 shadow-2xl flex items-center justify-between gap-3">
              <button
                onClick={togglePlay}
                className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shadow-md transition-all ${
                  isPlaying
                    ? 'bg-amber-400 text-black shadow-amber-500/30 scale-105'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{metadata.title}</div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {metadata.artist} · {metadata.bpm} BPM
                </div>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2 pr-1">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded text-zinc-400 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-16 accent-amber-400 cursor-pointer"
                />
              </div>
            </div>

          </div>

          {/* Quick Action Buttons Below Preview */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#12151c] border border-white/10">
            <div>
              <div className="text-xs font-bold text-white">Ready to Export?</div>
              <div className="text-[11px] text-zinc-400">
                {isPro ? 'Render clean MP4/WebM video without watermark.' : 'Download free with watermark or upgrade to remove.'}
              </div>
            </div>

            <button
              onClick={onOpenExport}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Visual ({isPro ? 'No Watermark' : 'Free Watermark'})</span>
            </button>
          </div>
        </div>

        {/* Right Column: Customization Controls (5 cols) */}
        <div className="lg:col-span-5 bg-[#12151c] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          
          {/* Segmented Tabs */}
          <div className="flex items-center p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('style')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'style' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Style & Media
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'audio' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Audio & Presets
            </button>
            <button
              onClick={() => setActiveTab('visualizer')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'visualizer' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              FX & Waves
            </button>
          </div>

          {/* TAB 1: STYLE & MEDIA */}
          {activeTab === 'style' && (
            <div className="space-y-5">
              
              {/* Artwork Upload */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  Album Artwork & Vinyl Label
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                    {coverImage ? (
                      <img src={coverImage.src} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Custom Cover Art</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-zinc-500">Supports JPG, PNG, WEBP square format.</p>
                  </div>
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: '1:1', label: '1:1 Square' },
                    { id: '9:16', label: '9:16 Reels' },
                    { id: '16:9', label: '16:9 Wide' },
                    { id: '4:5', label: '4:5 Feed' },
                  ].map((ratio) => (
                    <button
                      key={ratio.id}
                      onClick={() => setSettings((prev) => ({ ...prev, aspectRatio: ratio.id as AspectRatio }))}
                      className={`py-2 px-2 rounded-xl border text-center text-xs font-semibold transition-all ${
                        settings.aspectRatio === ratio.id
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vinyl / Disc Color */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">Vinyl Material & Color</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'black', label: 'Classic Black', color: 'bg-zinc-900 border-zinc-700' },
                    { id: 'amber', label: 'Amber Tint', color: 'bg-amber-600 border-amber-500' },
                    { id: 'marble-red', label: 'Ruby Red', color: 'bg-red-700 border-red-500' },
                    { id: 'neon-cyan', label: 'Neon Cyan', color: 'bg-cyan-600 border-cyan-400' },
                    { id: 'gold', label: 'Gold Splatter', color: 'bg-yellow-600 border-yellow-400' },
                    { id: 'smoke-white', label: 'Smoke White', color: 'bg-slate-200 text-black border-slate-400' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSettings((prev) => ({ ...prev, vinylColor: c.id as VinylColor }))}
                      className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-medium transition-all ${
                        settings.vinylColor === c.id
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${c.color}`} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sleeve Settings */}
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">Show Album Cover Sleeve</span>
                  <input
                    type="checkbox"
                    checked={settings.showSleeve}
                    onChange={(e) => setSettings((prev) => ({ ...prev, showSleeve: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                </div>

                {settings.showSleeve && (
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Vinyl Sleeve Position</span>
                      <span>{Math.round(settings.sleevePosition * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.sleevePosition}
                      onChange={(e) => setSettings((prev) => ({ ...prev, sleevePosition: Number(e.target.value) }))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">Show Tonearm & Needle</span>
                  <input
                    type="checkbox"
                    checked={settings.tonearmVisible}
                    onChange={(e) => setSettings((prev) => ({ ...prev, tonearmVisible: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Background Backdrop */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">Studio Backdrop</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'studio-dark', label: 'Dark Studio' },
                    { id: 'ambient-glow', label: 'Album Blur' },
                    { id: 'wood-shelf', label: 'Warm Wood' },
                    { id: 'neon-gradient', label: 'Midnight Blue' },
                    { id: 'minimal-grey', label: 'Minimal Grey' },
                    { id: 'transparent', label: 'Transparent' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setSettings((prev) => ({ ...prev, backgroundStyle: bg.id as BackgroundStyle }))}
                      className={`p-2 rounded-xl border text-center text-xs font-medium transition-all ${
                        settings.backgroundStyle === bg.id
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: AUDIO & PRESETS */}
          {activeTab === 'audio' && (
            <div className="space-y-5">
              
              {/* Upload user audio file */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  Upload Your Own Track (MP3 / WAV)
                </label>
                <label className="w-full p-4 rounded-xl border border-dashed border-white/20 hover:border-amber-400 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center gap-2 cursor-pointer">
                  <Music className="w-6 h-6 text-amber-400" />
                  <div className="text-xs font-bold text-white">
                    {customAudioName ? `Loaded: ${customAudioName}` : 'Click to select audio file'}
                  </div>
                  <div className="text-[11px] text-zinc-500">Audio plays synced with record spin & visualizer</div>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Or Select Built-in Royalty Free Backing Track */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  Or Test Built-in Royalty-Free Track Presets
                </label>
                <div className="space-y-2">
                  {PRESET_TRACKS.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handleSelectPreset(track.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        selectedPresetId === track.id && !customAudioName
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{track.title}</div>
                        <div className="text-[11px] text-zinc-400">{track.artist} · {track.genre}</div>
                      </div>
                      <div className="text-right font-mono text-[11px] text-amber-400">
                        {track.bpm} BPM
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Track Metadata Input Fields */}
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <h4 className="text-xs font-bold text-zinc-300">Label Typography Info</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Track Title</label>
                    <input
                      type="text"
                      value={metadata.title}
                      onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Artist Name</label>
                    <input
                      type="text"
                      value={metadata.artist}
                      onChange={(e) => setMetadata({ ...metadata, artist: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Record Label</label>
                    <input
                      type="text"
                      value={metadata.labelName}
                      onChange={(e) => setMetadata({ ...metadata, labelName: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Catalog #</label>
                    <input
                      type="text"
                      value={metadata.catalogNumber}
                      onChange={(e) => setMetadata({ ...metadata, catalogNumber: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: FX & WAVES */}
          {activeTab === 'visualizer' && (
            <div className="space-y-5">
              
              {/* Visualizer Type */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">Audio Reactive Overlay</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'none', label: 'None (Clean)' },
                    { id: 'bars', label: 'Frequency Bars' },
                    { id: 'circular', label: 'Circular Spectrum' },
                    { id: 'wave', label: 'Oscilloscope Wave' },
                    { id: 'particles', label: 'Floating Particles' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSettings((prev) => ({ ...prev, visualizerType: v.id as VisualizerSettings['visualizerType'] }))}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                        settings.visualizerType === v.id
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed / RPM */}
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Spin Speed (RPM)</span>
                  <span className="font-mono text-amber-400 font-bold">{settings.rotationSpeed} RPM</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 33, 45, 78].map((rpm) => (
                    <button
                      key={rpm}
                      onClick={() => setSettings((prev) => ({ ...prev, rotationSpeed: rpm }))}
                      className={`py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                        settings.rotationSpeed === rpm
                          ? 'bg-amber-500 text-black font-bold'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {rpm === 0 ? 'Pause' : `${rpm} RPM`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Analog Lo-Fi Wobble */}
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Vinyl Pitch & Disc Wobble</span>
                  <span>{Math.round(settings.wobbleIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.wobbleIntensity}
                  onChange={(e) => setSettings((prev) => ({ ...prev, wobbleIntensity: Number(e.target.value) }))}
                  className="w-full accent-amber-400"
                />
              </div>

              {/* Glitch Intensity (if glitch maker or custom) */}
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Glitch & VHS Tracking FX</span>
                  <span>{Math.round(settings.glitchIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.glitchIntensity}
                  onChange={(e) => setSettings((prev) => ({ ...prev, glitchIntensity: Number(e.target.value) }))}
                  className="w-full accent-amber-400"
                />
              </div>

              {/* Audio Reactive Pulse Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <div>
                  <div className="text-xs font-bold text-white">Audio Reactive Bass Pulsing</div>
                  <div className="text-[11px] text-zinc-500">Backdrop glows dynamically to kick drums</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.audioReactivePulse}
                  onChange={(e) => setSettings((prev) => ({ ...prev, audioReactivePulse: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
