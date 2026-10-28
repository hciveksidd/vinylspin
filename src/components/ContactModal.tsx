/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Mail, Send } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ISSUES_URL = 'https://github.com/hciveksidd/vinylspin/issues';

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  // There is no backend, so feedback goes to the project's GitHub issue tracker, prefilled
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ title, body: message });
    window.open(`${ISSUES_URL}/new?${params}`, '_blank', 'noopener');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#14161d] border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 z-10 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Feedback & Support</h3>
            <p className="text-xs text-zinc-400">Opens a prefilled issue on GitHub.</p>
          </div>
        </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Subject</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">How can we help?</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Feature requests, bug reports or questions about Spotify Canvas formats..."
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Open on GitHub</span>
            </button>
          </form>
      </div>
    </div>
  );
};
