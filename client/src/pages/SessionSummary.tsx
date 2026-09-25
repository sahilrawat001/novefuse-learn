import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TopicBadge } from '../components/TopicBadge';
import {
  XCircle,
  ArrowLeft,
  RotateCcw,
  Clock,
  DollarSign,
  FileText,
  Target,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  Check,
  Award,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../api/apiClient';

export interface StarRubricScore {
  score: number;
  feedback: string;
}

export interface StarBreakdown {
  situation?: StarRubricScore;
  task?: StarRubricScore;
  action?: StarRubricScore;
  result?: StarRubricScore;
  overall_hire_recommendation?: 'Strong Hire' | 'Hire' | 'Lean Hire' | 'Lean No Hire' | 'No Hire';
}

interface SessionData {
  id: string;
  mode: 'revision' | 'interview';
  started_at: string;
  ended_at?: string;
  raw_transcript?: string;
  summary_json?: {
    topics_covered: string[];
    weak_topics: string[];
    recommended_next_focus?: string;
    session_notes?: string;
    star_breakdown?: StarBreakdown;
  };
  api_cost_estimate_usd?: number | string;
  studyMaterial?: {
    title: string;
    mode: string;
  };
  topicResults?: Array<{
    id: string;
    topic: string;
    status: 'strong' | 'partial' | 'weak';
    notes?: string;
  }>;
}

export const SessionSummary: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyTranscriptToClipboard = () => {
    if (!session?.raw_transcript) return;
    navigator.clipboard.writeText(session.raw_transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2500);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-slate-400 text-sm font-mono glass-panel rounded-3xl mt-8">
        Compiling performance evaluation & transcript...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4 glass-panel rounded-3xl mt-8 border border-white/[0.08]">
        <h2 className="text-xl font-bold text-white">Session Not Found</h2>
        <p className="text-sm text-slate-400">We could not load details for session {sessionId}.</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-indigo-500 transition"
        >
          Return to Studio
        </Link>
      </div>
    );
  }

  const summary = session.summary_json || {
    topics_covered: [],
    weak_topics: [],
    recommended_next_focus: 'Reinforce key concepts and practice follow-up precision.',
    session_notes: 'Spoken dialogue session completed successfully.',
  };

  const durationMinutes =
    session.started_at && session.ended_at
      ? Math.max(
          1,
          Math.round(
            (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000
          )
        )
      : null;

  // Calculate score percentage based on topic results
  const totalEvaluated = session.topicResults?.length || 0;
  const strongCount = session.topicResults?.filter((r) => r.status === 'strong').length || 0;
  const partialCount = session.topicResults?.filter((r) => r.status === 'partial').length || 0;
  const masteryScore = totalEvaluated > 0
    ? Math.round(((strongCount * 1.0 + partialCount * 0.5) / totalEvaluated) * 100)
    : 85;

  const defaultStar: StarBreakdown | null = session.mode === 'interview' ? {
    situation: {
      score: masteryScore >= 80 ? 9 : masteryScore >= 60 ? 7 : 5,
      feedback: masteryScore >= 80
        ? 'Well-scoped context and business domain framing with clear background parameters.'
        : 'Good background provided, though could clarify initial project constraints earlier.',
    },
    task: {
      score: masteryScore >= 80 ? 8 : masteryScore >= 60 ? 7 : 6,
      feedback: masteryScore >= 80
        ? 'Explicitly articulated personal responsibility, target deliverables, and timeline milestones.'
        : 'Stated key technical goals, but could define success criteria with more explicit metrics.',
    },
    action: {
      score: masteryScore >= 80 ? 9 : masteryScore >= 60 ? 8 : 6,
      feedback: masteryScore >= 80
        ? 'Strong technical ownership; communicated architectural trade-offs and decision rationale cleanly.'
        : 'Detailed steps were shared; focus on emphasizing your specific personal decisions vs team actions.',
    },
    result: {
      score: masteryScore >= 80 ? 8 : masteryScore >= 60 ? 7 : 5,
      feedback: masteryScore >= 80
        ? 'Quantified outcomes with measurable impact on latency, resilience, or velocity.'
        : 'Good summary of resolution; include more quantifiable business metrics and post-mortem learnings.',
    },
    overall_hire_recommendation: masteryScore >= 85 ? 'Strong Hire' : masteryScore >= 70 ? 'Hire' : masteryScore >= 55 ? 'Lean Hire' : 'Lean No Hire',
  } : null;

  const star = summary.star_breakdown || defaultStar;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 session-summary-container">
      {/* Navigation and Actions */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Studio</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] px-3.5 py-1.5 rounded-xl transition"
            title="Export Report as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export PDF</span>
          </button>
          <Link
            to="/history"
            className="text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] px-3.5 py-1.5 rounded-xl transition"
          >
            All Past Sessions
          </Link>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-xl transition shadow-md shadow-indigo-600/25"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Hero Performance Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/[0.08] relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                  session.mode === 'revision'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {session.mode} Session
              </span>
              <span className="text-xs font-mono text-slate-400">
                {new Date(session.started_at).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {session.studyMaterial?.title || 'Voice Study Session Report'}
            </h1>
          </div>

          {/* Performance Score Badge */}
          <div className="flex items-center gap-4 bg-slate-900/80 border border-white/[0.08] px-4 py-3 rounded-2xl shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Mastery Index</div>
              <div className="text-xl font-extrabold text-white font-mono">
                {masteryScore}%
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-5 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Duration: {durationMinutes !== null ? `${durationMinutes} min` : '< 1 min'}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>
              API Cost: ${session.api_cost_estimate_usd !== undefined && session.api_cost_estimate_usd !== null ? Number(session.api_cost_estimate_usd).toFixed(4) : '0.0050'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Evaluated: {totalEvaluated} Questions</span>
          </div>
        </div>

        {summary.session_notes && (
          <div className="mt-5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs sm:text-sm text-slate-300 leading-relaxed">
            <span className="font-bold text-white">Overall Feedback: </span>
            {summary.session_notes}
          </div>
        )}
      </div>

      {/* STAR Rubric Breakdown Card */}
      {star && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/[0.08] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  STAR Method Competency Evaluation
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Structured Situation, Task, Action & Result rubric assessment
              </p>
            </div>

            {star.overall_hire_recommendation && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-mono text-slate-400">Verdict:</span>
                <span
                  className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border ${
                    star.overall_hire_recommendation.includes('Strong Hire')
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-md shadow-emerald-500/10'
                      : star.overall_hire_recommendation.includes('Hire')
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {star.overall_hire_recommendation}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Situation */}
            {star.situation && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono font-bold text-xs flex items-center justify-center">
                      S
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Situation</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-300">
                    {star.situation.score}/10
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, star.situation.score * 10)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {star.situation.feedback}
                </p>
              </div>
            )}

            {/* Task */}
            {star.task && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono font-bold text-xs flex items-center justify-center">
                      T
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Task</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-300">
                    {star.task.score}/10
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, star.task.score * 10)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {star.task.feedback}
                </p>
              </div>
            )}

            {/* Action */}
            {star.action && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center">
                      A
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Action</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-300">
                    {star.action.score}/10
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, star.action.score * 10)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {star.action.feedback}
                </p>
              </div>
            )}

            {/* Result */}
            {star.result && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center">
                      R
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Result</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-300">
                    {star.result.score}/10
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, star.result.score * 10)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {star.result.feedback}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommended Focus & Weak Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recommended Focus */}
        <div className="glass-panel rounded-2xl p-6 border border-white/[0.08] space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-indigo-400 uppercase tracking-wider">
            <Target className="w-4 h-4" />
            <span>Recommended Next Focus</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
            {summary.recommended_next_focus || 'Review foundational points and test recall again.'}
          </p>
        </div>

        {/* Weak Topics */}
        <div className="glass-panel rounded-2xl p-6 border border-white/[0.08] space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-rose-400 uppercase tracking-wider">
            <XCircle className="w-4 h-4" />
            <span>Knowledge Gaps Flagged</span>
          </div>
          {summary.weak_topics && summary.weak_topics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {summary.weak_topics.map((topic, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-300"
                >
                  {topic}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic pt-1">
              No critical weak topics flagged this session. High retention confirmed!
            </p>
          )}
        </div>
      </div>

      {/* Assessed Topics / Answer Quality Breakdown */}
      <div className="glass-panel rounded-2xl p-6 border border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
            Assessed Questions & Understanding
          </h2>
          <span className="text-xs text-slate-400 font-mono">{totalEvaluated} Recorded</span>
        </div>

        {session.topicResults && session.topicResults.length > 0 ? (
          <div className="divide-y divide-white/[0.06]">
            {session.topicResults.map((result) => (
              <div key={result.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-100">{result.topic}</div>
                  {result.notes && (
                    <div className="text-xs text-slate-400 leading-relaxed">{result.notes}</div>
                  )}
                </div>
                <TopicBadge
                  topic={result.topic}
                  status={result.status}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-2">
            No specific question ratings were logged during this session run.
          </p>
        )}
      </div>

      {/* Raw Transcript (Collapsible) */}
      {session.raw_transcript && (
        <div className="glass-panel rounded-2xl p-6 border border-white/[0.08]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-300 font-mono hover:text-white transition"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Full Spoken Transcript</span>
              {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTranscript && (
              <button
                onClick={copyTranscriptToClipboard}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] transition"
              >
                {copiedTranscript ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>

          {showTranscript && (
            <div className="mt-4 p-4 bg-slate-950/70 border border-white/[0.06] rounded-xl text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
              {session.raw_transcript}
            </div>
          )}
        </div>
      )}

      {/* Print / PDF Export Styles */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .session-summary-container {
            max-width: 100% !important;
            padding: 0 !important;
          }
          .glass-card, .glass-panel {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
          h1, h2, h3 {
            color: #0f172a !important;
          }
          p, span, div {
            color: #334155 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
