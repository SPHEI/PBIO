import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';

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

// Mount user routes (e.g., /api/users, /api/register)
app.use('/api', userRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});