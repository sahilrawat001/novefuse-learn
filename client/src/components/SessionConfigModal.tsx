import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Briefcase,
  Mic,
  TrendingDown,
  Target,
  Sliders,
  Building2,
  GraduationCap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface SessionCustomConfig {
  focusTopics?: string[];
  difficulty?: 'foundational' | 'exam_prep' | 'rapid_drill';
  customWeakTopics?: string[];
  company?: string;
  roleLevel?: 'junior' | 'mid' | 'senior' | 'lead';
  interviewType?: 'behavioral' | 'technical' | 'system_design' | 'mixed';
  focusCompetencies?: string[];
  candidateNotes?: string;
  turnDetection?: {
    preset?: 'neural' | 'thoughtful' | 'balanced' | 'snappy';
    minSilence?: number;
    maxSilence?: number;
    vadThreshold?: number;
  };
}

export interface SessionLaunchParams {
  mode: 'revision' | 'interview';
  study_material_id?: string;
  title: string;
  content: string;
  config: SessionCustomConfig;
}

interface SessionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'revision' | 'interview';
  studyMaterial?: { id?: string; title: string; content: string } | null;
  detectedWeakTopics?: string[];
  onStartSession: (params: SessionLaunchParams) => Promise<void>;
  isStarting?: boolean;
}

