import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

import { verifyToken, verifyAdmin, AuthRequest } from '../middleware/authMiddleware';

// GET: Fetch all users (PROTECTED - Admin only)
router.get('/users', verifyToken, verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
        admin: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;