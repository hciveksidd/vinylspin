/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Play,
  Pause,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Music,
  Share2,
  Mail,
  Instagram,
  Radio,
  Globe,
  Plus,
  Trash2,
} from 'lucide-react';
import { EPKData } from '../types';

const DEFAULT_EPK: EPKData = {
  artistName: 'Kallisto Sound',
  location: 'Berlin / London',
  genres: ['Melodic Techno', 'Indie Dance', 'Synthwave'],
  shortBio: 'Analog-driven synth explorer blending 80s drum machines with modern dark room club energy.',
  fullBio: 'Kallisto Sound has quickly established a signature sonic identity across the European electronic circuit. With support from Pete Tong (BBC Radio 1), Tale of Us, and Stephan Bodzin, their analog synthesizers and emotive chord progressions bridge the gap between late-night dance floors and introspective cinematic headphone listening.',
  contactEmail: 'mgmt@kallistosound.com',
  managementEmail: 'a-and-r@aurora-records.de',
  bookingAgent: 'bookings@orbital-agency.co.uk',
  demoTracks: [
    {
      title: 'Solstice Echoes (Original Mix)',
      duration: '4:32',
      streamUrl: 'https://soundcloud.com/private/s-solstice',
      tags: 'Mastered · 124 BPM · Unreleased',
    },
    {
      title: 'Neon Drift (Club Edit)',
      duration: '5:18',
      streamUrl: 'https://soundcloud.com/private/s-neon-drift',
      tags: 'Dub Mix · 126 BPM · Exclusive',
    },
    {
      title: 'After Midnight (Instrumental)',
      duration: '3:50',
      streamUrl: 'https://soundcloud.com/private/s-after-midnight',
      tags: 'A&R Demo · 120 BPM',
    },
  ],
  pressQuotes: [
    {
      quote: 'One of the most exciting new electronic live acts to emerge this year.',
      publication: 'Mixmag UK',
      author: 'Electronic Trends 2026',
    },
    {
      quote: 'Pure analog warmth meets precision warehouse grooves.',
      publication: 'DJ Mag',
      author: 'Fresh Cuts Review',
    },
  ],
  socialLinks: {
    spotify: 'https://spotify.com/artist/kallisto',
    instagram: 'https://instagram.com/kallisto.sound',
    soundcloud: 'https://soundcloud.com/kallisto',
    youtube: 'https://youtube.com/@kallistosound',
  },
  highlights: [
    'Over 2.4M streams across Spotify & Apple Music',
    'Featured on Spotify Editorial: Night Rider & Electronic Rising',
    'Supported by Tale of Us at Printworks London',
  ],
};

