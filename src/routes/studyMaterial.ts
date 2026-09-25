import { Router, Request, Response } from 'express';
import { getPrisma, isDatabaseReady } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { FileStorage } from '../db/fileStorage.js';

export const studyMaterialRouter = Router();

// In-memory study material fallback
interface InMemoryMaterial {
  id: string;
  student_id: string;
  mode: 'revision' | 'interview';
  title: string;
  content: string;
  created_at: Date;
}
const inMemoryMaterials: InMemoryMaterial[] = [];

studyMaterialRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;

    if (isDatabaseReady()) {
      const prisma = getPrisma();
      const materials = await prisma.studyMaterial.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
      });
      return res.json({ materials });
    }

    const stored = FileStorage.getMaterials(studentId);
    const materials = stored.length > 0
      ? stored.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      : inMemoryMaterials
          .filter((m) => m.student_id === studentId)
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return res.json({ materials });
  } catch (err: any) {
    console.error('[StudyMaterial] List error:', err);
    return res.status(500).json({ error: 'Failed to retrieve study materials' });
  }
});

studyMaterialRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const { mode, title, content } = req.body;

    if (!mode || !['revision', 'interview'].includes(mode)) {
      return res.status(400).json({ error: "mode must be either 'revision' or 'interview'" });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    if (isDatabaseReady()) {
      const prisma = getPrisma();
      const material = await prisma.studyMaterial.create({
        data: {
          student_id: studentId,
          mode,
          title: title.trim(),
          content: content.trim(),
        },
      });
      return res.status(201).json({ material });
    }

    const material: InMemoryMaterial = {
      id: crypto.randomUUID(),
      student_id: studentId,
      mode,
      title: title.trim(),
      content: content.trim(),
      created_at: new Date(),
    };
    inMemoryMaterials.push(material);

    FileStorage.saveMaterial({
      id: material.id,
      student_id: material.student_id,
      mode: material.mode,
      title: material.title,
      content: material.content,
      created_at: material.created_at.toISOString(),
    });

    return res.status(201).json({ material });
  } catch (err: any) {
    console.error('[StudyMaterial] Create error:', err);
    return res.status(500).json({ error: 'Failed to save study material' });
  }
});

export function getStudyMaterialById(materialId: string, studentId?: string) {
  if (isDatabaseReady()) {
    const prisma = getPrisma();
    return prisma.studyMaterial.findUnique({
      where: { id: materialId },
    });
  }
  const fileMaterial = FileStorage.getMaterial(materialId);
  if (fileMaterial) {
    return {
      ...fileMaterial,
      created_at: new Date(fileMaterial.created_at),
    };
  }
  return inMemoryMaterials.find((m) => m.id === materialId) || null;
}
