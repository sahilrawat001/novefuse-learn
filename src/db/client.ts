import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

let prisma: PrismaClient | null = null;
let isDbConnected = false;

const INIT_SQL_FALLBACK = `
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_material (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('revision', 'interview')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  study_material_id UUID REFERENCES study_material(id),
  mode TEXT NOT NULL CHECK (mode IN ('revision', 'interview')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  raw_transcript TEXT,
  summary_json JSONB,
  api_cost_estimate_usd NUMERIC(10,4)
);

CREATE TABLE IF NOT EXISTS topic_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('strong', 'partial', 'weak')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topic_results_student ON topic_results(student_id, topic);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id, started_at DESC);
`;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.databaseUrl,
        },
      },
      log: config.isProduction ? ['error'] : ['warn', 'error'],
    });
  }
  return prisma;
}

export async function ensureDatabaseSchema(client: PrismaClient): Promise<void> {
  try {
    const tableCheck = await client.$queryRaw<any[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students'
    `;

    if (!tableCheck || tableCheck.length === 0) {
      console.log('🔄 PostgreSQL connected, but tables not found. Automatically initializing schema...');

      let pushed = false;
      try {
        const { execSync } = await import('child_process');
        execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
        pushed = true;
        console.log('✅ Prisma db push synchronized schema successfully.');
      } catch (pushErr: any) {
        console.warn('⚠️  Prisma db push note:', pushErr.message);
      }

      if (!pushed) {
        let sqlToExecute = INIT_SQL_FALLBACK;
        const initSqlPath = path.resolve(process.cwd(), 'prisma/init.sql');
        if (fs.existsSync(initSqlPath)) {
          try {
            sqlToExecute = fs.readFileSync(initSqlPath, 'utf8');
          } catch {
            // fallback to INIT_SQL_FALLBACK
          }
        }

        // Clean out single-line comments properly so CREATE TABLE statements are never dropped
        const cleanSql = sqlToExecute.replace(/--.*$/gm, '');
        const statements = cleanSql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          if (stmt) {
            try {
              await client.$executeRawUnsafe(stmt);
            } catch (stmtErr: any) {
              console.warn('⚠️ Statement execution note:', stmtErr.message);
            }
          }
        }
      }

      console.log('✅ PostgreSQL schema initialization sequence finished.');
    } else {
      console.log('✅ PostgreSQL schema verified (students table present).');
    }
  } catch (err: any) {
    console.warn('⚠️ Could not verify/initialize database schema:', err.message);
  }
}

export async function checkDbConnection(): Promise<boolean> {
  if (!config.databaseUrl) {
    isDbConnected = false;
    return false;
  }

  try {
    const client = getPrisma();
    await client.$queryRaw`SELECT 1`;
    await ensureDatabaseSchema(client);

    // Verify students table actually exists before marking database ready
    const tableCheck = await client.$queryRaw<any[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students'
    `;
    if (tableCheck && tableCheck.length > 0) {
      isDbConnected = true;
      console.log('🚀 Database verified ready with all tables.');
      return true;
    } else {
      console.warn('⚠️ Database connected but tables missing. Seamlessly falling back to local file storage.');
      isDbConnected = false;
      return false;
    }
  } catch (err: any) {
    isDbConnected = false;
    console.warn('⚠️  Database connection could not be established:', err.message);
    return false;
  }
}

export function isDatabaseReady(): boolean {
  return isDbConnected;
}
