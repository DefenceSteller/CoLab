import React from 'react';
import { ArrowRight, Loader2, TriangleAlert, Users, Zap } from 'lucide-react';

/**
 * Landing / start screen.
 * - "Start a session" → creates a room, opens the board + share popup
 * - status 'joining'  → we're jumping into a session from a shared link
 * - error             → link was full / expired (shown as a banner)
 */
const Landing = ({ onStart, onSolo, status, error }) => {
  const joining = status === 'joining';
  const creating = status === 'creating';

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* floating stickers */}
      <div className="absolute top-24 left-[12%] w-16 h-16 bg-grape border-2 border-ink rounded-xl shadow-[4px_4px_0_#101014] rotate-12 animate-[status-bounce_3s_ease-in-out_infinite]" />
      <div className="absolute bottom-32 right-[14%] w-14 h-14 bg-sun border-2 border-ink rounded-full shadow-[4px_4px_0_#101014] -rotate-6" />
      <div className="absolute top-40 right-[22%] w-10 h-10 bg-bubble border-2 border-ink rounded-lg shadow-[3px_3px_0_#101014] rotate-12" />
      <div className="absolute bottom-40 left-[18%] w-9 h-9 bg-lime border-2 border-ink rounded-full shadow-[3px_3px_0_#101014]" />

      {/* top bar */}
      <header className="relative z-10 px-6 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-grape border-2 border-ink shadow-[3px_3px_0_#101014] grid place-items-center -rotate-3">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <span className="text-lg font-bold tracking-tight">
          CoLab
          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-sun border-2 border-ink rounded-full px-2 py-0.5 align-middle -rotate-2 inline-block">
            beta
          </span>
        </span>
      </header>

      {/* hero */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-16">
        <div className="max-w-2xl w-full text-center">
          {joining ? (
            /* ---- joining a session from a link ---- */
            <div className="bg-white border-2 border-ink rounded-2xl shadow-[6px_6px_0_#101014] p-10 max-w-md mx-auto">
              <Loader2 size={40} className="mx-auto mb-4 animate-spin text-grape" />
              <h2 className="text-2xl font-bold">jumping into the session…</h2>
              <p className="mt-2 text-sm font-medium opacity-70">
                grabbing the board and everyone&apos;s strokes
              </p>
            </div>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 bg-lime border-2 border-ink rounded-full px-3 py-1 text-xs font-bold shadow-[3px_3px_0_#101014] -rotate-2 mb-6">
                <Zap size={13} /> real-time collaborative whiteboard
              </span>

              <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[0.95]">
                draw.
                <br />
                <span className="text-grape">together.</span>
                <span className="inline-block ml-3 bg-bubble border-2 border-ink rounded-xl px-3 py-1 text-2xl sm:text-4xl shadow-[4px_4px_0_#101014] rotate-3 align-middle">
                  live ✦
                </span>
              </h1>

              <p className="mt-6 text-base font-medium opacity-75 max-w-md mx-auto">
                start a session, drop the link to your people, and everyone
                draws on the same board — instantly.
              </p>

              {/* error banner (link full / expired) */}
              {error && (
                <div className="mt-6 flex items-start gap-2.5 bg-bubble border-2 border-ink rounded-xl px-4 py-3 text-left shadow-[4px_4px_0_#101014] max-w-md mx-auto">
                  <TriangleAlert size={18} className="shrink-0 mt-0.5" />
                  <span className="text-sm font-bold">{error}</span>
                </div>
              )}

              {/* primary CTA */}
              <button
                onClick={onStart}
                disabled={creating}
                className="mt-12 inline-flex items-center gap-2.5 bg-lime border-2 border-ink rounded-2xl px-8 py-4 text-lg font-bold shadow-[6px_6px_0_#101014] cursor-pointer transition-transform duration-100 hover:-translate-y-0.5 active:translate-x-1.5 active:translate-y-1.5 active:shadow-[0_0_0_#101014] disabled:opacity-70 disabled:cursor-wait"
              >
                {creating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    starting…
                  </>
                ) : (
                  <>
                    <ArrowRight size={20} />
                    start a session
                  </>
                )}
              </button>

              <div className="mt-10 flex items-center justify-center gap-1.5 text-xs font-bold opacity-60">
                <Users size={14} /> up to 5 people per session link
              </div>

              {/* solo / guest CTA */}
              <button
                onClick={onSolo}
                disabled={creating || joining}
                className="mt-8 inline-flex items-center gap-2 bg-white border-2 border-ink rounded-2xl px-6 py-3 text-sm font-bold shadow-[4px_4px_0_#101014] cursor-pointer transition-transform duration-100 hover:-translate-y-0.5 active:translate-x-1.5 active:translate-y-1.5 active:shadow-[0_0_0_#101014] disabled:opacity-70 disabled:cursor-wait"
                title="Open a private board with no shareable link"
              >
                <Zap size={14} />
                {creating || joining ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    getting ready…
                  </>
                ) : (
                  <>draw solo — no link needed</>
                )}
              </button>

              <p className="mt-3 text-xs font-medium opacity-50">
                jump straight into a blank canvas; exit anytime to return here.
              </p>

              <p className="mt-2 text-xs font-medium opacity-50">
                got a link already? just click it — you&apos;ll land right on the
                board.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Landing;
