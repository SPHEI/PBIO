import { Router, Response } from 'express';
import prisma from '../config/db';
import { verifyToken, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// 1. POST: Create a new entry
router.post('/entries', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, amount, date, income, targetUserId } = req.body;

    if (amount === undefined) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Determine whose user_id to tie the entry to:
    // - If the requester is an admin and specified a targetUserId, use it.
    // - Otherwise, default to the currently logged-in user's ID.
    let userIdToUse = req.user!.userId;
    if (req.user!.admin && targetUserId) {
      userIdToUse = targetUserId;
    }

    const newEntry = await prisma.entry.create({
      data: {
        name: name || 'Transfer',
        amount: parseFloat(amount),
        date: date ? new Date(date) : undefined,
        income: income ?? false,
        user_id: userIdToUse,
      },
    });

    res.status(201).json({
      message: 'Entry created successfully',
      entry: newEntry,
    });
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. DELETE: Delete an entry (User: own entries only | Admin: any entry)
router.delete('/entries/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const requester = req.user!;

    // Find the entry first to check ownership
    const entry = await prisma.entry.findUnique({
      where: { id },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Check permissions: Non-admins can only delete their own entries
    if (!requester.admin && entry.user_id !== requester.userId) {
      return res.status(403).json({ error: 'Access denied: You can only delete your own entries' });
    }

    // Delete the entry
    await prisma.entry.delete({
      where: { id },
    });

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. GET: Fetch entries for a user
// - Non-admin: returns their own entries
// - Admin: returns entries of a specified user via query parameter (e.g., /api/entries?userId=XYZ)
router.get('/entries', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const requester = req.user!;
    let userIdToFetch: string = requester.userId;

    // Safely check if the requester is an admin and a string query param was provided
    if (requester.admin && typeof req.query.userId === 'string') {
      userIdToFetch = req.query.userId;
    }

    const entries = await prisma.entry.findMany({
      where: { user_id: userIdToFetch },
      orderBy: { date: 'desc' },
    });

    res.json(entries);
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;