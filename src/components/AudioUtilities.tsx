/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Activity,
  Music,
  CheckSquare,
  Play,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Volume2,
} from 'lucide-react';
import { StudioToolId } from '../types';

interface AudioUtilitiesProps {
  initialTool?: StudioToolId;
  onSelectStudioTool: (id: StudioToolId) => void;
}

export const AudioUtilities: React.FC<AudioUtilitiesProps> = ({
  initialTool = 'bpm-to-ms',
  onSelectStudioTool,
}) => {
  const [activeTab, setActiveTab] = useState<StudioToolId>(initialTool);

  // BPM to ms state
  const [bpmInput, setBpmInput] = useState<number>(124);

  // Tap tempo state
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tappedBpm, setTappedBpm] = useState<number | null>(null);

  // Musical Keys / Camelot state
  const [selectedCamelotKey, setSelectedCamelotKey] = useState<string>('8A'); // A Minor

  // Release Checklist state
  const [releaseDate, setReleaseDate] = useState<string>(
    new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0]
  );
  const [checkedItems, setCheckedItems] = useState<{ [id: string]: boolean }>({
    'c-1': true,
    'c-2': true,
  });

  const handleTap = () => {
    const now = performance.now();
    const newTimes = [...tapTimes, now].filter((t) => now - t < 3000);
    setTapTimes(newTimes);

    if (newTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTimes.length; i++) {
        intervals.push(newTimes[i] - newTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calcBpm = Math.round(60000 / avgInterval);
      setTappedBpm(calcBpm);
      setBpmInput(calcBpm);
    }
  };

  const resetTap = () => {
    setTapTimes([]);
    setTappedBpm(null);
  };

  // BPM ms calculations
  const calculateDelayMs = (bpm: number, fraction: number, type: 'straight' | 'dotted' | 'triplet') => {
    if (!bpm || bpm <= 0) return 0;
    const quarterMs = 60000 / bpm;
    const straight = quarterMs * fraction;
    if (type === 'dotted') return Math.round(straight * 1.5 * 10) / 10;
    if (type === 'triplet') return Math.round((straight * (2 / 3)) * 10) / 10;
    return Math.round(straight * 10) / 10;
  };

  const delayRows = [
    { label: '1/1 Whole note', fraction: 4 },
    { label: '1/2 Half note', fraction: 2 },
    { label: '1/4 Quarter note', fraction: 1 },
    { label: '1/8 Eighth note', fraction: 0.5 },
    { label: '1/16 Sixteenth note', fraction: 0.25 },
    { label: '1/32 Thirty-second', fraction: 0.125 },
    { label: '1/64 Sixty-fourth', fraction: 0.0625 },
  ];

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 text-white">
      
      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('bpm-to-ms')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'bpm-to-ms' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>BPM to ms</span>
          </button>

          <button
            onClick={() => setActiveTab('bpm-key-finder')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'bpm-key-finder' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Tap & Key Finder</span>
          </button>

          <button
            onClick={() => setActiveTab('musical-keys')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'musical-keys' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Camelot Wheel</span>
          </button>

          <button
            onClick={() => setActiveTab('release-checklist')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'release-checklist' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Release Checklist</span>
          </button>
        </div>

        <button
          onClick={() => onSelectStudioTool('vinyl-video')}
          className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
        >
          ← Return to Studio Visualizer
        </button>
      </div>

      {/* 1. BPM to ms Delay Calculator */}
      {activeTab === 'bpm-to-ms' && (
        <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">BPM to Milliseconds Calculator</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Sync delay times, reverb pre-delay, compressors, and LFOs in your DAW with sample accuracy.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 font-semibold">Tempo:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="30"
                  max="300"
                  value={bpmInput}
                  onChange={(e) => setBpmInput(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 bg-black/40 border border-amber-500/40 rounded-lg text-amber-300 font-mono font-bold text-lg text-center focus:outline-none"
                />
                <span className="text-xs text-zinc-500 font-mono">BPM</span>
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-zinc-500">Quick genre tempos:</span>
            {[84, 100, 120, 124, 128, 140, 174].map((presetBpm) => (
              <button
                key={presetBpm}
                onClick={() => setBpmInput(presetBpm)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                  bpmInput === presetBpm ? 'bg-amber-500 text-black font-bold' : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                {presetBpm}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/[0.08] text-zinc-400">
                  <th className="py-3 px-4 font-semibold">Time Division</th>
                  <th className="py-3 px-4 font-semibold text-right">Straight (ms)</th>
                  <th className="py-3 px-4 font-semibold text-right">Dotted (ms)</th>
                  <th className="py-3 px-4 font-semibold text-right">Triplet (ms)</th>
                  <th className="py-3 px-4 font-semibold text-right">Hz (LFO Frequency)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono">
                {delayRows.map((row, i) => {
                  const straight = calculateDelayMs(bpmInput, row.fraction, 'straight');
                  const dotted = calculateDelayMs(bpmInput, row.fraction, 'dotted');
                  const triplet = calculateDelayMs(bpmInput, row.fraction, 'triplet');
                  const hz = (1000 / straight).toFixed(2);

                  return (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-4 font-sans text-white font-medium">{row.label}</td>
                      <td className="py-2.5 px-4 text-right text-amber-400 font-bold">{straight} ms</td>
                      <td className="py-2.5 px-4 text-right text-zinc-300">{dotted} ms</td>
                      <td className="py-2.5 px-4 text-right text-zinc-300">{triplet} ms</td>
                      <td className="py-2.5 px-4 text-right text-zinc-500">{hz} Hz</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
            <span>Reverb Pre-Delay recommendation: <strong className="font-mono">{calculateDelayMs(bpmInput, 0.0625, 'straight')} ms</strong> (1/64) to <strong className="font-mono">{calculateDelayMs(bpmInput, 0.125, 'straight')} ms</strong> (1/32)</span>
          </div>
        </div>
      )}

      {/* 2. Tap Tempo & BPM Finder */}
      {activeTab === 'bpm-key-finder' && (
        <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white">Tap Tempo & Key Finder</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Tap the beat along with your kick drum or metronome to measure exact tempo and get musical key suggestions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Tap Button */}
            <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-black/40 border border-white/10 space-y-4">
              <button
                onClick={handleTap}
                className="w-40 h-40 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-95 text-black font-extrabold text-lg shadow-xl shadow-amber-500/20 flex flex-col items-center justify-center transition-all cursor-pointer select-none"
              >
                <Activity className="w-8 h-8 mb-1" />
                <span>TAP BEAT</span>
              </button>

              <div className="text-center">
                <div className="text-3xl font-extrabold font-mono text-white">
                  {tappedBpm ? `${tappedBpm} BPM` : '--- BPM'}
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  {tapTimes.length > 0 ? `${tapTimes.length} taps recorded` : 'Click or tap spacebar repeatedly'}
                </div>
              </div>

              {tapTimes.length > 0 && (
                <button
                  onClick={resetTap}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-xs text-zinc-400 hover:text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Key Suggestions */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Harmonic Key Guide for {tappedBpm || bpmInput} BPM
              </h4>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Target Genre Range:</span>
                  <span className="text-amber-400 font-bold">
                    {(tappedBpm || bpmInput) > 130 ? 'Phonk / DnB / Techno' : (tappedBpm || bpmInput) > 115 ? 'House / Dance' : 'Lo-Fi / Hip-Hop'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Quarter Note Duration:</span>
                  <span className="font-mono text-white">{Math.round(60000 / (tappedBpm || bpmInput))} ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Recommended Sidechain Release:</span>
                  <span className="font-mono text-white">{Math.round((60000 / (tappedBpm || bpmInput)) * 0.75)} ms</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-zinc-300 space-y-1">
                <div className="font-bold text-amber-400">Pro Producer Tip:</div>
                <p>
                  Use the Camelot Wheel below to select compatible tracks for DJ sets or remix mashups without key clashing.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. Musical Keys & Camelot Wheel */}
      {activeTab === 'musical-keys' && (
        <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white">Camelot Wheel & Harmonic Keys</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Select your track's root key to view harmonic match keys for smooth DJ mixing and mashup production.
            </p>
          </div>

          {/* Key Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {[
              { code: '8A', key: 'A Minor', major: '8B (C Major)' },
              { code: '9A', key: 'E Minor', major: '9B (G Major)' },
              { code: '10A', key: 'B Minor', major: '10B (D Major)' },
              { code: '11A', key: 'F# Minor', major: '11B (A Major)' },
              { code: '12A', key: 'C# Minor', major: '12B (E Major)' },
              { code: '1A', key: 'G# Minor', major: '1B (B Major)' },
              { code: '2A', key: 'D# Minor', major: '2B (F# Major)' },
              { code: '3A', key: 'Bb Minor', major: '3B (Db Major)' },
              { code: '4A', key: 'F Minor', major: '4B (Ab Major)' },
              { code: '5A', key: 'C Minor', major: '5B (Eb Major)' },
              { code: '6A', key: 'G Minor', major: '6B (Bb Major)' },
              { code: '7A', key: 'D Minor', major: '7B (F Major)' },
            ].map((k) => (
              <button
                key={k.code}
                onClick={() => setSelectedCamelotKey(k.code)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedCamelotKey === k.code
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                }`}
              >
                <div className="text-sm font-bold font-mono text-amber-400">{k.code}</div>
                <div className="text-xs font-semibold text-white mt-0.5">{k.key}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{k.major}</div>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div>
              <span className="text-zinc-400">Selected Key:</span>{' '}
              <strong className="text-white text-sm font-mono">{selectedCamelotKey}</strong>
            </div>
            <div className="flex items-center gap-4 text-zinc-300">
              <span>Compatible mix keys:</span>
              <span className="font-mono text-amber-400 font-bold">
                {parseInt(selectedCamelotKey) - 1 <= 0 ? 12 : parseInt(selectedCamelotKey) - 1}A ·{' '}
                {parseInt(selectedCamelotKey) + 1 > 12 ? 1 : parseInt(selectedCamelotKey) + 1}A ·{' '}
                {selectedCamelotKey.replace('A', 'B')} (Relative Major)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Release Checklist */}
      {activeTab === 'release-checklist' && (
        <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Music Release Timeline Checklist</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Every critical milestone and promo deadline calculated from your target drop date.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Release Date:</span>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs font-mono text-white"
              />
            </div>
          </div>

          {/* Checklist Sections */}
          <div className="space-y-4">
            {[
              {
                phase: '4 Weeks Before Drop',
                items: [
                  { id: 'c-1', text: 'Deliver final 24-bit 44.1kHz WAV master to distributor (DistroKid, TuneCore, etc.)' },
                  { id: 'c-2', text: 'Submit pitch to Spotify editorial curators via Spotify for Artists' },
                  { id: 'c-3', text: 'Order physical vinyl lathe / cassette dubs if doing merchandise run' },
                ],
              },
              {
                phase: '2 Weeks Before Drop',
                items: [
                  { id: 'c-4', text: 'Generate 9:16 vertical video & Spotify Canvas loop using SpinningVinyl' },
                  { id: 'c-5', text: 'Create private EPK demo link for music blogs, tastemakers & DJ radio pools' },
                  { id: 'c-6', text: 'Launch Spotify & Apple Music pre-save campaign with smart link' },
                ],
              },
              {
                phase: 'Release Day & First Week',
                items: [
                  { id: 'c-7', text: 'Post Spinning Vinyl video promo on Instagram Reels, TikTok & YouTube Shorts' },
                  { id: 'c-8', text: 'Upload Spotify Canvas video loop into Spotify for Artists track view' },
                  { id: 'c-9', text: 'Update Linktree/Bio and send newsletter announcement to fan list' },
                ],
              },
            ].map((section, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {section.phase}
                </h4>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={!!checkedItems[item.id]}
                        onChange={() => toggleCheck(item.id)}
                        className="mt-0.5 rounded text-amber-500 focus:ring-amber-400"
                      />
                      <span className={`text-xs ${checkedItems[item.id] ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
};
