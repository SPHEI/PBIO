import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import accountRoutes from './routes/accountRoutes';
import entryRoutes from './routes/entryRoutes';
import adminRoutes from './routes/adminRoutes';
import bcrypt from 'bcrypt';
import prisma from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({message: "Welcome to the backend. Functions available under /api"});
});

app.get('/api', (req, res) => {
  res.json({message: "Welcome to the api."});
});

app.get('/api/health', (req, res) => {
  res.json({status: "ok"});
});

app.use('/api', accountRoutes);
app.use('/api', entryRoutes);
app.use('/api', adminRoutes);

async function createDefaultAdmin() {
  try {
    // Check if any admin user already exists in the database
    const existingAdmin = await prisma.user.findFirst({
      where: { admin: true },
    });

    if (!existingAdmin) {
      // Pull password from .env or fallback to 'admin123'
      const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          admin: true,
        },
      });

      console.log('✅ Default admin user created successfully (Username: admin)');
    }
  } catch (error) {
    console.error('Error seeding default admin:', error);
  }
}


app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  await createDefaultAdmin();
});