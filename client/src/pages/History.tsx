import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  ChevronRight,
  BookOpen,
  Briefcase,
  RotateCcw,
  TrendingDown,
} from 'lucide-react';
import { apiFetch } from '../api/apiClient';

interface PastSession {
  id: string;
  mode: 'revision' | 'interview';
  started_at: string;
  ended_at?: string;
  summary_json?: {
    topics_covered?: string[];
    weak_topics?: string[];
    recommended_next_focus?: string;
    session_notes?: string;
  };
  api_cost_estimate_usd?: number | string;
  studyMaterial?: {
    title: string;
    mode: string;
  };
}

export const History: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await apiFetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Session History & Analytics</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review past spoken conversations, mastery evaluations, and flagged knowledge gaps.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-600/25 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Session</span>
        </Link>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm font-mono glass-panel rounded-3xl">
          Loading past voice sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-panel border-dashed border border-white/[0.1] rounded-3xl p-12 text-center">
          <Clock className="w-10 h-10 text-slate-500 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-white">No sessions completed yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Once you hold a conversation with your voice agent, your transcripts, topic ratings, and weak topics will be recorded here.
          </p>
          <Link
            to="/dashboard"
            className="mt-5 inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition"
          >
            Start Your First Session
          </Link>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl border border-white/[0.08] overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {sessions.map((sess) => {
              const durationMinutes =
                sess.started_at && sess.ended_at
                  ? Math.max(
                      1,
                      Math.round(
                        (new Date(sess.ended_at).getTime() - new Date(sess.started_at).getTime()) /
                          60000
                      )
                    )
                  : null;

              const weakCount = sess.summary_json?.weak_topics?.length || 0;

              return (
                <div
                  key={sess.id}
                  onClick={() => navigate(`/session/${sess.id}/summary`)}
                  className="p-5 flex items-center justify-between gap-4 hover:bg-white/[0.03] cursor-pointer transition group"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 border ${
                        sess.mode === 'revision'
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {sess.mode === 'revision' ? (
                        <BookOpen className="w-5 h-5" />
                      ) : (
                        <Briefcase className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            sess.mode === 'revision'
                              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {sess.mode}
                        </span>
                        <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition">
                          {sess.studyMaterial?.title || 'Voice Study Session'}
                        </h3>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap font-mono">
                        <span>{new Date(sess.started_at).toLocaleDateString()}</span>
                        {durationMinutes !== null && <span>• {durationMinutes} min</span>}
                        {sess.api_cost_estimate_usd !== undefined && sess.api_cost_estimate_usd !== null && (
                          <span className="text-emerald-400">• ${Number(sess.api_cost_estimate_usd).toFixed(4)}</span>
                        )}
                        {weakCount > 0 && (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            • <TrendingDown className="w-3 h-3 inline" /> {weakCount} weak topic{weakCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {sess.summary_json?.session_notes && (
                        <p className="text-xs text-slate-400 line-clamp-1 mt-1 leading-relaxed">
                          {sess.summary_json.session_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
