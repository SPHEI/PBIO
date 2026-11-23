import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { verifyToken, AuthRequest } from '../middleware/authMiddleware';

const router = Router();
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const refreshHash = (token: string) => createHash('sha256').update(token).digest('hex');
const issueAccessToken = (user: { id: string; username: string; admin: boolean }) =>
  jwt.sign({ userId: user.id, username: user.username, admin: user.admin }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '15m' });
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('token', accessToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: ACCESS_TTL_MS });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, secure, sameSite: 'lax', path: '/api', maxAge: REFRESH_TTL_MS });
};
const clearAuthCookies = (res: Response) => {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie('token', { httpOnly: true, secure, sameSite: 'lax', path: '/' });
  res.clearCookie('refreshToken', { httpOnly: true, secure, sameSite: 'lax', path: '/api' });
};

// Helper function to validate password strength
const validatePassword = (password: string): string | null => {
  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least 1 uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least 1 number';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least 1 special symbol';
  }
  return null;
};

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 1. POST: Create a new user (Sign Up) with password hashing
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (typeof username !== 'string' || !isValidEmail(username)) {
      return res.status(400).json({ error: 'Username must be a valid email address' });
    }

    // Validate password rules
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash the password securely
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save the user to the database
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
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

// 2. POST: Log in an existing user and return a JWT token
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = issueAccessToken(user);
    const refreshToken = randomBytes(48).toString('hex');
    await prisma.refreshToken.create({ data: { tokenHash: refreshHash(refreshToken), userId: user.id, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) } });
    setAuthCookies(res, token, refreshToken);

    res.json({
      message: 'Login successful',
      userId: user.id,
      username: user.username,
      admin: user.admin
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  const oldToken = req.cookies?.refreshToken;
  if (!oldToken) return res.status(401).json({ error: 'Refresh token missing' });
  try {
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: refreshHash(oldToken) }, include: { user: true } });
    if (!record || record.expiresAt <= new Date()) {
      if (record) await prisma.refreshToken.delete({ where: { id: record.id } });
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token invalid or expired' });
    }
    const nextToken = randomBytes(48).toString('hex');
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: record.id } }),
      prisma.refreshToken.create({ data: { tokenHash: refreshHash(nextToken), userId: record.userId, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) } }),
    ]);
    setAuthCookies(res, issueAccessToken(record.user), nextToken);
    return res.json({ message: 'Token refreshed' });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  try {
    if (refreshToken) await prisma.refreshToken.deleteMany({ where: { tokenHash: refreshHash(refreshToken) } });
    clearAuthCookies(res);
    return res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. PUT: Change password for the logged-in user
router.put('/password', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }

    // Validate new password rules
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
    await prisma.refreshToken.deleteMany({ where: { userId } });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. DELETE: Delete user account and associated entries, requiring current password
router.delete('/account', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    const userId = req.user!.userId;

    if (!password) {
      return res.status(400).json({ error: 'Current password is required to delete your account' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    // Delete associated entries and user account in a transaction
    await prisma.$transaction([
      prisma.entry.deleteMany({ where: { user_id: userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.json({ message: 'Account and associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
