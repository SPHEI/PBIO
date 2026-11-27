//Literally no actual change here

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import accountRoutes from './routes/accountRoutes';
import entryRoutes from './routes/entryRoutes';
import adminRoutes from './routes/adminRoutes';
import bcrypt from 'bcrypt';
import prisma from './config/db';
import cookieParser from 'cookie-parser';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const certDirectory = path.resolve(__dirname, '../certs');

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.status(200).json({message: "Welcome to the backend. Functions available under /api"});
});

app.get('/api', (req, res) => {
  res.status(200).json({
    message: "Welcome to the api. Here you can see all available routes.",
    base: [
      "GET  / - Welcome message",
      "GET  /api - Route list",
      "GET  /api/health - Server status"
    ],
    accountRoutes: [
      "POST   /api/register - Creates a new user",
      "POST   /api/login - Logs in",
      "POST   /api/refresh - Rotates refresh token and renews access token",
      "POST   /api/logout - Logs out and revokes refresh token",
      "PUT    /api/password - Changes password",
      "DELETE /api/account - Deletes account"
    ],
    entryRoutes: [
      "POST   /api/entries - Creates a new entry",
      "DELETE /api/entries - Deletes an entry",
      "GET    /api/entries - Get all entries of a user" 
    ],
    adminRoutes: [
      "GET    /api/users - Gets a list of all users",
      "DELETE /api/users - Deletes a user"
    ]
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({status: "ok"});
});

app.use('/api', accountRoutes);
app.use('/api', entryRoutes);
app.use('/api', adminRoutes);

async function createDefaultAdmin() {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { admin: true },
    });

    if (!existingAdmin) {
      const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await prisma.user.create({
        data: {
          username: 'admin@example.com',
          password: hashedPassword,
          admin: true,
        },
      });

      console.log('✅ Default admin user created successfully (Email: admin@example.com)');
    }
  } catch (error) {
    console.error('Error seeding default admin:', error);
  }
}


const server = process.env.NODE_ENV === 'production'
  ? app.listen(PORT, onListening)
  : https.createServer({
      key: fs.readFileSync(path.join(certDirectory, 'localhost-key.pem')),
      cert: fs.readFileSync(path.join(certDirectory, 'localhost.pem')),
    }, app).listen(PORT, onListening);

function onListening() {
  console.log(`Server is running on ${process.env.NODE_ENV === 'production' ? 'http' : 'https'}://localhost:${PORT}`);
  void createDefaultAdmin();
}

export default app;
