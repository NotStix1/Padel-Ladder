import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// List ladders by court or all
router.get('/', (req, res) => {
  const db = req.db;
  const { courtId } = req.query;
  let rows;
  if (courtId) {
    rows = db.prepare('SELECT * FROM ladders WHERE court_id = ? ORDER BY created_at DESC').all(courtId);
  } else {
    rows = db.prepare('SELECT * FROM ladders ORDER BY created_at DESC').all();
  }
  res.json(rows);
});

// Get ladder details
router.get('/:ladderId', (req, res) => {
  const db = req.db;
  const ladder = db.prepare('SELECT * FROM ladders WHERE id = ?').get(req.params.ladderId);
  if (!ladder) return res.status(404).json({ error: 'Ladder not found' });
  try {
    ladder.rules = JSON.parse(ladder.rules_json || '{}');
  } catch {
    ladder.rules = {};
  }
  delete ladder.rules_json;
  res.json(ladder);
});

// Create ladder (only court owner)
router.post('/', requireAuth, (req, res) => {
  const db = req.db;
  const { courtId, name, description, rules } = req.body;
  if (!courtId || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(courtId);
  if (!court) return res.status(404).json({ error: 'Court not found' });
  if (court.owner_user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const defaultRules = {
    challengeWindowDays: 7,
    maxOutstandingChallenges: 1,
    maxChallengeDistance: 3,
    rankingModel: 'swap',
    elo: { k: 32 },
    format: 'singles', // or 'doubles'
    divisions: [
      { code: 'A', capacity: 8 },
      { code: 'B', capacity: 8 },
      { code: 'C', capacity: 8 }
    ]
  };
  const rulesJson = JSON.stringify({ ...defaultRules, ...(rules || {}) });
  db.prepare('INSERT INTO ladders (id, court_id, name, description, rules_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, courtId, name, description || null, rulesJson, createdAt);
  res.status(201).json({ id, court_id: courtId, name, description, rules: JSON.parse(rulesJson), created_at: createdAt });
});

// Join ladder
router.post('/:ladderId/join', requireAuth, (req, res) => {
  const db = req.db;
  const ladderId = req.params.ladderId;
  const ladder = db.prepare('SELECT * FROM ladders WHERE id = ?').get(ladderId);
  if (!ladder) return res.status(404).json({ error: 'Ladder not found' });

  const already = db.prepare('SELECT * FROM ladder_members WHERE ladder_id = ? AND user_id = ?').get(ladderId, req.user.userId);
  if (already) return res.status(409).json({ error: 'Already a member' });

  const lowest = db.prepare('SELECT MAX(rank) as maxRank FROM ladder_members WHERE ladder_id = ?').get(ladderId);
  const newRank = (lowest?.maxRank || 0) + 1;
  const joinedAt = new Date().toISOString();
  // assign division based on rules
  let division = null, position = null;
  try {
    const rules = JSON.parse(ladder.rules_json || '{}');
    const divisions = (rules.divisions || []).sort((a,b)=>a.code.localeCompare(b.code));
    for (const d of divisions) {
      const count = db.prepare('SELECT COUNT(1) as c FROM ladder_members WHERE ladder_id = ? AND division = ?').get(ladderId, d.code)?.c || 0;
      if (count < (d.capacity || 0)) { division = d.code; position = count + 1; break; }
    }
  } catch (_) {}
  db.prepare('INSERT INTO ladder_members (ladder_id, user_id, rank, joined_at, division, position) VALUES (?, ?, ?, ?, ?, ?)')
    .run(ladderId, req.user.userId, newRank, joinedAt, division, position);

  // Initialize ratings for Elo model
  try {
    const rules = JSON.parse(ladder.rules_json || '{}');
    if (rules.rankingModel === 'elo') {
      db.prepare('INSERT OR REPLACE INTO ratings (ladder_id, user_id, rating, rd, vol, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(ladderId, req.user.userId, 1200, null, null, new Date().toISOString());
    }
  } catch (_) {}
  res.status(201).json({ ladder_id: ladderId, user_id: req.user.userId, rank: newRank, joined_at: joinedAt });
});

// Get ladder standings
router.get('/:ladderId/standings', (req, res) => {
  const db = req.db;
  const ladderId = req.params.ladderId;
  const ladder = db.prepare('SELECT * FROM ladders WHERE id = ?').get(ladderId);
  let rows;
  try {
    const rules = ladder ? JSON.parse(ladder.rules_json || '{}') : {};
    if (rules.rankingModel === 'elo') {
      rows = db.prepare(`
        SELECT m.user_id, u.display_name, COALESCE(r.rating, 1200) as rating, m.joined_at, m.division, m.position
        FROM ladder_members m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN ratings r ON r.ladder_id = m.ladder_id AND r.user_id = m.user_id
        WHERE m.ladder_id = ?
        ORDER BY CASE WHEN m.division IS NULL THEN 1 ELSE 0 END, m.division ASC, (CASE WHEN m.position IS NULL THEN 9999 ELSE m.position END) ASC, rating DESC
      `).all(ladderId);
    } else {
      rows = db.prepare(`
        SELECT m.user_id, u.display_name, m.rank, m.joined_at, m.division, m.position
        FROM ladder_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.ladder_id = ?
        ORDER BY CASE WHEN m.division IS NULL THEN 1 ELSE 0 END, m.division ASC, (CASE WHEN m.position IS NULL THEN 9999 ELSE m.position END) ASC, m.rank ASC
      `).all(ladderId);
    }
  } catch {
    rows = db.prepare(`
      SELECT m.user_id, u.display_name, m.rank, m.joined_at, m.division, m.position
      FROM ladder_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.ladder_id = ?
      ORDER BY m.rank ASC
    `).all(ladderId);
  }
  res.json(rows);
});

// Set divisions (owner only)
router.put('/:ladderId/divisions', requireAuth, (req, res) => {
  const db = req.db;
  const ladderId = req.params.ladderId;
  const ladder = db.prepare('SELECT * FROM ladders WHERE id = ?').get(ladderId);
  if (!ladder) return res.status(404).json({ error: 'Ladder not found' });
  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(ladder.court_id);
  if (!court || court.owner_user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  const divisions = Array.isArray(req.body?.divisions) ? req.body.divisions : [];
  // Update rules_json divisions
  const rules = { ...(JSON.parse(ladder.rules_json || '{}')), divisions };
  db.prepare('UPDATE ladders SET rules_json = ? WHERE id = ?').run(JSON.stringify(rules), ladderId);
  // Ensure ladder_divisions rows exist
  db.prepare('DELETE FROM ladder_divisions WHERE ladder_id = ?').run(ladderId);
  let order = 0;
  for (const d of divisions) {
    db.prepare('INSERT INTO ladder_divisions (id, ladder_id, code, capacity, order_index) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), ladderId, d.code, d.capacity || 8, order++);
  }
  res.json({ id: ladderId, divisions });
});

// Update ladder rules (owner only)
router.put('/:ladderId/rules', requireAuth, (req, res) => {
  const db = req.db;
  const ladderId = req.params.ladderId;
  const ladder = db.prepare('SELECT * FROM ladders WHERE id = ?').get(ladderId);
  if (!ladder) return res.status(404).json({ error: 'Ladder not found' });
  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(ladder.court_id);
  if (!court || court.owner_user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  const next = JSON.stringify({ ...(JSON.parse(ladder.rules_json || '{}')), ...(req.body || {}) });
  db.prepare('UPDATE ladders SET rules_json = ? WHERE id = ?').run(next, ladderId);
  res.json({ id: ladderId, rules: JSON.parse(next) });
});

export default router;


