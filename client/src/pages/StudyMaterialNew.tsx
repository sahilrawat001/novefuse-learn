import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Briefcase, ArrowLeft, Check, AlertCircle, Sparkles } from 'lucide-react';
import { apiFetch } from '../api/apiClient';

export const StudyMaterialNew: React.FC = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState<'revision' | 'interview'>('revision');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  // Structured helpers
  const [company, setCompany] = useState('');
  const [roleLevel, setRoleLevel] = useState<'junior' | 'mid' | 'senior' | 'lead'>('senior');
  const [competencies, setCompetencies] = useState('');
  const [focusTopics, setFocusTopics] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      let finalContent = content.trim();
      if (mode === 'interview') {
        const metaLines: string[] = [];
        if (company.trim()) metaLines.push(`Company: ${company.trim()}`);
        if (roleLevel) metaLines.push(`Seniority Level: ${roleLevel}`);
        if (competencies.trim()) metaLines.push(`Key Competencies: ${competencies.trim()}`);
        if (metaLines.length > 0) {
          finalContent = `${metaLines.join('\n')}\n\nJob Description & Requirements:\n${finalContent}`;
        }
      } else {
        if (focusTopics.trim()) {
          finalContent = `Priority Focus Topics: ${focusTopics.trim()}\n\nStudy Notes & Concepts:\n${finalContent}`;
        }
      }

      const res = await apiFetch('/api/study-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, title, content: finalContent }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save study material');
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Studio</span>
      </button>

      <div className="glass-panel border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-indigo-400">Material Knowledge Base</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Add Source Material</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Paste lecture notes or a job description. The AI voice agent uses this text to generate tailored questions.
        </p>

        {error && (
          <div className="mt-4 p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
              Select Session Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('revision')}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition ${
                  mode === 'revision'
                    ? 'border-indigo-500/50 bg-indigo-500/15 text-white ring-1 ring-indigo-500/40'
                    : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] text-slate-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  mode === 'revision' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">Revision & Recall</div>
                  <div className="text-[11px] text-slate-400">Notes, concepts, & quizzes</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('interview')}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition ${
                  mode === 'interview'
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40'
                    : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] text-slate-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  mode === 'interview' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">Mock Interview</div>
                  <div className="text-[11px] text-slate-400">Job requirements & STAR</div>
                </div>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {mode === 'revision' ? 'Topic / Subject Title' : 'Role / Position Title'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'revision' ? 'e.g. Organic Chemistry Ch. 4' : 'e.g. Senior Frontend Engineer'}
              className="w-full px-4 py-2.5 bg-slate-950/60 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Mode-Specific Structured Helpers */}
          {mode === 'revision' ? (
            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Priority Focus Topics <span className="text-[11px] font-normal text-slate-400 lowercase">(optional, comma-separated)</span>
              </label>
              <input
                type="text"
                value={focusTopics}
                onChange={(e) => setFocusTopics(e.target.value)}
                placeholder="e.g. Reaction mechanisms, Stereochemistry, Nucleophiles"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          ) : (
            <div className="space-y-4 p-4 bg-slate-950/40 border border-white/[0.08] rounded-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Company / Organization <span className="text-[11px] font-normal text-slate-400 lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Stripe, Google, ElevenLabs"
                    className="w-full px-4 py-2 bg-slate-900 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Seniority Level
                  </label>
                  <select
                    value={roleLevel}
                    onChange={(e) => setRoleLevel(e.target.value as any)}
                    className="w-full px-4 py-2 bg-slate-900 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="junior">Junior / Entry-Level</option>
                    <option value="mid">Mid-Level</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Staff / Lead</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Key Competencies to Assess <span className="text-[11px] font-normal text-slate-400 lowercase">(optional, comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={competencies}
                  onChange={(e) => setCompetencies(e.target.value)}
                  placeholder="e.g. System Design, WebSockets, Team Leadership, STAR behavioral"
                  className="w-full px-4 py-2 bg-slate-900 border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {mode === 'revision' ? 'Study Notes / Material' : 'Job Description & Requirements'}
            </label>
            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                mode === 'revision'
                  ? 'Paste your lecture notes, bullet points, summaries, or key concepts here...'
                  : 'Paste the job description, key responsibilities, required skills, and competencies...'
              }
              className="w-full px-4 py-3 bg-slate-950/60 border border-white/[0.1] rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition font-mono leading-relaxed"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/25 transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Material'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
