/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { ToolsModal } from './components/ToolsModal';
import { VinylStudio } from './components/VinylStudio';
import { ExportModal } from './components/ExportModal';
import { EpkGenerator } from './components/EpkGenerator';
import { AudioUtilities } from './components/AudioUtilities';
import { ContactModal } from './components/ContactModal';
import {
  StudioToolId,
  TrackMetadata,
  VisualizerSettings,
} from './types';
import { PRESET_TRACKS } from './utils/audioEngine';

export default function App() {
  // Current active tool (matching screenshot)
  const [activeTool, setActiveTool] = useState<StudioToolId>('vinyl-video');

  // Modals visibility
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  // Optional SpinningVinyl credit badge on the canvas (off by default)
  const [showWatermark, setShowWatermark] = useState(false);

  // Track metadata
  const [metadata, setMetadata] = useState<TrackMetadata>({
    title: PRESET_TRACKS[0].title,
    artist: PRESET_TRACKS[0].artist,
    album: PRESET_TRACKS[0].album,
    bpm: PRESET_TRACKS[0].bpm,
    key: PRESET_TRACKS[0].key,
    genre: PRESET_TRACKS[0].genre,
    duration: 180,
    releaseDate: '2026-11-15',
    labelName: 'HYPERDRIVE RECORDS',
    catalogNumber: 'HDR-042',
  });

  // Visualizer / Vinyl turntable settings
  const [settings, setSettings] = useState<VisualizerSettings>({
    aspectRatio: '1:1',
    rotationSpeed: 33,
    vinylColor: 'black',
    showSleeve: true,
    sleevePosition: 0.65,
    tonearmVisible: false,
    dustAndScratches: true,
    wobbleIntensity: 0.15,
    holographicIntensity: 0.8,
    glitchIntensity: 0.4,
    visualizerType: 'bars',
    backgroundStyle: 'studio-dark',
    customBackgroundColor: '#0f1117',
    particleColor: '#f59e0b',
    audioReactivePulse: true,
  });

  // Uploaded or loaded cover art
  const [coverImage, setCoverImage] = useState<HTMLImageElement | null>(null);

  // Canvas ref for WebGL/2D rendering & video recording
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isUtilityTool =
    activeTool === 'bpm-to-ms' ||
    activeTool === 'bpm-key-finder' ||
    activeTool === 'musical-keys' ||
    activeTool === 'release-checklist';

  return (
    <div className="min-h-screen bg-[#0b0d11] text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      
      {/* 3-Zone Navigation Header */}
      <Navbar
        onOpenTools={() => setIsToolsOpen(!isToolsOpen)}
        isToolsOpen={isToolsOpen}
        onOpenContact={() => setIsContactOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        
        {/* Tool Mode Breadcrumb / Header Sub-bar */}
        <div className="border-b border-white/[0.06] bg-black/30 px-4 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-300">Tool Mode:</span>
              <button
                onClick={() => setIsToolsOpen(true)}
                className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-amber-400 font-bold flex items-center gap-1.5 transition-colors"
              >
                <span>
                  {activeTool === 'vinyl-video'
                    ? 'Vinyl video maker'
                    : activeTool === 'cd-video'
                    ? 'Spinning CD maker'
                    : activeTool === 'music-visualizer'
                    ? 'Music visualizer'
                    : activeTool === 'spotify-canvas'
                    ? 'Spotify Canvas maker'
                    : activeTool === 'vinyl-gif'
                    ? 'Vinyl GIF maker'
                    : activeTool === 'cd-gif'
                    ? 'CD GIF maker'
                    : activeTool === 'glitch-maker'
                    ? 'Glitch cover maker'
                    : activeTool === 'press-kit'
                    ? 'Press Kit (EPK) generator'
                    : 'Audio Utilities'}
                </span>
                <span className="text-[10px] text-zinc-500">▼ Switch</span>
              </button>
            </div>

          </div>
        </div>

        {/* Viewport Router */}
        {activeTool === 'press-kit' ? (
          <EpkGenerator />
        ) : isUtilityTool ? (
          <AudioUtilities
            initialTool={activeTool}
            onSelectStudioTool={(id) => setActiveTool(id)}
          />
        ) : (
          <VinylStudio
            toolId={activeTool}
            onOpenExport={() => setIsExportOpen(true)}
            canvasRef={canvasRef}
            showWatermark={showWatermark}
            metadata={metadata}
            setMetadata={setMetadata}
            settings={settings}
            setSettings={setSettings}
            coverImage={coverImage}
            setCoverImage={setCoverImage}
          />
        )}

      </main>

      {/* Global Modals */}
      <ToolsModal
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        activeTool={activeTool}
        onSelectTool={(tool) => setActiveTool(tool)}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        canvasRef={canvasRef}
        showWatermark={showWatermark}
        onToggleWatermark={setShowWatermark}
        toolId={activeTool}
        trackTitle={metadata.title}
      />

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />

      {/* Clean quiet footer */}
      <footer className="border-t border-white/[0.08] bg-[#090b0e] px-4 lg:px-8 py-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">SpinningVinyl</span>
            <span>·</span>
            <span>Music Promo & Visualizer Studio</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => setIsContactOpen(true)} className="hover:text-zinc-300 transition-colors">
              Label Support
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
