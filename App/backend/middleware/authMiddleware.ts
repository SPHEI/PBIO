import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

export interface AuthRequest extends Request {
  user?: { userId: string; username: string; admin: boolean };
}

// 1. Verify standard JWT token
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Access token missing or malformed' });
  }

  const secret = process.env.JWT_SECRET || 'fallback_secret_key';

  jwt.verify(token, secret, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' , relog: true});
    }

    req.user = decoded as { userId: string; username: string; admin: boolean };
    next();
  });
};

// 2. Verify that the authenticated user is an admin
export const verifyAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Double-check the database to ensure admin status wasn't recently revoked
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!dbUser || !dbUser.admin) {
      return res.status(403).json({ error: 'Access denied: Admin privileges required' });
    }

    next();
  } catch (error) {
    console.error('Error verifying admin status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};