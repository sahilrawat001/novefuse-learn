import React from 'react';
import { Mic, Volume2, Loader2, Radio, Sparkles } from 'lucide-react';

export type VoiceState = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'processing' | 'reconnecting';

interface StateIndicatorProps {
  state: VoiceState;
  audioLevel?: number;
}

export const StateIndicator: React.FC<StateIndicatorProps> = ({ state, audioLevel = 0 }) => {
  const getDynamicHeight = (multiplier: number) => {
    if (!audioLevel || audioLevel <= 0.02) return '6px';
    const h = Math.max(6, Math.min(32, Math.round(audioLevel * 36 * multiplier + 6)));
    return `${h}px`;
  };

  const orbScale = audioLevel && audioLevel > 0.05 ? `scale(${1 + Math.min(0.12, audioLevel * 0.15)})` : 'scale(1)';

  switch (state) {
    case 'reconnecting':
      return (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center w-36 h-36">
            <div className="absolute inset-0 rounded-full bg-amber-500/15 animate-ping" />
            <div className="absolute inset-3 rounded-full border border-amber-500/30 animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Resuming Session Connection...</span>
          </div>
        </div>
      );

    case 'speaking':
      return (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center w-40 h-40">
            {/* Concentric Audio Ripples */}
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ripple" />
            <div className="absolute inset-0 rounded-full border-2 border-teal-500/25 animate-ripple-delayed" />
            <div className="absolute inset-4 rounded-full bg-emerald-500/15 blur-md animate-pulse" />

            {/* Glowing Orb Core with dynamic audio pulse */}
            <div
              className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-white flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.45)] transition-transform duration-75"
              style={{ transform: orbScale }}
            >
              <Volume2 className="w-11 h-11 animate-pulse" />
            </div>
          </div>

          {/* Equalizer Soundwave Bars reacting to live speech amplitudes */}
          <div className="flex items-center gap-1.5 h-8">
            <span className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(0.7) }} />
            <span className="w-1.5 bg-teal-400 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(1.1) }} />
            <span className="w-1.5 bg-emerald-300 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(1.4) }} />
            <span className="w-1.5 bg-teal-300 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(1.2) }} />
            <span className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(1.5) }} />
            <span className="w-1.5 bg-teal-400 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(0.9) }} />
            <span className="w-1.5 bg-emerald-300 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(0.6) }} />
          </div>

          <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>Agent is Speaking</span>
          </div>
        </div>
      );

    case 'listening':
      return (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center w-40 h-40">
            {/* Concentric User Mic Ripples */}
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ripple" />
            <div className="absolute inset-0 rounded-full border-2 border-purple-500/25 animate-ripple-delayed" />
            <div className="absolute inset-4 rounded-full bg-indigo-500/15 blur-md animate-pulse" />

            {/* Glowing Orb Core with dynamic mic pulse */}
            <div
              className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-400 text-white flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.45)] transition-transform duration-75"
              style={{ transform: orbScale }}
            >
              <Mic className="w-11 h-11" />
            </div>
          </div>

          {/* Equalizer Soundwave Bars for Mic */}
          <div className="flex items-center gap-1.5 h-8">
            <span className="w-1.5 bg-indigo-400 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(0.8) }} />
            <span className="w-1.5 bg-purple-400 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(1.2) }} />
            <span className="w-1.5 bg-indigo-300 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(1.5) }} />
            <span className="w-1.5 bg-purple-300 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(1.0) }} />
            <span className="w-1.5 bg-indigo-400 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(1.4) }} />
            <span className="w-1.5 bg-purple-400 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(0.9) }} />
            <span className="w-1.5 bg-indigo-300 rounded-full transition-all duration-75" style={{ height: getDynamicHeight(0.6) }} />
          </div>

          <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>Listening to You... Speak Freely</span>
          </div>
        </div>
      );

    case 'processing':
      return (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center w-36 h-36">
            <div className="absolute inset-2 rounded-full border border-amber-500/20 animate-spin" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 text-white flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.35)]">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Evaluating Answer & Thinking...</span>
          </div>
        </div>
      );

    case 'connecting':
      return (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center w-36 h-36">
            <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center shadow-inner">
              <Loader2 className="w-9 h-9 animate-spin" />
            </div>
          </div>
          <div className="text-slate-400 font-medium text-xs uppercase tracking-wider bg-white/[0.04] border border-white/[0.08] px-3.5 py-1.5 rounded-full">
            Initializing Voice Stream...
          </div>
        </div>
      );

    case 'disconnected':
    default:
      return (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center w-36 h-36">
            <div className="absolute inset-0 rounded-full border border-dashed border-slate-700/60 animate-orb-rotate" />
            <div className="relative w-24 h-24 rounded-full bg-slate-900 border border-slate-700/80 text-slate-500 flex items-center justify-center shadow-inner hover:border-indigo-500/50 transition">
              <Mic className="w-9 h-9 opacity-40" />
            </div>
          </div>
          <div className="text-slate-400 font-medium text-xs uppercase tracking-wider bg-white/[0.03] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
            Ready to Begin
          </div>
        </div>
      );
  }
};
