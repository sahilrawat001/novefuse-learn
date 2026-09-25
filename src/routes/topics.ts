import { Router, Request, Response } from 'express';
import { getPrisma, isDatabaseReady } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const topicsRouter = Router();

export async function getWeakTopicsForStudent(studentId: string): Promise<string[]> {
  if (isDatabaseReady()) {
    try {
      const prisma = getPrisma();
      // Fetch all topic results for this student ordered by created_at desc
      const results = await prisma.topicResult.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
        select: { topic: true, status: true },
      });

      // Map unique latest status per topic
      const latestStatusMap = new Map<string, string>();
      for (const row of results) {
        if (!latestStatusMap.has(row.topic)) {
          latestStatusMap.set(row.topic, row.status);
        }
      }

      // Filter where status === 'weak'
      const weakTopics: string[] = [];
      for (const [topic, status] of latestStatusMap.entries()) {
        if (status === 'weak') {
          weakTopics.push(topic);
        }
      }
      return weakTopics;
    } catch (err: any) {
      console.error('[Topics] Error fetching weak topics:', err.message);
      return [];
    }
  }

  return [];
}

topicsRouter.get('/weak', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const weakTopics = await getWeakTopicsForStudent(studentId);
    return res.json({ weak_topics: weakTopics });
  } catch (err: any) {
    console.error('[Topics] GET /api/topics/weak error:', err);
    return res.status(500).json({ error: 'Failed to fetch weak topics' });
  }
});
