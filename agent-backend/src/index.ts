import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import 'dotenv/config';
import { router } from './api/routes.js';
import { startAllSchedulers, setBroadcast } from './agent/scheduler.js';

const app = express();

// Restrict CORS to known frontend origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://nectarfi.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Mount API routes
app.use('/api', router);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

// Set up broadcast function for scheduler
setBroadcast((event, data) => {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`NectarFi backend running on port ${PORT}`);
  startAllSchedulers();
});

export { wss };
