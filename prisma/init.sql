-- Voice Study Agent Database Schema (Section 4)

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
