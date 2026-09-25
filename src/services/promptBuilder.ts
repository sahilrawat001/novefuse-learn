export interface TurnDetectionConfig {
  preset?: 'neural' | 'thoughtful' | 'balanced' | 'snappy';
  minSilence?: number;
  maxSilence?: number;
  vadThreshold?: number;
}

export interface SessionCustomConfig {
  // Revision custom options
  focusTopics?: string[];
  difficulty?: 'foundational' | 'exam_prep' | 'rapid_drill';
  customWeakTopics?: string[];

  // Interview custom options
  company?: string;
  roleLevel?: 'junior' | 'mid' | 'senior' | 'lead';
  interviewType?: 'behavioral' | 'technical' | 'system_design' | 'mixed';
  focusCompetencies?: string[];
  candidateNotes?: string;

  // Turn detection tuning
  turnDetection?: TurnDetectionConfig;
}

export function resolveTurnDetection(
  mode: 'revision' | 'interview',
  difficulty?: 'foundational' | 'exam_prep' | 'rapid_drill',
  custom?: TurnDetectionConfig
): { minSilence?: number; maxSilence?: number; vadThreshold: number; isNeural: boolean } {
  // If user provided exact values:
  if (custom?.minSilence && custom?.maxSilence) {
    return {
      minSilence: Math.max(150, Math.min(2000, custom.minSilence)),
      maxSilence: Math.max(400, Math.min(5000, custom.maxSilence)),
      vadThreshold: custom.vadThreshold ?? 0.5,
      isNeural: false,
    };
  }

  // Snappy preset or rapid drill: ultra-fast timer pacing
  if (custom?.preset === 'snappy' || difficulty === 'rapid_drill') {
    return { minSilence: 200, maxSilence: 600, vadThreshold: 0.55, isNeural: false };
  }

  // Balanced timer preset
  if (custom?.preset === 'balanced') {
    return { minSilence: 350, maxSilence: 850, vadThreshold: 0.5, isNeural: false };
  }

  // Thoughtful timer preset
  if (custom?.preset === 'thoughtful') {
    return { minSilence: 500, maxSilence: 1200, vadThreshold: 0.5, isNeural: false };
  }

  // Default (and preset === 'neural'): Use AssemblyAI Universal-3.5 Pro Realtime
  // Neural Turn Detection (~300ms latency, analyzes cadence, grammar, and sentence completion).
  return {
    isNeural: true,
    minSilence: 250,
    maxSilence: 800,
    vadThreshold: 0.5,
  };
}

export interface StudyPromptParams {
  mode: 'revision' | 'interview';
  title: string;
  content: string;
  weakTopics?: string[];
  config?: SessionCustomConfig;
}

export const ASSEMBLYAI_TOOLS = [
  {
    type: "function",
    name: "log_answer_quality",
    description: "Call after the student answers a question, to record whether they understood the topic.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string" },
        status: { type: "string", enum: ["strong", "partial", "weak"] },
        notes: { type: "string" }
      },
      required: ["topic", "status"]
    }
  },
  {
    type: "function",
    name: "end_session_summary",
    description: "Call once at the end of the session with an overall summary.",
    parameters: {
      type: "object",
      properties: {
        topics_covered: { type: "array", items: { type: "string" } },
        weak_topics: { type: "array", items: { type: "string" } },
        recommended_next_focus: { type: "string" },
        session_notes: { type: "string" },
        star_breakdown: {
          type: "object",
          description: "Structured STAR method evaluation for interview sessions",
          properties: {
            situation: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score from 1 to 10" },
                feedback: { type: "string", description: "Feedback on situation context" }
              },
              required: ["score", "feedback"]
            },
            task: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score from 1 to 10" },
                feedback: { type: "string", description: "Feedback on task clarity and goals" }
              },
              required: ["score", "feedback"]
            },
            action: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score from 1 to 10" },
                feedback: { type: "string", description: "Feedback on concrete actions taken" }
              },
              required: ["score", "feedback"]
            },
            result: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score from 1 to 10" },
                feedback: { type: "string", description: "Feedback on quantified results and learnings" }
              },
              required: ["score", "feedback"]
            },
            overall_hire_recommendation: {
              type: "string",
              enum: ["Strong Hire", "Hire", "Lean Hire", "Lean No Hire", "No Hire"],
              description: "Final hiring decision recommendation"
            }
          }
        }
      },
      required: ["topics_covered", "weak_topics"]
    }
  }
];