export const EpkGenerator: React.FC = () => {
  const [epk, setEpk] = useState<EPKData>(DEFAULT_EPK);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview');
  const [copiedLink, setCopiedLink] = useState(false);
  const [playingTrackIndex, setPlayingTrackIndex] = useState<number | null>(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://spinningvinyl.app/epk/${epk.artistName.toLowerCase().replace(/\s+/g, '-')}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
              NEW FEATURE
            </span>
            <span>Electronic Press Kit Builder</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            Artist EPK & Private Label Demo Links
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Pitch unreleased tracks to record labels, booking agents, and Spotify curators with a private electronic press kit.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented Tab */}
          <div className="flex items-center p-1 bg-white/[0.05] border border-white/10 rounded-xl">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'preview' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Live EPK View
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'edit' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Edit Details
            </button>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Private Link'}</span>
          </button>
        </div>
      </div>

      {/* Main Content: Edit vs Preview */}
      {activeTab === 'preview' ? (
        <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 md:p-10 shadow-2xl relative overflow-hidden text-white">
          
          {/* Artist Hero */}
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-2">
                <span>{epk.location}</span>
                <span>·</span>
                <span>{epk.genres.join(' / ')}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                {epk.artistName}
              </h1>
              <p className="text-base text-zinc-300 mt-2 max-w-2xl leading-relaxed">
                {epk.shortBio}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={epk.socialLinks.spotify}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
              >
                <Radio className="w-5 h-5 text-green-400" />
              </a>
              <a
                href={epk.socialLinks.instagram}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
              >
                <Instagram className="w-5 h-5 text-pink-400" />
              </a>
              <a
                href={`mailto:${epk.contactEmail}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Contact Management</span>
              </a>
            </div>
          </div>

          {/* 2-Column: Demos & Bio */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8">
            
            {/* Left Col: Private Unreleased Demos for Labels (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Music className="w-4 h-4 text-amber-400" />
                  <span>Private Demos & Masters (A&R Exclusives)</span>
                </h3>
                <span className="text-[11px] text-zinc-500 font-mono">Confidential Stream</span>
              </div>

              <div className="space-y-3">
                {epk.demoTracks.map((track, idx) => {
                  const isPlaying = playingTrackIndex === idx;

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <button
                          onClick={() => setPlayingTrackIndex(isPlaying ? null : idx)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isPlaying
                              ? 'bg-amber-400 text-black scale-105'
                              : 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'
                          }`}
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <div>
                          <div className="text-sm font-bold text-white">{track.title}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">{track.tags}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
                        <span>{track.duration}</span>
                        <a
                          href={track.streamUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-white/10"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Highlights & Stats */}
              <div className="pt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  Key Achievements & Numbers
                </h4>
                <ul className="space-y-2">
                  {epk.highlights.map((h, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Right Col: Biography & Press Quotes (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  Artist Biography
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {epk.fullBio}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  Press Quotes
                </h3>
                <div className="space-y-3">
                  {epk.pressQuotes.map((pq, i) => (
                    <blockquote
                      key={i}
                      className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs"
                    >
                      <p className="italic text-zinc-300 font-medium">"{pq.quote}"</p>
                      <footer className="mt-2 text-[11px] text-amber-400 font-semibold">
                        — {pq.publication} ({pq.author})
                      </footer>
                    </blockquote>
                  ))}
                </div>
              </div>

              {/* Representation Card */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.06] text-xs space-y-2">
                <div className="font-bold text-white">Direct Representation</div>
                <div className="text-zinc-400">
                  <span className="text-zinc-500">A&R / Management:</span> {epk.managementEmail}
                </div>
                <div className="text-zinc-400">
                  <span className="text-zinc-500">Live Booking:</span> {epk.bookingAgent}
                </div>
              </div>

            </div>

          </div>

          {/* Footer credit */}
          <div className="mt-12 pt-6 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-500">
            <div>© {new Date().getFullYear()} {epk.artistName} · All Rights Reserved</div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span>Created with</span>
              <span className="font-bold text-amber-400">SpinningVinyl EPK Studio</span>
            </div>
          </div>

        </div>
      ) : (
        /* Edit Form */
        <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Artist / Project Name</label>
              <input
                type="text"
                value={epk.artistName}
                onChange={(e) => setEpk({ ...epk, artistName: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Location</label>
              <input
                type="text"
                value={epk.location}
                onChange={(e) => setEpk({ ...epk, location: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Short Elevator Bio</label>
            <input
              type="text"
              value={epk.shortBio}
              onChange={(e) => setEpk({ ...epk, shortBio: e.target.value })}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Full Biography</label>
            <textarea
              rows={4}
              value={epk.fullBio}
              onChange={(e) => setEpk({ ...epk, fullBio: e.target.value })}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">General Contact Email</label>
              <input
                type="email"
                value={epk.contactEmail}
                onChange={(e) => setEpk({ ...epk, contactEmail: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Management / A&R Email</label>
              <input
                type="email"
                value={epk.managementEmail}
                onChange={(e) => setEpk({ ...epk, managementEmail: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Booking Agent Email</label>
              <input
                type="email"
                value={epk.bookingAgent}
                onChange={(e) => setEpk({ ...epk, bookingAgent: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/10">
            <button
              onClick={() => setActiveTab('preview')}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition-colors"
            >
              Save & View Live EPK
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
