import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Check, Copy, Link2, Users, X } from 'lucide-react';

/**
 * Share-link popup — shown right after "Start a session".
 * Displays the room code + full join link with a copy button.
 */
const ShareModal = ({ onClose }) => {
  const roomId = useSelector((state) => state.board.roomId);
  const roomUsers = useSelector((state) => state.board.roomUsers);
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  // Esc closes the popup
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // clipboard API unavailable (http / older browser) → legacy fallback
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px] grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-ink rounded-2xl shadow-[8px_8px_0_#101014] w-full max-w-md p-6 relative animate-[status-bounce_0.4s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share session link"
      >
        {/* close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 grid place-items-center border-2 border-ink rounded-lg bg-white shadow-[2px_2px_0_#101014] cursor-pointer hover:bg-bubble transition-colors"
        >
          <X size={16} />
        </button>

        {/* title sticker */}
        <span className="inline-flex items-center gap-1.5 bg-lime border-2 border-ink rounded-full px-3 py-1 text-[11px] font-bold shadow-[2px_2px_0_#101014] -rotate-2">
          <Link2 size={13} /> invite your crew
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">
          share this link
        </h2>
        <p className="mt-1 text-sm font-medium opacity-70">
          whoever opens it lands on this exact board.
        </p>

        {/* room code */}
        <div className="mt-4 bg-cream border-2 border-ink rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
            session code
          </span>
          <span className="font-mono text-xl font-bold tracking-[0.3em] bg-sun border-2 border-ink rounded-lg px-3 py-1 shadow-[2px_2px_0_#101014]">
            {roomId}
          </span>
        </div>

        {/* link + copy */}
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 border-2 border-ink rounded-xl px-3 py-2.5 text-sm font-medium bg-cream outline-none focus:bg-lime/30"
            aria-label="Session link"
          />
          <button
            onClick={handleCopy}
            className={`shrink-0 inline-flex items-center gap-1.5 border-2 border-ink rounded-xl px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0_#101014] cursor-pointer transition-all duration-100 active:translate-x-0.75 active:translate-y-0.75 active:shadow-[0_0_0_#101014] ${
              copied ? 'bg-lime' : 'bg-white hover:bg-cream'
            }`}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'copied!' : 'copy'}
          </button>
        </div>

        {/* capacity */}
        <div className="mt-4 flex items-center justify-between bg-grape text-white border-2 border-ink rounded-xl px-4 py-2.5 shadow-[3px_3px_0_#101014]">
          <span className="inline-flex items-center gap-2 text-sm font-bold">
            <Users size={15} /> in the session
          </span>
          <span className="text-sm font-bold bg-white text-ink border-2 border-ink rounded-full px-2.5 py-0.5">
            {roomUsers.length}/5 people
          </span>
        </div>

        <p className="mt-3 text-[11px] font-medium opacity-60 text-center">
          max 5 people per link · the board lives until the server restarts
        </p>
      </div>
    </div>
  );
};

export default ShareModal;
