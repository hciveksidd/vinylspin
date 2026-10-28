/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronDown, Disc } from 'lucide-react';

interface NavbarProps {
  onOpenTools: () => void;
  isToolsOpen: boolean;
  onOpenContact: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenTools,
  isToolsOpen,
  onOpenContact,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0b0d11]/90 backdrop-blur-md border-b border-white/[0.08] px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 md:gap-8">
        
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <a href="#" className="flex items-center gap-2.5 text-white font-bold text-lg tracking-tight group">
            <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:rotate-45 transition-transform duration-300">
              <Disc className="w-5 h-5 text-black animate-spin [animation-duration:8s]" />
            </span>
            <span className="font-extrabold text-xl tracking-tight text-white">
              Spinning<span className="text-amber-400">Vinyl</span>
            </span>
          </a>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={onOpenTools}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              isToolsOpen
                ? 'bg-white/10 text-white'
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Tools</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={onOpenContact}
            className="text-zinc-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Contact
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenTools}
            className="px-4 py-2 text-xs md:text-sm font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0"
          >
            Browse tools
          </button>
        </div>

      </div>
    </header>
  );
};
