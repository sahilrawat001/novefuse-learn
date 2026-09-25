import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check cookie or Authorization header
  let token = req.cookies?.session_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.sessionSecret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.session_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.sessionSecret) as AuthenticatedUser;
      req.user = decoded;
    } catch {
      // Ignored for optional auth
    }
  }
  next();
}
