import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, initDb } from './db.js';
import { initFirebaseAdmin } from './firebase.js';
import authRouter from './routes/auth.js';
import courtsRouter from './routes/courts.js';
import laddersRouter from './routes/ladders.js';
import challengesRouter from './routes/challenges.js';
import configRouter from './routes/config.js';
import profileRouter from './routes/profile.js';
import teamsRouter from './routes/teams.js';

await initDb();
initFirebaseAdmin();
const app = express();
const port = process.env.SERVER_PORT || process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors());
app.use(express.json());

// Attach db to request
app.use((req, _res, next) => {
  req.db = getDb();
  next();
});

// Attach user if Authorization bearer provided
app.use((req, _res, next) => {
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded;
      try {
        req.db
          .prepare('UPDATE users SET last_online_at = ? WHERE id = ?')
          .run(new Date().toISOString(), decoded.userId);
      } catch (_) {
        // ignore
      }
    } catch (_) {
      // ignore invalid token
    }
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'padel-ladder-backend' });
});

app.use('/auth', authRouter);
app.use('/courts', courtsRouter);
app.use('/ladders', laddersRouter);
app.use('/challenges', challengesRouter);
app.use('/config', configRouter);
app.use('/profile', profileRouter);
app.use('/teams', teamsRouter);

// Serve frontend (if built)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const distPath = process.env.FRONTEND_DIST || defaultDist;
if (process.env.SERVE_FRONTEND !== '0' && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send('Padel Ladder API. See /health');
  });
}

// Serve uploads (ensure directory exists)
const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}
app.use('/uploads', express.static(uploadsDir));

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Padel Ladder backend listening on http://localhost:${port}`);
});


