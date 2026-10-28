/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Disc,
  Radio,
  Share2,
  Zap,
  FileText,
  Clock,
  Activity,
  Music,
  CheckSquare,
  Sparkles,
  ArrowRight,
  Layers,
  Sliders,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { StudioToolId } from '../types';

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTool: StudioToolId;
  onSelectTool: (toolId: StudioToolId) => void;
}

export const ToolsModal: React.FC<ToolsModalProps> = ({
  isOpen,
  onClose,
  activeTool,
  onSelectTool,
}) => {
  if (!isOpen) return null;

  const handleSelect = (id: StudioToolId) => {
    onSelectTool(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-[#13161c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 md:p-8 z-10 text-white animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Main Grid: Video, GIF & Loops, New / Coming Soon */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 border-b border-white/[0.08] pb-8">
          
          {/* Column 1: VIDEO (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Video</h3>
            
            <div className="space-y-2">
              <button
                onClick={() => handleSelect('vinyl-video')}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 group ${
                  activeTool === 'vinyl-video'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    Vinyl video maker
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Spinning vinyl video for Reels, TikTok & Shorts.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelect('cd-video')}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 group ${
                  activeTool === 'cd-video'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    Spinning CD maker
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Rotating CD video for TikTok, Reels & Shorts.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelect('music-visualizer')}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 group ${
                  activeTool === 'music-visualizer'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    Music visualizer
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Audio-reactive video for YouTube, TikTok & Reels.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelect('spotify-canvas')}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 group ${
                  activeTool === 'spotify-canvas'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-green-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    Spotify Canvas maker
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    3–8s loop ready to upload to Spotify for Artists.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Column 2: GIF & LOOPS (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">GIF & Loops</h3>

            <div className="space-y-2">
              <button
                onClick={() => handleSelect('vinyl-gif')}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 group ${
                  activeTool === 'vinyl-gif'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-amber-400 shrink-0">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    Vinyl GIF maker
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Looping vinyl GIFs for social, email & web.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelect('cd-gif')}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 group ${
                  activeTool === 'cd-gif'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-cyan-400 shrink-0">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    CD GIF maker
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Looping CD GIFs for retro promos & embeds.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelect('glitch-maker')}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 group ${
                  activeTool === 'glitch-maker'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-violet-400 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    Glitch maker
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Animate your cover art with glitch & VHS effects.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Column 3: NEW & COMING SOON (3 cols) */}
          <div className="md:col-span-3 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">New</h3>
              </div>

              <button
                onClick={() => handleSelect('press-kit')}
                className={`w-full text-left p-4 rounded-xl border transition-all group ${
                  activeTool === 'press-kit'
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-zinc-800 text-amber-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-black rounded-md uppercase tracking-wider">
                    NEW
                  </span>
                </div>
                <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                  Press kit generator
                </div>
                <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Your EPK + private demo links to labels.
                </div>
              </button>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                Coming soon
              </h3>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
                  <Layers className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Stem splitter</span>
                </li>
                <li className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
                  <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Mix analyser</span>
                </li>
                <li className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
                  <Camera className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Artist profile photo maker</span>
                </li>
                <li className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
                  <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Cover art generator</span>
                </li>
              </ul>
            </div>

          </div>

        </div>

        {/* Bottom Section: Audio Utilities (matching bottom of screenshot) */}
        <div className="pt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
            Audio Utilities & Workflow
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <button
              onClick={() => handleSelect('bpm-to-ms')}
              className={`text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 group ${
                activeTool === 'bpm-to-ms'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <Clock className="w-5 h-5 text-zinc-400 group-hover:text-amber-400 mt-0.5 shrink-0 transition-colors" />
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-amber-300">
                  BPM to ms
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Convert BPM to delay times in milliseconds.
                </div>
              </div>
            </button>

            <button
              onClick={() => handleSelect('bpm-key-finder')}
              className={`text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 group ${
                activeTool === 'bpm-key-finder'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <Activity className="w-5 h-5 text-zinc-400 group-hover:text-amber-400 mt-0.5 shrink-0 transition-colors" />
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-amber-300">
                  BPM & Key Finder
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Find the tempo and key of your track.
                </div>
              </div>
            </button>

            <button
              onClick={() => handleSelect('musical-keys')}
              className={`text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 group ${
                activeTool === 'musical-keys'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <Music className="w-5 h-5 text-zinc-400 group-hover:text-amber-400 mt-0.5 shrink-0 transition-colors" />
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-amber-300">
                  Musical keys
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Scales, chords & Camelot wheel.
                </div>
              </div>
            </button>

            <button
              onClick={() => handleSelect('release-checklist')}
              className={`text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 group ${
                activeTool === 'release-checklist'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <CheckSquare className="w-5 h-5 text-zinc-400 group-hover:text-amber-400 mt-0.5 shrink-0 transition-colors" />
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-amber-300">
                  Release checklist
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Every deadline from one release date.
                </div>
              </div>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
};
