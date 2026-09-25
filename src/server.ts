import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { checkDbConnection } from './db/client.js';
import { setupVoiceRelayWebSocket } from './ws/voiceRelay.js';

import { authRouter } from './routes/auth.js';
import { studyMaterialRouter } from './routes/studyMaterial.js';
import { sessionsRouter } from './routes/sessions.js';
import { topicsRouter } from './routes/topics.js';
import { voiceSessionRouter } from './routes/voiceSession.js';
import { statsRouter } from './routes/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// API Endpoints
app.use('/api/auth', authRouter);
app.use('/api/study-material', studyMaterialRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/voice-session', voiceSessionRouter);
app.use('/api/stats', statsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    assemblyAiConfigured: Boolean(config.assemblyAiApiKey),
  });
});

// Serve frontend static build in production or when client/dist exists
const clientDistPath = path.resolve(process.cwd(), 'client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In dev mode when client is served by Vite on port 5173
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Voice Study Agent</title></head>
          <body style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: auto;">
            <h2>Voice Study Agent Backend is Running</h2>
            <p>Port: ${config.port}</p>
            <p>API Health: <a href="/api/health">/api/health</a></p>
            <p>Vite Frontend runs on <a href="http://localhost:5173">http://localhost:5173</a> during development.</p>
          </body>
        </html>
      `);
    }
  });
});

// Setup WebSocket server for voice relay
const wss = new WebSocketServer({ noServer: true });
setupVoiceRelayWebSocket(wss);

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  if (url.pathname.startsWith('/ws/voice-session/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Startup
server.listen(config.port, '0.0.0.0', async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Voice Study Agent Server listening on port ${config.port}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${config.port}/ws/voice-session/:sessionId`);
  console.log(`======================================================\n`);

  await checkDbConnection();
});
