import { Router, Request, Response } from 'express';
import { getPrisma, isDatabaseReady } from '../db/client.js';
import { optionalAuth } from '../middleware/auth.js';
import { getWeakTopicsForStudent } from './topics.js';
import { getStudyMaterialById } from './studyMaterial.js';
import { sessionRegistry, ActiveSessionContext } from '../ws/voiceRelay.js';
import { inMemorySessions } from './sessions.js';
import { FileStorage } from '../db/fileStorage.js';

export const voiceSessionRouter = Router();

const DEFAULT_REVISION_TITLE = 'Photosynthesis & Cellular Respiration';
const DEFAULT_REVISION_CONTENT = `Photosynthesis transforms light energy into chemical energy:
- Light-dependent reactions (thylakoid): H2O is split, O2 is released, ATP and NADPH are synthesized.
- Calvin Cycle / light-independent (stroma): CO2 is fixed using ATP and NADPH into G3P (glucose precursor).

Cellular Respiration:
- Glycolysis (cytosol): Glucose is converted to 2 pyruvate, yielding net 2 ATP and 2 NADH.
- Krebs / Citric Acid Cycle (mitochondrial matrix): Acetyl-CoA oxidized, generating CO2, NADH, FADH2, and ATP.
- Electron Transport Chain (inner mitochondrial membrane): Chemiosmosis produces 32-34 ATP with O2 as terminal electron acceptor.`;

const DEFAULT_INTERVIEW_TITLE = 'Frontend Engineer Interview';
const DEFAULT_INTERVIEW_CONTENT = `Role: Senior Frontend Engineer
Requirements:
- Strong proficiency in modern JavaScript/TypeScript, React, and browser performance optimization.
- Experience with real-time architectures (WebSockets, Web Audio API, WebRTC).
- Strong system design skills: state management, bundle size, latency, accessibility, and resilient component architecture.
- Behavioral competencies: team leadership, technical mentorship, cross-functional conflict resolution, and handling production outages.`;

voiceSessionRouter.post('/token', optionalAuth, async (req: Request, res: Response) => {
  try {
    const studentId = req.user?.id || 'demo-student';
    const {
      mode = 'revision',
      study_material_id,
      title: customTitle,
      content: customContent,
      config: customConfig,
    } = req.body;

    if (!['revision', 'interview'].includes(mode)) {
      return res.status(400).json({ error: "mode must be 'revision' or 'interview'" });
    }

    let title = customTitle?.trim() || (mode === 'revision' ? DEFAULT_REVISION_TITLE : DEFAULT_INTERVIEW_TITLE);
    let content = customContent?.trim() || (mode === 'revision' ? DEFAULT_REVISION_CONTENT : DEFAULT_INTERVIEW_CONTENT);
    let materialId: string | null = study_material_id || null;

    // Fetch study material if provided
    if (materialId) {
      const material = await getStudyMaterialById(materialId, studentId);
      if (material) {
        if (!customTitle?.trim()) title = material.title;
        if (!customContent?.trim()) content = material.content;
      }
    }

    // Fetch weak topics for this student to inject into prompt
    const weakTopics = await getWeakTopicsForStudent(studentId);
    let mergedWeakTopics = [...weakTopics];
    if (customConfig?.customWeakTopics && Array.isArray(customConfig.customWeakTopics)) {
      mergedWeakTopics = Array.from(new Set([...mergedWeakTopics, ...customConfig.customWeakTopics.map((t: string) => t.trim())])).filter(Boolean);
    }

    let sessionId: string = crypto.randomUUID();

    // Create session in Database if connected
    if (isDatabaseReady() && req.user) {
      const prisma = getPrisma();
      const session = await prisma.session.create({
        data: {
          id: sessionId,
          student_id: studentId,
          study_material_id: materialId,
          mode,
        },
      });
      sessionId = session.id;
    } else {
      const storedSession = {
        id: sessionId,
        student_id: studentId,
        study_material_id: materialId,
        mode,
        started_at: new Date().toISOString(),
      };
      FileStorage.saveSession(storedSession);
      inMemorySessions.set(sessionId, {
        id: sessionId,
        student_id: studentId,
        study_material_id: materialId,
        mode,
        started_at: new Date(),
      });
    }

    // Register active session context in memory for WebSocket relay
    const sessionCtx: ActiveSessionContext = {
      sessionId,
      studentId,
      mode,
      title,
      content,
      weakTopics: mergedWeakTopics,
      startedAt: new Date(),
      rawTranscript: '',
      sessionConfig: customConfig,
    };
    sessionRegistry.set(sessionId, sessionCtx);

    console.log(`[Session Token] Generated session ${sessionId} for student ${studentId} (mode: ${mode}, weak topics: ${mergedWeakTopics.length})`);

    return res.status(201).json({
      sessionId,
      mode,
      title,
      wsUrl: `/ws/voice-session/${sessionId}`,
    });
  } catch (err: any) {
    console.error('[Session Token] Error creating token:', err);
    return res.status(500).json({ error: 'Failed to initialize voice session' });
  }
});
