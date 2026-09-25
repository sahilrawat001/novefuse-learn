import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export interface TopicQualityItem {
  topic: string;
  status: 'strong' | 'partial' | 'weak';
  notes?: string;
}

export const TopicBadge: React.FC<TopicQualityItem> = ({ topic, status, notes }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'strong':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]';
      case 'partial':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]';
      case 'weak':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]';
      default:
        return 'bg-slate-800/60 text-slate-300 border-white/[0.08]';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'strong':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'partial':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'weak':
        return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border backdrop-blur-sm transition-all hover:scale-105 ${getBadgeStyle()}`}
      title={notes || `${topic}: ${status}`}
    >
      {getIcon()}
      <span className="font-semibold text-slate-100">{topic}</span>
      <span className="capitalize text-[11px] opacity-75 font-mono">[{status}]</span>
      {notes && <span className="text-slate-400 italic text-[11px] hidden sm:inline max-w-xs truncate">— {notes}</span>}
    </div>
  );
};
