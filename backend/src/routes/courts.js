import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

router.get('/', (_req, res) => {
  const db = _req.db;
  const rows = db.prepare('SELECT c.*, u.display_name as owner_name FROM courts c JOIN users u ON u.id = c.owner_user_id ORDER BY c.created_at DESC').all();
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const db = req.db;
  const { name, location } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO courts (id, name, location, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, location || null, req.user.userId, createdAt);
  res.status(201).json({ id, name, location, owner_user_id: req.user.userId, created_at: createdAt });
});

router.get('/:courtId', (req, res) => {
  const db = req.db;
  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(req.params.courtId);
  if (!court) return res.status(404).json({ error: 'Court not found' });
  res.json(court);
});

// Court challenges feed
router.get('/:courtId/challenges', (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT ch.*, u1.display_name as challenger_name, u2.display_name as challenged_name
    FROM challenges ch
    JOIN ladders l ON l.id = ch.ladder_id
    JOIN users u1 ON u1.id = ch.challenger_user_id
    JOIN users u2 ON u2.id = ch.challenged_user_id
    WHERE l.court_id = ?
    ORDER BY ch.created_at DESC
  `).all(req.params.courtId);
  res.json(rows);
});

export default router;


