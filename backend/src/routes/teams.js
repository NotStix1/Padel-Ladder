import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// List my teams on a ladder
router.get('/:ladderId', requireAuth, (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT * FROM teams
    WHERE ladder_id = ? AND (player1_user_id = ? OR player2_user_id = ?)
  `).all(req.params.ladderId, req.user.userId, req.user.userId);
  res.json(rows);
});

// Create a team (me + partner)
router.post('/:ladderId', requireAuth, (req, res) => {
  const db = req.db;
  const { partnerUserId } = req.body;
  if (!partnerUserId) return res.status(400).json({ error: 'partnerUserId required' });
  const ladder = db.prepare('SELECT * FROM ladders WHERE id = ?').get(req.params.ladderId);
  if (!ladder) return res.status(404).json({ error: 'Ladder not found' });
  const rules = JSON.parse(ladder.rules_json || '{}');
  if (rules.format !== 'doubles') return res.status(400).json({ error: 'Ladder not doubles' });

  const existing = db.prepare(`
    SELECT * FROM teams WHERE ladder_id = ? AND (
      (player1_user_id = ? AND player2_user_id = ?) OR
      (player1_user_id = ? AND player2_user_id = ?)
    )
  `).get(req.params.ladderId, req.user.userId, partnerUserId, partnerUserId, req.user.userId);
  if (existing) return res.status(409).json({ error: 'Team already exists' });

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO teams (id, ladder_id, player1_user_id, player2_user_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.ladderId, req.user.userId, partnerUserId, createdAt);
  res.status(201).json({ id, ladder_id: req.params.ladderId });
});

export default router;


