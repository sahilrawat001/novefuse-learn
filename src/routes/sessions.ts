import { Router, Request, Response } from 'express';
import { getPrisma, isDatabaseReady } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { getSessionSummaryInMemory, getSessionTopicsInMemory } from '../services/toolHandlers.js';
import { FileStorage } from '../db/fileStorage.js';

export const sessionsRouter = Router();

// In-memory fallback sessions
interface InMemorySession {
  id: string;
  student_id: string;
  study_material_id?: string | null;
  mode: 'revision' | 'interview';
  started_at: Date;
  ended_at?: Date | null;
  raw_transcript?: string | null;
  summary_json?: any;
  api_cost_estimate_usd?: number | null;
}
export const inMemorySessions: Map<string, InMemorySession> = new Map();

sessionsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;

    if (isDatabaseReady()) {
      const prisma = getPrisma();
      const sessions = await prisma.session.findMany({
        where: { student_id: studentId },
        orderBy: { started_at: 'desc' },
        include: {
          studyMaterial: {
            select: { title: true, mode: true },
          },
        },
      });
      return res.json({ sessions });
    }

    const fileSessions = FileStorage.getSessionsForStudent(studentId);
    const inMemSessions = Array.from(inMemorySessions.values()).filter((s) => s.student_id === studentId);

    // Merge sessions by id
    const sessionMap = new Map<string, any>();
    for (const fs of fileSessions) {
      const mat = fs.study_material_id ? FileStorage.getMaterial(fs.study_material_id) : null;
      sessionMap.set(fs.id, {
        ...fs,
        started_at: new Date(fs.started_at),
        ended_at: fs.ended_at ? new Date(fs.ended_at) : null,
        studyMaterial: mat ? { title: mat.title, mode: mat.mode } : null,
        summary_json: fs.summary_json || FileStorage.getSessionSummary(fs.id) || getSessionSummaryInMemory(fs.id),
      });
    }

    for (const ms of inMemSessions) {
      const existing = sessionMap.get(ms.id);
      sessionMap.set(ms.id, {
        ...existing,
        ...ms,
        summary_json: ms.summary_json || existing?.summary_json || getSessionSummaryInMemory(ms.id),
      });
    }

    const sessions = Array.from(sessionMap.values())
      .sort((a, b) => (new Date(b.started_at).getTime() || 0) - (new Date(a.started_at).getTime() || 0));

    return res.json({ sessions });
  } catch (err: any) {
    console.error('[Sessions] List error:', err);
    return res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
});

sessionsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const sessionId = req.params.id;

    if (isDatabaseReady()) {
      const prisma = getPrisma();
      const session = await prisma.session.findFirst({
        where: { id: sessionId, student_id: studentId },
        include: {
          studyMaterial: true,
          topicResults: {
            orderBy: { created_at: 'asc' },
          },
        },
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      return res.json({ session });
    }

    let session: any = inMemorySessions.get(sessionId);
    if (!session || session.student_id !== studentId) {
      const fileSession = FileStorage.getSession(sessionId);
      if (fileSession && fileSession.student_id === studentId) {
        session = {
          ...fileSession,
          started_at: new Date(fileSession.started_at),
          ended_at: fileSession.ended_at ? new Date(fileSession.ended_at) : null,
        };
      }
    }

    if (!session || session.student_id !== studentId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const topicResults = getSessionTopicsInMemory(sessionId);
    const summaryJson = session.summary_json || FileStorage.getSessionSummary(sessionId) || getSessionSummaryInMemory(sessionId);
    const mat = session.study_material_id ? FileStorage.getMaterial(session.study_material_id) : null;

    return res.json({
      session: {
        ...session,
        summary_json: summaryJson,
        topicResults,
        studyMaterial: mat ? { title: mat.title, mode: mat.mode } : null,
      },
    });
  } catch (err: any) {
    console.error('[Sessions] Detail error:', err);
    return res.status(500).json({ error: 'Failed to retrieve session detail' });
  }
});
