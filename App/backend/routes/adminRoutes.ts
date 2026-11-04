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

// DELETE: Admin deletes any user by ID (along with their stored entries)
router.delete('/users/:id', verifyToken, verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userIdToDelete = req.params.id as string;
    const adminUserId = req.user!.userId;

    // Optional safety check: Prevent admin from deleting their own account via this endpoint
    if (userIdToDelete === adminUserId) {
      return res.status(400).json({ error: 'You cannot delete your own admin account from the user management panel.' });
    }

    // Check if target user exists
    const userToDelete = await prisma.user.findUnique({
      where: { id: userIdToDelete },
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete associated entries and user account in a transaction
    await prisma.$transaction([
      prisma.entry.deleteMany({ where: { user_id: userIdToDelete } }),
      prisma.user.delete({ where: { id: userIdToDelete } }),
    ]);

    res.json({ message: `User '${userToDelete.username}' and all associated entries deleted successfully` });
  } catch (error) {
    console.error('Error deleting user by admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;