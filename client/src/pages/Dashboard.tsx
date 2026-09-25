import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Briefcase,
  Play,
  Plus,
  TrendingDown,
  Clock,
  DollarSign,
  Sparkles,
  Sliders,
  Zap,
  Activity,
  Layers,
  Search,
} from 'lucide-react';
import { SessionConfigModal, SessionLaunchParams } from '../components/SessionConfigModal';
import { apiFetch } from '../api/apiClient';

interface StudyMaterialItem {
  id: string;
  mode: 'revision' | 'interview';
  title: string;
  content: string;
  created_at: string;
}

interface UsageStats {
  totalSessions: number;
  totalDurationMinutes: number;
  totalCostUsd: number;
  unitRatePerMinuteUsd: number;
}

interface StarterTemplate {
  title: string;
  mode: 'revision' | 'interview';
  tag: string;
  description: string;
  sampleContent: string;
  focusTopics?: string;
  company?: string;
  seniority?: 'junior' | 'mid' | 'senior' | 'lead';
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    title: 'Biology: Cellular Respiration',
    mode: 'revision',
    tag: 'Science & Medicine',
    description: 'Glycolysis, Krebs Cycle, and ATP synthase mechanisms.',
    sampleContent: 'Glycolysis breaks glucose into pyruvate producing 2 ATP and 2 NADH. In the mitochondria, the citric acid cycle generates electron carriers. The electron transport chain and oxidative phosphorylation via ATP synthase produce the majority of ATP (approx 30-32 ATP per glucose). Key rate limiting enzymes include PFK-1.',
    focusTopics: 'Glycolysis, Krebs cycle, ATP synthase, Oxidative phosphorylation',
  },
  {
    title: 'Senior Frontend: STAR Behavioral',
    mode: 'interview',
    tag: 'Tech & Leadership',
    description: 'Conflict resolution, architectural trade-offs, and project delivery under pressure.',
    sampleContent: 'Seeking a Senior Frontend Engineer who leads architectural redesigns, drives performance optimization (Lighthouse 95+), mentors junior developers, and collaborates with cross-functional product teams using React, TypeScript, and modern state architectures.',
    company: 'Stripe',
    seniority: 'senior',
  },
  {
    title: 'System Design: WebSocket Relay',
    mode: 'interview',
    tag: 'Software Architecture',
    description: 'Scaling real-time audio streams, low latency, and fault tolerance.',
    sampleContent: 'Design a distributed real-time audio relay system capable of handling 500k concurrent audio streams with sub-200ms latency, handling node failures, reconnection resumption windows, and state synchronization across global edge clusters.',
    company: 'Vercel / ElevenLabs',
    seniority: 'lead',
  },
  {
    title: 'Cognitive Science: Working Memory',
    mode: 'revision',
    tag: 'Psychology',
    description: "Baddeley's model, phonological loop, and cognitive load theory.",
    sampleContent: "Working memory model proposed by Baddeley and Hitch consists of the central executive, phonological loop, visuospatial sketchpad, and episodic buffer. Cognitive load theory differentiates intrinsic, extraneous, and germane load.",
    focusTopics: "Baddeley's model, Phonological loop, Cognitive load theory, Dual-coding",
  },
];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Customization modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'revision' | 'interview'>('revision');
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterialItem | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [matRes, weakRes, statsRes] = await Promise.all([
        apiFetch('/api/study-material'),
        apiFetch('/api/topics/weak'),
        apiFetch('/api/stats/usage'),
      ]);

      if (matRes.ok) {
        const matData = await matRes.json();
        setMaterials(matData.materials || []);
      }
      if (weakRes.ok) {
        const weakData = await weakRes.json();
        setWeakTopics(weakData.weak_topics || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart10SecondDrill = async () => {
    await handleLaunchWithParams({
      mode: 'revision',
      title: '10-Second Drill: Plant Biology & Photosynthesis',
      content: 'Photosynthesis is the process where chlorophyll pigments absorb light energy to synthesize ATP, NADPH, and glucose from H2O and CO2.',
      config: {
        difficulty: 'rapid_drill',
        turnDetection: {
          preset: 'snappy',
          minSilence: 250,
          maxSilence: 800,
        },
        focusTopics: ['Chlorophyll', 'Light-Dependent Reactions'],
      },
    });
  };

  const openCustomLaunch = (mode: 'revision' | 'interview', material?: StudyMaterialItem) => {
    setModalMode(mode);
    setSelectedMaterial(material || null);
    setModalOpen(true);
  };

  const handleLaunchTemplate = (template: StarterTemplate) => {
    const pseudoMaterial: StudyMaterialItem = {
      id: `template-${Date.now()}`,
      title: template.title,
      mode: template.mode,
      content: template.sampleContent,
      created_at: new Date().toISOString(),
    };
    openCustomLaunch(template.mode, pseudoMaterial);
  };

  const handleLaunchWithParams = async (params: SessionLaunchParams) => {
    setStartingSessionId(params.study_material_id || params.mode);
    try {
      const res = await apiFetch('/api/voice-session/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start session');
      }

      const data = await res.json();
      setModalOpen(false);
      navigate(`/session/${data.sessionId}`);
    } catch (err: any) {
      alert(err.message || 'Could not start voice session');
    } finally {
      setStartingSessionId(null);
    }
  };

  const handleStartSession = async (mode: 'revision' | 'interview', materialId?: string) => {
    setStartingSessionId(materialId || mode);
    try {
      const res = await apiFetch('/api/voice-session/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          study_material_id: materialId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start session');
      }

      const data = await res.json();
      navigate(`/session/${data.sessionId}`);
    } catch (err: any) {
      alert(err.message || 'Could not start voice session');
    } finally {
      setStartingSessionId(null);
    }
  };

  const filteredMaterials = materials.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Studio Hero Header */}
      <div className="relative glass-card rounded-3xl p-6 sm:p-10 overflow-hidden border border-white/[0.08]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>NovaFuse Voice Studio</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome back{user?.name ? `, ${user.name}` : ''}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Real-time spoken AI tutor for active recall testing and STAR mock job interviews with millisecond turn detection and adaptive rigor.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleStart10SecondDrill}
              disabled={Boolean(startingSessionId)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-lg shadow-amber-500/25 transition transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
              title="Launch instant 10s voice drill to test spoken audio output"
            >
              <Zap className="w-4 h-4 text-amber-100 fill-amber-100" />
              <span>⚡ 10s Voice Drill</span>
            </button>

            <Link
              to="/study-material/new"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg shadow-indigo-600/25 transition transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
            </Link>

            <button
              onClick={() => openCustomLaunch('revision')}
              className="inline-flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.09] text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-2xl border border-white/[0.1] transition"
            >
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Configure Session</span>
            </button>
          </div>
        </div>

        {/* Real-Time Telemetry HUD */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-8 pt-6 border-t border-white/[0.08]">
            <div className="glass-panel-subtle rounded-2xl p-4 border border-white/[0.06]">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Total Sessions</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono">{stats.totalSessions}</p>
            </div>

            <div className="glass-panel-subtle rounded-2xl p-4 border border-white/[0.06]">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>Spoken Minutes</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono">{stats.totalDurationMinutes} min</p>
            </div>

            <div className="glass-panel-subtle rounded-2xl p-4 border border-white/[0.06]">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Voice API Cost</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">${stats.totalCostUsd}</p>
            </div>

            <div className="glass-panel-subtle rounded-2xl p-4 border border-white/[0.06]">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>Unit Rate</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-200 font-mono">$0.075<span className="text-xs text-slate-500 font-sans">/min</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Weak Topics / Knowledge Gaps Alert Bar */}
      {weakTopics.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-rose-500/30 shadow-[0_0_25px_rgba(244,63,94,0.1)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 mt-0.5 border border-rose-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-rose-200">
                  Target Past Knowledge Gaps
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                  {weakTopics.length} Flagged
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                The agent will automatically prioritize these weak topics for drill-down testing:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {weakTopics.map((topic, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-300"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => openCustomLaunch('revision')}
            disabled={Boolean(startingSessionId)}
            className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-rose-600/20 transition shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Practice Weak Topics</span>
          </button>
        </div>
      )}

      {/* Dual Core Modes Studio Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revision Mode Studio Card */}
        <div className="glass-card rounded-3xl p-7 flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-300 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition" />
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono">
                STUDIO MODE 1
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Revision & Active Recall</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed">
              Interactive voice partner that quizzes you on your study material. It identifies conceptual gaps, probes vague explanations with targeted follow-ups, and logs retention rates.
            </p>

            <div className="flex flex-wrap gap-2 mt-4 pt-2">
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300">
                • ~300ms Neural turn detection
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300">
                • Adaptive difficulty scaling
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300">
                • Concept mastery tags
              </span>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-white/[0.08] flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400 font-mono">
              Ready to speak
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStartSession('revision')}
                disabled={Boolean(startingSessionId)}
                className="inline-flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition border border-white/[0.08]"
                title="Instant launch with default configuration"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Quick Start</span>
              </button>
              <button
                onClick={() => openCustomLaunch('revision')}
                disabled={Boolean(startingSessionId)}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-indigo-600/30 transition"
              >
                <Sliders className="w-3 h-3" />
                <span>Customize & Start</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interview Prep Mode Studio Card */}
        <div className="glass-card rounded-3xl p-7 flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-300 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition" />
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition">
                <Briefcase className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
                STUDIO MODE 2
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">STAR Mock Interviewer</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed">
              Professional mock interviewer tailored to your target company and job seniority. Evaluates your answers according to the STAR methodology (Situation, Task, Action, Result) in real-time.
            </p>

            <div className="flex flex-wrap gap-2 mt-4 pt-2">
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300">
                • ~300ms Neural turn detection
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300">
                • STAR depth evaluation
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300">
                • Seniority & rigor tuning
              </span>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-white/[0.08] flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400 font-mono">
              Ready to speak
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStartSession('interview')}
                disabled={Boolean(startingSessionId)}
                className="inline-flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition border border-white/[0.08]"
                title="Instant launch with default configuration"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Quick Start</span>
              </button>
              <button
                onClick={() => openCustomLaunch('interview')}
                disabled={Boolean(startingSessionId)}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-emerald-600/30 transition"
              >
                <Sliders className="w-3 h-3" />
                <span>Customize & Start</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick-Start Practice Templates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">One-Click Starter Scenarios</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Curated practice tracks</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STARTER_TEMPLATES.map((tpl, i) => (
            <div
              key={i}
              onClick={() => handleLaunchTemplate(tpl)}
              className="glass-panel p-5 rounded-2xl border border-white/[0.08] hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      tpl.mode === 'revision'
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {tpl.mode}
                  </span>
                  <span className="text-[10px] text-slate-400">{tpl.tag}</span>
                </div>

                <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition">
                  {tpl.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-indigo-400 font-semibold">
                <span>Start Drill</span>
                <Play className="w-3 h-3 fill-current group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Saved Study Materials Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-300" />
            <h2 className="text-base sm:text-lg font-bold text-white">Your Study Material Library</h2>
            <span className="text-xs text-slate-400 font-mono">({materials.length} saved)</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes & roles..."
                className="pl-8 pr-3 py-1.5 bg-slate-900/70 border border-white/[0.08] rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition w-44 sm:w-56 font-mono"
              />
            </div>

            <Link
              to="/study-material/new"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0"
            >
              <span>+ Add New</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm font-mono glass-panel rounded-2xl">
            Loading your study materials...
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="glass-panel border-dashed border border-white/[0.1] rounded-3xl p-10 text-center">
            <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3 opacity-60" />
            <p className="text-sm font-semibold text-slate-200">No matching study materials</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Add your lecture notes or target job descriptions to personalize your AI voice tutor.
            </p>
            <Link
              to="/study-material/new"
              className="mt-5 inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Material</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMaterials.map((item) => (
              <div
                key={item.id}
                className="glass-panel p-5 rounded-2xl border border-white/[0.08] hover:border-white/[0.15] transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        item.mode === 'revision'
                          ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {item.mode}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm group-hover:text-indigo-300 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed font-mono text-[11px]">
                    {item.content}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleStartSession(item.mode, item.id)}
                    disabled={Boolean(startingSessionId)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] px-3 py-1.5 rounded-xl transition border border-white/[0.08]"
                    title="Quick launch"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Quick</span>
                  </button>
                  <button
                    onClick={() => openCustomLaunch(item.mode, item)}
                    disabled={Boolean(startingSessionId)}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition border ${
                      item.mode === 'revision'
                        ? 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 hover:bg-indigo-500/25'
                        : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25'
                    }`}
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Customize & Start</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Customization Modal */}
      <SessionConfigModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        studyMaterial={selectedMaterial}
        detectedWeakTopics={weakTopics}
        onStartSession={handleLaunchWithParams}
        isStarting={Boolean(startingSessionId)}
      />
    </div>
  );
};
