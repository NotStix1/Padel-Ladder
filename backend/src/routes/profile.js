import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// File storage
const uploadDir = path.join(process.cwd(), 'backend', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `avatar_${req.user.userId}${ext}`);
  }
});
const upload = multer({ storage });

// Get my profile
router.get('/me', requireAuth, (req, res) => {
  const db = req.db;
  const me = db
    .prepare('SELECT id, email, display_name, cellphone, bio, avatar_url, last_online_at FROM users WHERE id = ?')
    .get(req.user.userId);
  res.json(me || {});
});

// Update basic fields
router.put('/me', requireAuth, (req, res) => {
  const db = req.db;
  const { displayName, cellphone, bio } = req.body;
  const fields = { display_name: displayName, cellphone, bio };
  const setParts = Object.keys(fields).filter(k => fields[k] !== undefined).map(k => `${k} = ?`);
  const values = Object.keys(fields).filter(k => fields[k] !== undefined).map(k => fields[k]);
  if (setParts.length === 0) return res.json({ ok: true });
  values.push(req.user.userId);
  req.db.prepare(`UPDATE users SET ${setParts.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Upload avatar
router.post('/me/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  const rel = `/uploads/${path.basename(req.file.path)}`;
  req.db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(rel, req.user.userId);
  res.json({ url: rel });
});

// List currently online users (seen within last 5 minutes)
router.get('/online', (_req, res) => {
  const db = req.db;
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const rows = db
    .prepare(
      'SELECT id, display_name, avatar_url, last_online_at FROM users WHERE last_online_at >= ? ORDER BY display_name'
    )
    .all(since);
  res.json(rows);
});

// Public challenge history for a user
router.get('/:userId/history', (req, res) => {
  const db = req.db;
  const { userId } = req.params;
  const rows = db
    .prepare(
      `SELECT m.*, u1.display_name AS p1_name, u2.display_name AS p2_name
       FROM matches m
       JOIN users u1 ON u1.id = m.p1_user_id
       JOIN users u2 ON u2.id = m.p2_user_id
       WHERE m.p1_user_id = ? OR m.p2_user_id = ?
       ORDER BY m.created_at DESC`
    )
    .all(userId, userId);
  res.json(rows);
});

export default router;


