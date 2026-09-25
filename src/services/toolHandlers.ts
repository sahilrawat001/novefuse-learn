import { getPrisma, isDatabaseReady } from '../db/client.js';
import { FileStorage } from '../db/fileStorage.js';

export interface AnswerQualityPayload {
  topic: string;
  status: 'strong' | 'partial' | 'weak';
  notes?: string;
}

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

export interface SessionSummaryPayload {
  topics_covered: string[];
  weak_topics: string[];
  recommended_next_focus?: string;
  session_notes?: string;
  star_breakdown?: StarBreakdown;
}

// In-memory fallback for Phase 1 or sessions without persistent DB
const inMemoryTopicResults: Map<string, Array<{
  id: string;
  topic: string;
  status: 'strong' | 'partial' | 'weak';
  notes?: string;
  created_at: Date;
}>> = new Map();

const inMemorySessionSummaries: Map<string, SessionSummaryPayload> = new Map();

export async function handleLogAnswerQuality(
  sessionId: string,
  studentId: string,
  payload: AnswerQualityPayload
): Promise<void> {
  console.log(`[Tool Call: log_answer_quality] Session: ${sessionId} | Topic: "${payload.topic}" | Status: ${payload.status} | Note: "${payload.notes || ''}"`);

  // Always keep in-memory representation
  const topicItem = {
    id: crypto.randomUUID(),
    topic: payload.topic,
    status: payload.status,
    notes: payload.notes,
    created_at: new Date(),
  };

  if (!inMemoryTopicResults.has(sessionId)) {
    inMemoryTopicResults.set(sessionId, []);
  }
  inMemoryTopicResults.get(sessionId)!.push(topicItem);

  // File storage durability fallback
  FileStorage.addTopicResult(sessionId, {
    id: topicItem.id,
    topic: topicItem.topic,
    status: topicItem.status,
    notes: topicItem.notes,
    created_at: topicItem.created_at.toISOString(),
  });

  // If Database is connected, persist immediately
  if (isDatabaseReady()) {
    try {
      const prisma = getPrisma();
      await prisma.topicResult.create({
        data: {
          session_id: sessionId,
          student_id: studentId,
          topic: payload.topic,
          status: payload.status,
          notes: payload.notes || null,
        },
      });
      console.log(`[DB] Successfully saved topic_result for session ${sessionId}`);
    } catch (err: any) {
      console.error(`[DB Error] Failed to persist topic_result:`, err.message);
    }
  }
}

export async function handleEndSessionSummary(
  sessionId: string,
  payload: SessionSummaryPayload
): Promise<void> {
  console.log(`[Tool Call: end_session_summary] Session: ${sessionId} | Summary:`, JSON.stringify(payload, null, 2));

  inMemorySessionSummaries.set(sessionId, payload);
  FileStorage.saveSessionSummary(sessionId, payload);

  const existingFileSession = FileStorage.getSession(sessionId);
  if (existingFileSession) {
    FileStorage.saveSession({
      ...existingFileSession,
      summary_json: payload,
    });
  }

  if (isDatabaseReady()) {
    try {
      const prisma = getPrisma();
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          summary_json: payload as any,
        },
      });
      console.log(`[DB] Successfully saved summary_json for session ${sessionId}`);
    } catch (err: any) {
      console.error(`[DB Error] Failed to persist summary_json:`, err.message);
    }
  }
}

export async function handleSessionEnd(
  sessionId: string,
  startedAt: Date,
  rawTranscript: string
): Promise<{
  endedAt: Date;
  durationMinutes: number;
  apiCostEstimateUsd: number;
  summaryJson: SessionSummaryPayload;
}> {
  const endedAt = new Date();
  const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const durationMinutes = durationMs / (1000 * 60);
  const apiCostEstimateUsd = Number((durationMinutes * 0.075).toFixed(4));

  // Determine summary: use existing summary or build fallback from collected topic_results
  let summaryJson = inMemorySessionSummaries.get(sessionId) || FileStorage.getSessionSummary(sessionId);

  if (!summaryJson) {
    const sessionTopics = inMemoryTopicResults.get(sessionId) || FileStorage.getTopicResults(sessionId);
    const topicsCovered = Array.from(new Set(sessionTopics.map(t => t.topic)));
    const weakTopics = Array.from(
      new Set(
        sessionTopics.filter(t => t.status === 'weak').map(t => t.topic)
      )
    );

    summaryJson = {
      topics_covered: topicsCovered.length > 0 ? topicsCovered : ['Session Completed'],
      weak_topics: weakTopics,
      recommended_next_focus: weakTopics.length > 0
        ? `Review ${weakTopics.join(', ')}`
        : 'All topics performed solidly. Consider tackling new material!',
      session_notes: sessionTopics.length > 0
        ? `Covered ${topicsCovered.length} topic(s) with ${sessionTopics.length} total assessment(s).`
        : 'Session finished cleanly.',
    };
    inMemorySessionSummaries.set(sessionId, summaryJson);
    FileStorage.saveSessionSummary(sessionId, summaryJson);
  }

  // Update FileStorage session if present
  const existingFileSession = FileStorage.getSession(sessionId);
  if (existingFileSession) {
    FileStorage.saveSession({
      ...existingFileSession,
      ended_at: endedAt.toISOString(),
      raw_transcript: rawTranscript,
      summary_json: summaryJson,
      api_cost_estimate_usd: apiCostEstimateUsd,
    });
  }

  if (isDatabaseReady()) {
    try {
      const prisma = getPrisma();
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          ended_at: endedAt,
          raw_transcript: rawTranscript,
          summary_json: summaryJson as any,
          api_cost_estimate_usd: apiCostEstimateUsd,
        },
      });
      console.log(`[DB] Session ${sessionId} ended. Duration: ${durationMinutes.toFixed(2)}m. Cost: $${apiCostEstimateUsd}`);
    } catch (err: any) {
      console.error(`[DB Error] Failed to finalize session ${sessionId}:`, err.message);
    }
  }

  return {
    endedAt,
    durationMinutes,
    apiCostEstimateUsd,
    summaryJson,
  };
}

export function getSessionSummaryInMemory(sessionId: string): SessionSummaryPayload | null {
  return inMemorySessionSummaries.get(sessionId) || FileStorage.getSessionSummary(sessionId) || null;
}

export function getSessionTopicsInMemory(sessionId: string) {
  const inMem = inMemoryTopicResults.get(sessionId);
  if (inMem && inMem.length > 0) return inMem;
  const fileTopics = FileStorage.getTopicResults(sessionId);
  return fileTopics.map((t) => ({
    ...t,
    created_at: new Date(t.created_at),
  }));
}
