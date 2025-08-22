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
  const me = db.prepare('SELECT id, email, display_name, cellphone, bio, avatar_url FROM users WHERE id = ?').get(req.user.userId);
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

export default router;