export function buildSystemPrompt(params: StudyPromptParams): { systemPrompt: string; greeting: string } {
  const custom = params.config || {};

  if (params.mode === 'interview') {
    const companyContext = custom.company ? ` at ${custom.company}` : '';
    const greeting = `Hi, thanks for coming in today for the ${params.title}${companyContext}. Let's start with a quick question.`;

    const levelInstructions: Record<string, string> = {
      junior: 'Target Seniority: Junior / Entry-Level. Emphasize solid fundamentals, clean thinking, curiosity, and learning ability.',
      mid: 'Target Seniority: Mid-Level. Expect independent problem-solving, production-quality execution, and practical trade-off awareness.',
      senior: 'Target Seniority: Senior. Demand deep architectural trade-offs, scalability, system resilience, and measurable past impact.',
      lead: 'Target Seniority: Staff / Lead. Focus on organization-wide technical strategy, complex distributed trade-offs, and engineering leadership.',
    };

    const typeInstructions: Record<string, string> = {
      behavioral: 'Interview Style: Strict STAR method (Situation, Task, Action, Result). Drill down when answers lack concrete personal actions or measurable outcomes.',
      technical: 'Interview Style: Technical Deep Dive. Probe internal mechanisms, runtime characteristics, edge cases, and architectural trade-offs.',
      system_design: 'Interview Style: System Design & Scalability. Focus on reliability, bottlenecks, data modeling, API boundaries, and trade-offs.',
      mixed: 'Interview Style: Mixed Evaluation. Balance behavioral competency questions (STAR method) with targeted technical depth questions.',
    };

    const levelSection = custom.roleLevel && levelInstructions[custom.roleLevel]
      ? `\n${levelInstructions[custom.roleLevel]}`
      : '';

    const typeSection = custom.interviewType && typeInstructions[custom.interviewType]
      ? `\n${typeInstructions[custom.interviewType]}`
      : '';

    const competenciesSection = custom.focusCompetencies && custom.focusCompetencies.length > 0
      ? `\nKey Competencies to Assess: ${custom.focusCompetencies.join(', ')}`
      : '';

    const candidateSection = custom.candidateNotes
      ? `\nCandidate Background / Notes: ${custom.candidateNotes}`
      : '';

    const systemPrompt = `You are role-playing as an interviewer for the following role${companyContext}:

---
${params.content}
---${levelSection}${typeSection}${competenciesSection}${candidateSection}

Ask realistic interview questions one at a time.
Turn-taking & Instant Responsiveness:
- When the candidate finishes speaking, respond immediately.
- Treat their answer as complete once they stop speaking. Do not ask them to "elaborate further" or leave dead space.
- Give crisp spoken feedback in 1 sentence (assessing their answer against the STAR method or technical depth), immediately call log_answer_quality, and ask the next question right away.
- Call log_answer_quality after each answer (topic = the skill/competency being assessed, e.g. "conflict resolution", "system design", or specific technical topic).

Adaptive Pacing & Candidate Calibration:
- Actively calibrate your questioning based on the candidate's answers:
  * If the candidate's last 2-3 answers were "strong" (demonstrated crisp STAR structure or deep technical mastery), go noticeably harder: introduce scale bottlenecks, production outage trade-offs, or press on edge cases.
  * If the candidate struggles or scores "weak" or "partial", ease up: provide a clarifying follow-up prompt, ask a more bounded question, or guide them to frame their answer with STAR before moving forward.

Keep your own turns short (1-2 sentences). After 4-6 questions, or when the student wants to stop, call end_session_summary with overall impressions and star_breakdown (scoring situation, task, action, result from 1-10 + feedback, and overall_hire_recommendation).`;

    return { systemPrompt, greeting };
  }

  // Default: revision mode
  const mergedWeak = Array.from(new Set([
    ...(params.weakTopics || []),
    ...(custom.customWeakTopics || []),
  ])).filter(Boolean);

  const weakTopicsStr = mergedWeak.length > 0 ? mergedWeak.join(', ') : 'none yet';

  const rigorInstructions: Record<string, string> = {
    foundational: 'Revision Rigor: Foundational Recall. Help the student master core definitions, key terminology, and high-level principles in an encouraging manner.',
    exam_prep: 'Revision Rigor: Comprehensive Exam Prep. Ask challenging, probing questions testing edge cases, interconnected mechanisms, and exact details.',
    rapid_drill: 'Revision Rigor: Rapid-Fire Drill. Ask brisk, direct questions across the material to test instant recall and quick retrieval.',
  };

  const rigorSection = custom.difficulty && rigorInstructions[custom.difficulty]
    ? `\n${rigorInstructions[custom.difficulty]}`
    : '';

  const focusSection = custom.focusTopics && custom.focusTopics.length > 0
    ? `\nStudent Requested Focus Topics for this session: ${custom.focusTopics.join(', ')}. Prioritize questions on these topics first.`
    : '';

  const focusSummary = custom.focusTopics && custom.focusTopics.length > 0
    ? ` focusing on ${custom.focusTopics.slice(0, 2).join(' & ')}`
    : '';

  const greeting = `Ready to go over ${params.title}${focusSummary}? Let's start.`;

  const systemPrompt = `You are a study partner helping a student revise the following material:

---
${params.content}
---${focusSection}${rigorSection}

Known weak topics from past sessions (prioritize these if relevant to the material above, but don't force them if unrelated): ${weakTopicsStr}

Ask one question at a time about the material.
Turn-taking & Instant Responsiveness:
- When the student finishes speaking, respond immediately without delay.
- Treat concise, direct answers as complete thoughts. Do NOT ask them to "tell me more", "elaborate further", or "keep going". Never stall or linger expecting more words.
- Immediately evaluate their answer in 1 crisp sentence, call the log_answer_quality tool (topic, status: strong/partial/weak, and a 1-sentence note), and ask the next question right away.
- If the student's answer was partial or missed a key detail, briefly supply the missing point in one sentence and ask the next question. Keep the momentum snappy and engaging.

Adaptive Difficulty & Real-Time Pacing:
- Continuously monitor the student's mastery from your logged evaluations:
  * If the student's last 2-3 answers were "strong", noticeably escalate the difficulty: ask harder, more nuanced questions testing edge cases, interconnected mechanisms, or comparing different systems.
  * If the student struggles or answers with "weak" or "partial", ease up immediately: do not plow through the agenda at a fixed pace. Break the concept down into simpler foundational steps, provide a helpful analogy, and help them rebuild confidence before attempting another complex question.

Keep your own responses short — one or two sentences, spoken naturally.
When the student wants to stop, or you've covered the material reasonably, call end_session_summary and say a brief closing remark.`;

  return { systemPrompt, greeting };
}
