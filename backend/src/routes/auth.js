import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getAuth, isFirebaseEnabled } from '../firebase.js';

const router = Router();
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';

function normalizeE164(input) {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, '');
  if (!digits) return null;
  const normalized = `+${digits}`;
  if (normalized.length < 8 || normalized.length > 16) return null;
  return normalized;
}

router.post('/register', (req, res) => {
  const db = req.db;
  const { email, password, firstName, lastName, cellphone } = req.body;
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const userExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (userExists) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = uuidv4();
  const createdAt = new Date().toISOString();
  const displayName = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();
  const phone = normalizeE164(cellphone);
  db.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, created_at, cellphone) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, email, passwordHash, displayName, createdAt, phone);

  const token = jwt.sign({ userId, email }, jwtSecret, { expiresIn: '7d' });
  res.json({ token, user: { id: userId, email, displayName } });
});

router.post('/login', (req, res) => {
  const db = req.db;
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
});

// Login via Firebase ID token
router.post('/firebase', async (req, res) => {
  const db = req.db;
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });
  if (!isFirebaseEnabled()) return res.status(503).json({ error: 'Firebase not configured' });
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const email = decoded.email || `${decoded.uid}@firebase.local`;
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.uid);
    if (!user) {
      // Upsert user with Firebase UID as id
      const createdAt = new Date().toISOString();
      const displayName = decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Player');
      db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(decoded.uid, email, '', displayName, createdAt);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.uid);
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (e) {
    res.status(401).json({ error: 'Invalid Firebase token' });
  }
});

export default router;


