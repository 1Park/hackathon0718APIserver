const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS postings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT,
    description TEXT,
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    place TEXT,
    departure TEXT,
    destination TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    min_people INTEGER NOT NULL,
    max_people INTEGER NOT NULL,
    current_people INTEGER NOT NULL DEFAULT 0,
    needs_nego INTEGER NOT NULL DEFAULT 0,
    price REAL NOT NULL,
    agent_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'recruiting',
    completion_reason TEXT,
    completion_source TEXT,
    completion_note TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS posting_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    posting_id INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(posting_id, agent_id),
    FOREIGN KEY(posting_id) REFERENCES postings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    posting_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, posting_id, type),
    FOREIGN KEY(posting_id) REFERENCES postings(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_participants_agent
    ON posting_participants(agent_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_agent
    ON agent_notifications(agent_id, id);
`);

// Migrate databases created with the previous schema (place NOT NULL and no departure/destination).
const existingColumns = db.prepare('PRAGMA table_info(postings)').all().map((c) => c.name);
if (!existingColumns.includes('departure')) {
  db.exec(`
    CREATE TABLE postings_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      country TEXT NOT NULL,
      city TEXT NOT NULL,
      place TEXT,
      departure TEXT,
      destination TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      min_people INTEGER NOT NULL,
      max_people INTEGER NOT NULL,
      current_people INTEGER NOT NULL DEFAULT 0,
      needs_nego INTEGER NOT NULL DEFAULT 0,
      price REAL NOT NULL,
      agent_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO postings_new (id, type, country, city, place, date, time, min_people, max_people, current_people, needs_nego, price, agent_id, created_at)
      SELECT id, type, country, city, place, date, time, min_people, max_people, current_people, needs_nego, price, agent_id, created_at FROM postings;
    DROP TABLE postings;
    ALTER TABLE postings_new RENAME TO postings;
  `);
}

const currentColumns = db.prepare('PRAGMA table_info(postings)').all().map((c) => c.name);
if (!currentColumns.includes('title')) {
  db.exec('ALTER TABLE postings ADD COLUMN title TEXT');
}
if (!currentColumns.includes('description')) {
  db.exec('ALTER TABLE postings ADD COLUMN description TEXT');
}
if (!currentColumns.includes('status')) {
  db.exec("ALTER TABLE postings ADD COLUMN status TEXT NOT NULL DEFAULT 'recruiting'");
}
if (!currentColumns.includes('completion_reason')) {
  db.exec('ALTER TABLE postings ADD COLUMN completion_reason TEXT');
}
if (!currentColumns.includes('completion_source')) {
  db.exec('ALTER TABLE postings ADD COLUMN completion_source TEXT');
}
if (!currentColumns.includes('completion_note')) {
  db.exec('ALTER TABLE postings ADD COLUMN completion_note TEXT');
}
if (!currentColumns.includes('completed_at')) {
  db.exec('ALTER TABLE postings ADD COLUMN completed_at TEXT');
}

db.prepare(`
  UPDATE postings
  SET status = 'formed',
      completion_reason = COALESCE(completion_reason, 'minimum_reached'),
      completed_at = COALESCE(completed_at, created_at)
  WHERE status = 'recruiting' AND current_people >= min_people
`).run();

module.exports = db;
