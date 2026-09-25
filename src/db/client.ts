import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

let prisma: PrismaClient | null = null;
let isDbConnected = false;

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

export async function checkDbConnection(): Promise<boolean> {
  if (!config.databaseUrl) {
    isDbConnected = false;
    return false;
  }

  try {
    const client = getPrisma();
    await client.$queryRaw`SELECT 1`;
    isDbConnected = true;
    return true;
  } catch (err: any) {
    isDbConnected = false;
    console.warn('⚠️  Database connection could not be established:', err.message);
    return false;
  }
}

export function isDatabaseReady(): boolean {
  return isDbConnected;
}
