import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// Issue a challenge
router.post('/', requireAuth, (req, res) => {
  const db = req.db;
  const { ladderId, challengedUserId, scheduledAt } = req.body;
  if (!ladderId || !challengedUserId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const ladder = db.prepare('SELECT * FROM ladders WHERE id = ?').get(ladderId);
  if (!ladder) return res.status(404).json({ error: 'Ladder not found' });
  const rules = JSON.parse(ladder.rules_json || '{}');

  // Must be a member to challenge
  const challengerMember = db.prepare('SELECT * FROM ladder_members WHERE ladder_id = ? AND user_id = ?').get(ladderId, req.user.userId);
  const challengedMember = db.prepare('SELECT * FROM ladder_members WHERE ladder_id = ? AND user_id = ?').get(ladderId, challengedUserId);
  if (!challengerMember || !challengedMember) return res.status(400).json({ error: 'Both players must be members' });

  // Enforce challenge distance
  const maxDist = typeof rules.maxChallengeDistance === 'number' ? rules.maxChallengeDistance : 3;
  if (challengerMember.rank - challengedMember.rank < -maxDist) {
    return res.status(400).json({ error: 'Challenge target too high' });
  }

  const outstanding = db.prepare('SELECT COUNT(1) as cnt FROM challenges WHERE ladder_id = ? AND challenger_user_id = ? AND status IN ("PENDING", "ACCEPTED")').get(ladderId, req.user.userId);
  if ((outstanding?.cnt || 0) >= 1) {
    return res.status(400).json({ error: 'Too many outstanding challenges' });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO challenges (id, ladder_id, challenger_user_id, challenged_user_id, status, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, ladderId, req.user.userId, challengedUserId, 'PENDING', scheduledAt || null, createdAt);
  res.status(201).json({ id, ladder_id: ladderId, status: 'PENDING' });
});

// List challenges for a ladder
router.get('/', (req, res) => {
  const db = req.db;
  const { ladderId, status, upcoming } = req.query;
  if (!ladderId) return res.status(400).json({ error: 'ladderId is required' });
  const filters = ['ch.ladder_id = ?'];
  const params = [ladderId];
  if (status) {
    filters.push('ch.status = ?');
    params.push(status);
  }
  if (upcoming === '1' || upcoming === 'true') {
    filters.push("ch.scheduled_at IS NOT NULL");
    filters.push("datetime(ch.scheduled_at) > datetime('now')");
    filters.push("ch.status IN ('PENDING','ACCEPTED')");
  }
  const order = (upcoming === '1' || upcoming === 'true') ? 'ch.scheduled_at ASC' : 'ch.created_at DESC';
  const rows = db.prepare(`
    SELECT ch.*, cu.display_name as challenger_name, tu.display_name as challenged_name
    FROM challenges ch
    JOIN users cu ON cu.id = ch.challenger_user_id
    JOIN users tu ON tu.id = ch.challenged_user_id
    WHERE ${filters.join(' AND ')}
    ORDER BY ${order}
  `).all(...params);
  res.json(rows);
});

// Report match result and update rankings
router.post('/:challengeId/report', requireAuth, (req, res) => {
  const db = req.db;
  const { winnerUserId } = req.body;
  const challengeId = req.params.challengeId;
  const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
  if (!ch) return res.status(404).json({ error: 'Challenge not found' });
  if (ch.status !== 'PENDING' && ch.status !== 'ACCEPTED') return res.status(400).json({ error: 'Challenge not active' });

  if (winnerUserId !== ch.challenger_user_id && winnerUserId !== ch.challenged_user_id) {
    return res.status(400).json({ error: 'Winner must be one of the participants' });
  }

  const loserUserId = winnerUserId === ch.challenger_user_id ? ch.challenged_user_id : ch.challenger_user_id;

  const winner = db.prepare('SELECT * FROM ladder_members WHERE ladder_id = ? AND user_id = ?').get(ch.ladder_id, winnerUserId);
  const loser = db.prepare('SELECT * FROM ladder_members WHERE ladder_id = ? AND user_id = ?').get(ch.ladder_id, loserUserId);
  if (!winner || !loser) return res.status(400).json({ error: 'Participants must be members' });

  // If lower ranked winner beats higher ranked loser, swap ranks
  if (winner.rank > loser.rank) {
    const tmpRank = winner.rank;
    db.prepare('UPDATE ladder_members SET rank = ? WHERE ladder_id = ? AND user_id = ?').run(loser.rank, ch.ladder_id, winnerUserId);
    db.prepare('UPDATE ladder_members SET rank = ? WHERE ladder_id = ? AND user_id = ?').run(tmpRank, ch.ladder_id, loserUserId);
  }

  const scoresJson = JSON.stringify(req.body.scores || []);
  db.prepare('UPDATE challenges SET status = ?, reported_winner_user_id = ?, scores_json = ? WHERE id = ?')
    .run('COMPLETED', winnerUserId, scoresJson, challengeId);

  // Log match entry
  const matchId = uuidv4();
  db.prepare('INSERT INTO matches (id, challenge_id, ladder_id, p1_user_id, p2_user_id, scores_json, winner_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(matchId, challengeId, ch.ladder_id, ch.challenger_user_id, ch.challenged_user_id, scoresJson, winnerUserId, new Date().toISOString());

  res.json({ ok: true });
});

// Accept a challenge
router.post('/:challengeId/accept', requireAuth, (req, res) => {
  const db = req.db;
  const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.challengeId);
  if (!ch) return res.status(404).json({ error: 'Challenge not found' });
  if (ch.challenged_user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  if (ch.status !== 'PENDING') return res.status(400).json({ error: 'Challenge not pending' });
  db.prepare('UPDATE challenges SET status = ? WHERE id = ?').run('ACCEPTED', ch.id);
  db.prepare('UPDATE challenges SET accepted_at = ? WHERE id = ?').run(new Date().toISOString(), ch.id);
  res.json({ ok: true });
});

// Decline a challenge
router.post('/:challengeId/decline', requireAuth, (req, res) => {
  const db = req.db;
  const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.challengeId);
  if (!ch) return res.status(404).json({ error: 'Challenge not found' });
  if (ch.challenged_user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  if (ch.status !== 'PENDING') return res.status(400).json({ error: 'Challenge not pending' });
  db.prepare('UPDATE challenges SET status = ? WHERE id = ?').run('DECLINED', ch.id);
  res.json({ ok: true });
});

// Challenge chat messages
router.get('/:challengeId/messages', requireAuth, (req, res) => {
  const db = req.db;
  const challengeId = req.params.challengeId;
  const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
  if (!ch) return res.status(404).json({ error: 'Challenge not found' });
  const member = db.prepare('SELECT 1 FROM ladder_members WHERE ladder_id = ? AND user_id = ?').get(ch.ladder_id, req.user.userId);
  if (!member) return res.status(403).json({ error: 'Forbidden' });
  const isParticipant = ch.challenger_user_id === req.user.userId || ch.challenged_user_id === req.user.userId;
  const rows = db.prepare(`
    SELECT m.id, m.user_id, u.display_name, m.message, m.is_private, m.created_at
    FROM challenge_messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.challenge_id = ? AND (m.is_private = 0 OR ? = 1)
    ORDER BY m.created_at ASC
  `).all(challengeId, isParticipant ? 1 : 0);
  res.json(rows);
});

router.post('/:challengeId/messages', requireAuth, (req, res) => {
  const db = req.db;
  const challengeId = req.params.challengeId;
  const { message, isPrivate } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
  if (!ch) return res.status(404).json({ error: 'Challenge not found' });
  const member = db.prepare('SELECT 1 FROM ladder_members WHERE ladder_id = ? AND user_id = ?').get(ch.ladder_id, req.user.userId);
  if (!member) return res.status(403).json({ error: 'Forbidden' });
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO challenge_messages (id, challenge_id, user_id, message, is_private, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, challengeId, req.user.userId, message, isPrivate ? 1 : 0, createdAt);
  res.status(201).json({ id, challenge_id: challengeId, user_id: req.user.userId, message, is_private: isPrivate ? 1 : 0, created_at: createdAt });
});

export default router;


