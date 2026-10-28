/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, DollarSign, Users, Copy, Check, Gift, ArrowRight } from 'lucide-react';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const affiliateLink = 'https://spinningvinyl.app/ref/artist-studio';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(affiliateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#14161d] border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 z-10 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <Gift className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">Refer & Earn 30% Lifetime</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Share SpinningVinyl with fellow music producers, beatmakers, and record labels. Earn 30% recurring monthly commission on every Pro subscription.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
            <div className="text-2xl font-extrabold font-mono text-amber-400">30%</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Recurring Commission</div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
            <div className="text-2xl font-extrabold font-mono text-emerald-400">$0 Min</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Instant Monthly Payout</div>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <label className="block text-xs font-semibold text-zinc-300">Your Unique Affiliate Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={affiliateLink}
              className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-zinc-300"
            />
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-zinc-400 flex items-center gap-3">
          <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Average creator earns $140/mo referring 15 producer friends.</span>
        </div>
      </div>
    </div>
  );
};
