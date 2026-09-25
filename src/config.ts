import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-voice-study-agent-12345',
  isProduction: process.env.NODE_ENV === 'production',
};

if (!config.assemblyAiApiKey) {
  console.warn(
    '\x1b[33m%s\x1b[0m',
    '⚠️  WARNING: ASSEMBLYAI_API_KEY is not set. Real-time voice sessions will require an API key in .env'
  );
}
