import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// 1. GET: Fetch all users from the database
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
        // Exclude password from the response for security!
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. POST: Create a new user (Sign Up)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Save the user to the database
    // (Tip: In production, hash the 'password' using bcrypt before saving!)
    const newUser = await prisma.user.create({
      data: {
        username,
        password, // Ideally: await bcrypt.hash(password, 10)
      },
    });

    res.status(201).json({
      message: 'User created successfully',
      userId: newUser.id,
      username: newUser.username,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;