import fs from 'fs';
import path from 'path';

export interface StoredStudent {
  id: string;
  email: string;
  password_hash: string;
  name?: string;
}

export interface StoredMaterial {
  id: string;
  student_id: string;
  mode: 'revision' | 'interview';
  title: string;
  content: string;
  created_at: string;
}

export interface StoredSession {
  id: string;
  student_id: string;
  study_material_id?: string | null;
  mode: 'revision' | 'interview';
  started_at: string;
  ended_at?: string | null;
  raw_transcript?: string | null;
  summary_json?: any;
  api_cost_estimate_usd?: number | null;
}

export interface StoredTopicResult {
  id: string;
  topic: string;
  status: 'strong' | 'partial' | 'weak';
  notes?: string;
  created_at: string;
}

interface LocalStorageSchema {
  students: Record<string, StoredStudent>;
  materials: StoredMaterial[];
  sessions: Record<string, StoredSession>;
  topicResults: Record<string, StoredTopicResult[]>;
  summaries: Record<string, any>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'local_storage.json');

let inMemoryState: LocalStorageSchema = {
  students: {},
  materials: [],
  sessions: {},
  topicResults: {},
  summaries: {},
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadState(): void {
  try {
    ensureDir();
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      inMemoryState = {
        students: parsed.students || {},
        materials: parsed.materials || [],
        sessions: parsed.sessions || {},
        topicResults: parsed.topicResults || {},
        summaries: parsed.summaries || {},
      };
      console.log(`[LocalStorage] Hydrated ${Object.keys(inMemoryState.sessions).length} sessions, ${inMemoryState.materials.length} materials from ${STORAGE_FILE}`);
    }
  } catch (err: any) {
    console.warn('[LocalStorage] Notice reading storage file:', err.message);
  }
}

// Initial hydration on startup
loadState();

let saveTimeout: NodeJS.Timeout | null = null;

export function persistState(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      ensureDir();
      const tmpFile = `${STORAGE_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(inMemoryState, null, 2), 'utf-8');
      fs.renameSync(tmpFile, STORAGE_FILE);
    } catch (err: any) {
      console.error('[LocalStorage] Error persisting state to file:', err.message);
    }
  }, 100);
}

export const FileStorage = {
  // Students
  getStudent(id: string): StoredStudent | undefined {
    return inMemoryState.students[id];
  },
  getStudentByEmail(email: string): StoredStudent | undefined {
    const cleanEmail = email.toLowerCase().trim();
    return Object.values(inMemoryState.students).find((s) => s.email.toLowerCase() === cleanEmail);
  },
  saveStudent(student: StoredStudent): void {
    inMemoryState.students[student.id] = student;
    persistState();
  },

  // Materials
  getMaterials(studentId: string): StoredMaterial[] {
    return inMemoryState.materials.filter((m) => m.student_id === studentId);
  },
  getMaterial(id: string): StoredMaterial | undefined {
    return inMemoryState.materials.find((m) => m.id === id);
  },
  saveMaterial(material: StoredMaterial): void {
    const index = inMemoryState.materials.findIndex((m) => m.id === material.id);
    if (index >= 0) {
      inMemoryState.materials[index] = material;
    } else {
      inMemoryState.materials.push(material);
    }
    persistState();
  },

  // Sessions
  getSession(id: string): StoredSession | undefined {
    return inMemoryState.sessions[id];
  },
  getSessionsForStudent(studentId: string): StoredSession[] {
    return Object.values(inMemoryState.sessions).filter((s) => s.student_id === studentId);
  },
  saveSession(session: StoredSession): void {
    inMemoryState.sessions[session.id] = session;
    persistState();
  },

  // Topic Results
  getTopicResults(sessionId: string): StoredTopicResult[] {
    return inMemoryState.topicResults[sessionId] || [];
  },
  addTopicResult(sessionId: string, result: StoredTopicResult): void {
    if (!inMemoryState.topicResults[sessionId]) {
      inMemoryState.topicResults[sessionId] = [];
    }
    inMemoryState.topicResults[sessionId].push(result);
    persistState();
  },

  // Summaries
  getSessionSummary(sessionId: string): any | undefined {
    return inMemoryState.summaries[sessionId];
  },
  saveSessionSummary(sessionId: string, summary: any): void {
    inMemoryState.summaries[sessionId] = summary;
    persistState();
  },
};
