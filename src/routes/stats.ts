import { Router, Request, Response } from 'express';
import { getPrisma, isDatabaseReady } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { inMemorySessions } from './sessions.js';

import { FileStorage } from '../db/fileStorage.js';

export const statsRouter = Router();

statsRouter.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;

    if (isDatabaseReady()) {
      const prisma = getPrisma();
      const sessions = await prisma.session.findMany({
        where: { student_id: studentId },
        select: {
          started_at: true,
          ended_at: true,
          api_cost_estimate_usd: true,
        },
      });

      let totalSessions = sessions.length;
      let totalCostUsd = 0;
      let totalDurationMinutes = 0;

      for (const s of sessions) {
        if (s.api_cost_estimate_usd) {
          totalCostUsd += Number(s.api_cost_estimate_usd);
        }
        if (s.started_at && s.ended_at) {
          totalDurationMinutes += (s.ended_at.getTime() - s.started_at.getTime()) / 60000;
        }
      }

      return res.json({
        totalSessions,
        totalDurationMinutes: Number(totalDurationMinutes.toFixed(2)),
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
        unitRatePerMinuteUsd: 0.075,
      });
    }

    // In-memory & file storage stats fallback
    const fileSessions = FileStorage.getSessionsForStudent(studentId);
    const inMemSessions = Array.from(inMemorySessions.values()).filter((s) => s.student_id === studentId);

    const sessionMap = new Map<string, any>();
    for (const fs of fileSessions) {
      sessionMap.set(fs.id, {
        api_cost_estimate_usd: fs.api_cost_estimate_usd,
        started_at: new Date(fs.started_at),
        ended_at: fs.ended_at ? new Date(fs.ended_at) : null,
      });
    }
    for (const ms of inMemSessions) {
      sessionMap.set(ms.id, {
        api_cost_estimate_usd: ms.api_cost_estimate_usd,
        started_at: ms.started_at,
        ended_at: ms.ended_at,
      });
    }

    const studentSessions = Array.from(sessionMap.values());
    let totalCostUsd = 0;
    let totalDurationMinutes = 0;

    for (const s of studentSessions) {
      if (s.api_cost_estimate_usd) {
        totalCostUsd += Number(s.api_cost_estimate_usd);
      }
      if (s.started_at && s.ended_at) {
        totalDurationMinutes += (s.ended_at.getTime() - s.started_at.getTime()) / 60000;
      }
    }

    return res.json({
      totalSessions: studentSessions.length,
      totalDurationMinutes: Number(totalDurationMinutes.toFixed(2)),
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      unitRatePerMinuteUsd: 0.075,
    });
  } catch (err: any) {
    console.error('[Stats] Usage query error:', err);
    return res.status(500).json({ error: 'Failed to retrieve usage stats' });
  }
});
