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
    place TEXT NOT NULL,
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

module.exports = db;
