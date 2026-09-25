import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPrisma, isDatabaseReady } from '../db/client.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { FileStorage } from '../db/fileStorage.js';

export const authRouter = Router();

// Pilot access whitelist restriction
export const AUTHORIZED_EMAIL = 'sahilrawat680@gmail.com';

// In-memory fallback students if DB is offline
const inMemoryStudents: Map<string, { id: string; email: string; password_hash: string; name?: string }> = new Map();

authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const studentEmail = email.toLowerCase().trim();

    // Check authorization whitelist
    if (studentEmail !== AUTHORIZED_EMAIL) {
      return res.status(403).json({
        error: `Access restricted: Only ${AUTHORIZED_EMAIL} is authorized to register.`,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let studentId: string;
    let studentName = name?.trim() || null;

    if (isDatabaseReady()) {
      const prisma = getPrisma();
      const existing = await prisma.student.findUnique({ where: { email: studentEmail } });
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const created = await prisma.student.create({
        data: {
          email: studentEmail,
          password_hash: passwordHash,
          name: studentName,
        },
      });
      studentId = created.id;
    } else {
      // Check persistent file storage
      const existing = FileStorage.getStudentByEmail(studentEmail);
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      studentId = crypto.randomUUID();
      const newStudent = {
        id: studentId,
        email: studentEmail,
        password_hash: passwordHash,
        name: studentName || undefined,
      };
      inMemoryStudents.set(studentId, newStudent);
      FileStorage.saveStudent(newStudent);
    }

    const token = jwt.sign(
      { id: studentId, email: studentEmail, name: studentName },
      config.sessionSecret,
      { expiresIn: '7d' }
    );

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      user: { id: studentId, email: studentEmail, name: studentName },
      token,
    });
  } catch (err: any) {
    console.error('[Auth] Signup error:', err);
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const studentEmail = email.toLowerCase().trim();

    // Check authorization whitelist
    if (studentEmail !== AUTHORIZED_EMAIL) {
      return res.status(403).json({
        error: `Access restricted: Only ${AUTHORIZED_EMAIL} is authorized to sign in.`,
      });
    }

    let userRecord: { id: string; email: string; password_hash: string; name?: string | null } | null = null;

    if (isDatabaseReady()) {
      const prisma = getPrisma();
      userRecord = await prisma.student.findUnique({ where: { email: studentEmail } });
    } else {
      userRecord = FileStorage.getStudentByEmail(studentEmail) || null;
      if (!userRecord) {
        for (const s of inMemoryStudents.values()) {
          if (s.email === studentEmail) {
            userRecord = s;
            break;
          }
        }
      }
    }

    // Auto-provision authorized pilot user if record does not exist yet
    if (!userRecord) {
      const passwordHash = await bcrypt.hash(password, 10);
      const studentName = 'Sahil Rawat';
      const studentId = crypto.randomUUID();

      if (isDatabaseReady()) {
        const prisma = getPrisma();
        try {
          const created = await prisma.student.create({
            data: {
              email: studentEmail,
              password_hash: passwordHash,
              name: studentName,
            },
          });
          userRecord = created;
        } catch {
          const studentItem = {
            id: studentId,
            email: studentEmail,
            password_hash: passwordHash,
            name: studentName,
          };
          inMemoryStudents.set(studentId, studentItem);
          FileStorage.saveStudent(studentItem);
          userRecord = studentItem;
        }
      } else {
        const studentItem = {
          id: studentId,
          email: studentEmail,
          password_hash: passwordHash,
          name: studentName,
        };
        inMemoryStudents.set(studentId, studentItem);
        FileStorage.saveStudent(studentItem);
        userRecord = studentItem;
      }
    } else {
      const isValid = await bcrypt.compare(password, userRecord.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }

    const token = jwt.sign(
      { id: userRecord.id, email: userRecord.email, name: userRecord.name },
      config.sessionSecret,
      { expiresIn: '7d' }
    );

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: { id: userRecord.id, email: userRecord.email, name: userRecord.name },
      token,
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Failed to authenticate' });
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('session_token', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
  });
  return res.json({ success: true, message: 'Logged out successfully' });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.json({ user: req.user });
});
