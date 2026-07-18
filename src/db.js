const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS postings (
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
  )
`);

// 이전 스키마(place NOT NULL, departure/destination 없음)로 이미 생성된 DB를 위한 마이그레이션
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

module.exports = db;
