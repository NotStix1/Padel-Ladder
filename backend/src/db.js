import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'padel.db');

let SQL;
let db;
let wrapper;

export async function initDb() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Try multiple locations so it works both with and without npm workspaces hoisting
  const candidateDirs = [
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist'),
    path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist'),
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist')
  ];
  const wasmDir = candidateDirs.find((d) => fs.existsSync(path.join(d, 'sql-wasm.wasm'))) || candidateDirs[0];
  SQL = await initSqlJs({ locateFile: (file) => path.join(wasmDir, file) });

  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(filebuffer));
  } else {
    db = new SQL.Database();
    persist();
  }

  wrapper = createWrapper(db);
  await migrate();
}

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function createWrapper(database) {
  return {
    exec(sqlText) {
      database.exec(sqlText);
      persist();
    },
    prepare(sqlText) {
      const stmt = database.prepare(sqlText);
      return {
        get: (...params) => {
          if (params && params.length) stmt.bind(params);
          const has = stmt.step();
          const obj = has ? stmt.getAsObject() : undefined;
          stmt.free();
          return obj;
        },
        all: (...params) => {
          if (params && params.length) stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        run: (...params) => {
          if (params && params.length) stmt.bind(params);
          while (stmt.step()) {}
          stmt.free();
          persist();
          return { changes: undefined };
        }
      };
    }
  };
}

export function getDb() {
  if (!wrapper) throw new Error('DB not initialized. Call initDb() first.');
  return wrapper;
}

async function migrate() {
  if (!wrapper) await initDb();
  const dbw = getDb();
  dbw.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      hours TEXT,
      rules TEXT,
      contact TEXT,
      images_json TEXT,
      owner_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(owner_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ladders (
      id TEXT PRIMARY KEY,
      court_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      rules_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(court_id) REFERENCES courts(id)
    );

    CREATE TABLE IF NOT EXISTS ladder_members (
      ladder_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      joined_at TEXT NOT NULL,
      division TEXT,
      position INTEGER,
      PRIMARY KEY(ladder_id, user_id),
      FOREIGN KEY(ladder_id) REFERENCES ladders(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      ladder_id TEXT NOT NULL,
      challenger_user_id TEXT NOT NULL,
      challenged_user_id TEXT NOT NULL,
      challenger_team_id TEXT,
      challenged_team_id TEXT,
      status TEXT NOT NULL,
      scheduled_at TEXT,
      accepted_at TEXT,
      expires_at TEXT,
      scores_json TEXT,
      reported_winner_user_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(ladder_id) REFERENCES ladders(id),
      FOREIGN KEY(challenger_user_id) REFERENCES users(id),
      FOREIGN KEY(challenged_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ladder_divisions (
      id TEXT PRIMARY KEY,
      ladder_id TEXT NOT NULL,
      code TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      UNIQUE(ladder_id, code),
      FOREIGN KEY(ladder_id) REFERENCES ladders(id)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      ladder_id TEXT NOT NULL,
      player1_user_id TEXT NOT NULL,
      player2_user_id TEXT NOT NULL,
      division TEXT,
      position INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE(ladder_id, player1_user_id, player2_user_id),
      FOREIGN KEY(ladder_id) REFERENCES ladders(id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      challenge_id TEXT,
      ladder_id TEXT NOT NULL,
      p1_user_id TEXT NOT NULL,
      p2_user_id TEXT NOT NULL,
      scores_json TEXT NOT NULL,
      winner_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(ladder_id) REFERENCES ladders(id)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      ladder_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating REAL NOT NULL,
      rd REAL,
      vol REAL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(ladder_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      court_id TEXT NOT NULL,
      name TEXT NOT NULL,
      starts_at TEXT,
      ends_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(court_id) REFERENCES courts(id)
    );
  `);

  // Ensure optional columns exist
  try {
    const cols = dbw.prepare('PRAGMA table_info(users)').all();
    const hasCell = cols.some(c => c.name === 'cellphone');
    const hasBio = cols.some(c => c.name === 'bio');
    const hasAvatar = cols.some(c => c.name === 'avatar_url');
    if (!hasCell) {
      dbw.exec('ALTER TABLE users ADD COLUMN cellphone TEXT');
    }
    if (!hasBio) {
      dbw.exec('ALTER TABLE users ADD COLUMN bio TEXT');
    }
    if (!hasAvatar) {
      dbw.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
    }
  } catch (_) {
    // ignore
  }

  try {
    const ccols = dbw.prepare('PRAGMA table_info(challenges)').all();
    const addIfMissing = (name, ddl) => { if (!ccols.some(c => c.name === name)) dbw.exec(ddl); };
    addIfMissing('accepted_at', 'ALTER TABLE challenges ADD COLUMN accepted_at TEXT');
    addIfMissing('expires_at', 'ALTER TABLE challenges ADD COLUMN expires_at TEXT');
    addIfMissing('scores_json', 'ALTER TABLE challenges ADD COLUMN scores_json TEXT');
  } catch (_) {}

  try {
    const lmcols = dbw.prepare('PRAGMA table_info(ladder_members)').all();
    if (!lmcols.some(c => c.name === 'division')) dbw.exec('ALTER TABLE ladder_members ADD COLUMN division TEXT');
    if (!lmcols.some(c => c.name === 'position')) dbw.exec('ALTER TABLE ladder_members ADD COLUMN position INTEGER');
  } catch (_) {}

  // Ensure new court columns
  try {
    const ccols = dbw.prepare('PRAGMA table_info(courts)').all();
    const need = (n) => !ccols.some(c => c.name === n);
    if (need('hours')) dbw.exec('ALTER TABLE courts ADD COLUMN hours TEXT');
    if (need('rules')) dbw.exec('ALTER TABLE courts ADD COLUMN rules TEXT');
    if (need('contact')) dbw.exec('ALTER TABLE courts ADD COLUMN contact TEXT');
    if (need('images_json')) dbw.exec('ALTER TABLE courts ADD COLUMN images_json TEXT');
  } catch (_) {}
}

if (process.argv.includes('--migrate')) {
  (async () => {
    await migrate();
    // eslint-disable-next-line no-console
    console.log('Database migrated at', DB_PATH);
  })();
}

export default { getDb, initDb };