export const SessionConfigModal: React.FC<SessionConfigModalProps> = ({
  isOpen,
  onClose,
  mode,
  studyMaterial,
  detectedWeakTopics = [],
  onStartSession,
  isStarting = false,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showContentDetails, setShowContentDetails] = useState(false);

  // Revision state
  const [focusTopicsInput, setFocusTopicsInput] = useState('');
  const [difficulty, setDifficulty] = useState<'foundational' | 'exam_prep' | 'rapid_drill'>('exam_prep');
  const [customWeakInput, setCustomWeakInput] = useState('');
  const [selectedWeakTopics, setSelectedWeakTopics] = useState<string[]>([]);

  // Interview state
  const [company, setCompany] = useState('');
  const [roleLevel, setRoleLevel] = useState<'junior' | 'mid' | 'senior' | 'lead'>('senior');
  const [interviewType, setInterviewType] = useState<'behavioral' | 'technical' | 'system_design' | 'mixed'>('mixed');
  const [competenciesInput, setCompetenciesInput] = useState('');
  const [candidateNotes, setCandidateNotes] = useState('');

  // Turn detection pacing state
  const [turnPreset, setTurnPreset] = useState<'neural' | 'thoughtful' | 'balanced' | 'snappy' | 'custom'>('neural');
  const [minSilenceMs, setMinSilenceMs] = useState<number>(200);
  const [maxSilenceMs, setMaxSilenceMs] = useState<number>(600);
  const [showCustomPacing, setShowCustomPacing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (studyMaterial) {
        setTitle(studyMaterial.title);
        setContent(studyMaterial.content);
      } else {
        if (mode === 'revision') {
          setTitle('Photosynthesis & Cellular Respiration');
          setContent(`Photosynthesis:
- Light-dependent reactions (thylakoid): H2O is split, O2 is released, ATP and NADPH are synthesized.
- Calvin Cycle (stroma): CO2 is fixed using ATP and NADPH into G3P.

Cellular Respiration:
- Glycolysis: Glucose converted to 2 pyruvate, yielding 2 ATP and 2 NADH.
- Krebs Cycle: Acetyl-CoA oxidized, generating CO2, NADH, FADH2, and ATP.
- Electron Transport Chain: Chemiosmosis produces 32-34 ATP with O2 as terminal acceptor.`);
        } else {
          setTitle('Senior Frontend Engineer');
          setContent(`Requirements:
- Strong proficiency in modern JavaScript/TypeScript, React, and browser performance optimization.
- Experience with real-time architectures (WebSockets, Web Audio API).
- Strong system design skills: state management, bundle size, latency, accessibility.
- Behavioral competencies: team leadership, technical mentorship, cross-functional conflict resolution.`);
        }
      }

      setSelectedWeakTopics([...detectedWeakTopics]);
      setFocusTopicsInput('');
      setCustomWeakInput('');
      setCompany('');
      setCompetenciesInput('');
      setCandidateNotes('');
      setShowContentDetails(false);
      setTurnPreset('neural');
      setMinSilenceMs(200);
      setMaxSilenceMs(600);
      setShowCustomPacing(false);
    }
  }, [isOpen, studyMaterial, mode, detectedWeakTopics]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const focusTopics = focusTopicsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const customWeakList = customWeakInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const mergedWeak = Array.from(new Set([...selectedWeakTopics, ...customWeakList]));

    const focusCompetencies = competenciesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const turnDetection = turnPreset === 'custom'
      ? { minSilence: minSilenceMs, maxSilence: maxSilenceMs }
      : { preset: turnPreset };

    const config: SessionCustomConfig = mode === 'revision'
      ? {
          focusTopics,
          difficulty,
          customWeakTopics: mergedWeak,
          turnDetection,
        }
      : {
          company: company.trim() || undefined,
          roleLevel,
          interviewType,
          focusCompetencies,
          candidateNotes: candidateNotes.trim() || undefined,
          turnDetection,
        };

    await onStartSession({
      mode,
      study_material_id: studyMaterial?.id,
      title: title.trim() || (mode === 'revision' ? 'Revision Session' : 'Interview Session'),
      content: content.trim(),
      config,
    });
  };

  const toggleWeakTopic = (topic: string) => {
    setSelectedWeakTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-white/[0.1] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-100"
        role="dialog"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                mode === 'revision'
                  ? 'bg-indigo-600 text-white shadow-indigo-500/20 shadow-md'
                  : 'bg-emerald-600 text-white shadow-emerald-500/20 shadow-md'
              }`}
            >
              {mode === 'revision' ? <BookOpen className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {mode === 'revision' ? 'Configure Revision Session' : 'Configure STAR Interview'}
                </h2>
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    mode === 'revision'
                      ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {mode}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Tune agent directives, focus topics, and turn detection before starting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isStarting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Main Title & Content summary */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
                {mode === 'revision' ? 'Subject / Topic Title' : 'Target Role Title'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={mode === 'revision' ? 'e.g. Cellular Respiration' : 'e.g. Senior Frontend Engineer'}
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-white/[0.1] rounded-xl text-sm font-medium text-white focus:bg-slate-950 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Collapsible Source Material Details */}
            <div>
              <button
                type="button"
                onClick={() => setShowContentDetails(!showContentDetails)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                <span>{showContentDetails ? 'Hide source material details' : 'Edit or inspect source material'}</span>
                {showContentDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showContentDetails && (
                <div className="mt-2">
                  <textarea
                    rows={5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={
                      mode === 'revision'
                        ? 'Outline, key concepts, formulas or bullet points...'
                        : 'Job requirements, responsibilities, competencies...'
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>
              )}
            </div>
          </div>

          {/* MODE 1: REVISION CONFIG */}
          {mode === 'revision' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Focus Topics */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Topics to Prioritize Today</span>
                  <span className="text-[11px] font-normal text-slate-400 capitalize">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={focusTopicsInput}
                  onChange={(e) => setFocusTopicsInput(e.target.value)}
                  placeholder="e.g. Calvin cycle, ATP synthase, photolysis"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The AI agent will prioritize asking questions on these specific topics first.
                </p>
              </div>

              {/* Weak Topics */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                  <span>Target Weak Topics to Drill</span>
                </label>

                {selectedWeakTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedWeakTopics.map((topic, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleWeakTopic(topic)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                        title="Click to toggle"
                      >
                        <span>{topic}</span>
                        <X className="w-3 h-3 text-rose-400 hover:text-rose-700" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-2 italic">
                    No weak topics detected from previous sessions.
                  </p>
                )}

                <input
                  type="text"
                  value={customWeakInput}
                  onChange={(e) => setCustomWeakInput(e.target.value)}
                  placeholder="Add additional weak topics (e.g. Electron Transport Chain, Chemiosmosis)"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              {/* Revision Rigor / Depth */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Revision Rigor & Style</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'foundational',
                      label: 'Foundational Recall',
                      desc: 'Core definitions & basics',
                    },
                    {
                      id: 'exam_prep',
                      label: 'Exam Prep',
                      desc: 'Mechanisms & edge cases',
                    },
                    {
                      id: 'rapid_drill',
                      label: 'Rapid-Fire Drill',
                      desc: 'Quick recall & broad reach',
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDifficulty(item.id as any)}
                      className={`p-3 rounded-xl border text-left transition ${
                        difficulty === item.id
                          ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500 text-indigo-950'
                          : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: INTERVIEW CONFIG */}
          {mode === 'interview' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Company & Seniority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Company / Team (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Stripe, Google, Series-A Startup"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Seniority Level</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'junior', label: 'Junior' },
                      { id: 'mid', label: 'Mid' },
                      { id: 'senior', label: 'Senior' },
                      { id: 'lead', label: 'Staff/Lead' },
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setRoleLevel(lvl.id as any)}
                        className={`py-2 px-1 rounded-xl text-xs font-semibold text-center border transition ${
                          roleLevel === lvl.id
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interview Format / Style */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Interview Format & Focus</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'mixed', label: 'Mixed', desc: 'STAR + Tech depth' },
                    { id: 'behavioral', label: 'Behavioral', desc: 'STAR framework' },
                    { id: 'technical', label: 'Tech Deep Dive', desc: 'Code & concepts' },
                    { id: 'system_design', label: 'System Design', desc: 'Architecture & scale' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setInterviewType(style.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        interviewType === style.id
                          ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-500 text-emerald-950'
                          : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{style.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Core Competencies to Grill */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Key Competencies to Assess</span>
                  <span className="text-[11px] font-normal text-slate-400 capitalize">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={competenciesInput}
                  onChange={(e) => setCompetenciesInput(e.target.value)}
                  placeholder="e.g. React rendering performance, WebSocket scale, conflict resolution"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>

              {/* Candidate Context Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Candidate Background / Resume Highlight (Optional)
                </label>
                <input
                  type="text"
                  value={candidateNotes}
                  onChange={(e) => setCandidateNotes(e.target.value)}
                  placeholder="e.g. 5 yrs React experience, built real-time audio pipeline at previous startup"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            </div>
          )}

          {/* TURN DETECTION & PACING TUNING */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Turn-Detection & Voice Pacing</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Controls how long the AI waits during pauses before taking its turn.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCustomPacing(!showCustomPacing);
                  if (!showCustomPacing) setTurnPreset('custom');
                }}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition"
              >
                {showCustomPacing ? 'Use Presets' : 'Custom Milliseconds'}
              </button>
            </div>

            {!showCustomPacing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  {
                    id: 'neural',
                    label: 'Neural (~300ms)',
                    desc: 'AssemblyAI Universal-3.5 Pro semantic detection',
                    badge: 'Recommended',
                  },
                  {
                    id: 'snappy',
                    label: 'Snappy Direct',
                    desc: 'Ultra-fast drill (200ms / 600ms)',
                    badge: undefined,
                  },
                  {
                    id: 'balanced',
                    label: 'Balanced',
                    desc: 'Natural tempo (350ms / 850ms)',
                    badge: undefined,
                  },
                  {
                    id: 'thoughtful',
                    label: 'Thoughtful',
                    desc: 'Deliberate pause (500ms / 1200ms)',
                    badge: undefined,
                  },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setTurnPreset(preset.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition relative ${
                      turnPreset === preset.id
                        ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500 text-indigo-950'
                        : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {preset.badge && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                        {preset.badge}
                      </span>
                    )}
                    <div className="text-xs font-bold">{preset.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{preset.desc}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center text-xs font-medium text-slate-700 mb-1">
                      <span>Min Silence (slack for thinking):</span>
                      <span className="font-mono font-bold text-indigo-600">{minSilenceMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min={200}
                      max={1500}
                      step={50}
                      value={minSilenceMs}
                      onChange={(e) => {
                        setMinSilenceMs(parseInt(e.target.value, 10));
                        setTurnPreset('custom');
                      }}
                      className="w-full accent-indigo-600"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Higher prevents interrupting mid-thought pauses.</p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-medium text-slate-700 mb-1">
                      <span>Max Silence (turn cutoff):</span>
                      <span className="font-mono font-bold text-indigo-600">{maxSilenceMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min={800}
                      max={4000}
                      step={100}
                      value={maxSilenceMs}
                      onChange={(e) => {
                        setMaxSilenceMs(parseInt(e.target.value, 10));
                        setTurnPreset('custom');
                      }}
                      className="w-full accent-indigo-600"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Lower avoids sluggishness after you clearly finish.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isStarting}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isStarting}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition disabled:opacity-50 ${
                mode === 'revision'
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>{isStarting ? 'Connecting...' : 'Start Voice Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
