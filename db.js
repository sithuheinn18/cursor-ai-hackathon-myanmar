const path = require("path");

const dbPath = path.join(__dirname, "database.sqlite");

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const INSERT_SQL = "INSERT INTO reports (area, status) VALUES (?, ?)";

const LATEST_BY_AREA_SQL = `
  SELECT id, area, status, timestamp
  FROM reports
  WHERE id IN (
    SELECT MAX(id) FROM reports GROUP BY area
  )
  ORDER BY area COLLATE NOCASE
`;

function createSqlite3Store(sqlite3) {
  const db = new sqlite3.Database(dbPath);

  return {
    initDatabase() {
      return new Promise((resolve, reject) => {
        db.run(CREATE_TABLE_SQL, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },
    insertReport(area, status) {
      return new Promise((resolve, reject) => {
        db.run(INSERT_SQL, [area, status], function onInsert(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ id: this.lastID, area, status });
        });
      });
    },
    getLatestStatusByArea() {
      return new Promise((resolve, reject) => {
        db.all(LATEST_BY_AREA_SQL, [], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        });
      });
    },
  };
}

function createBuiltinStore() {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(dbPath);

  return {
    initDatabase() {
      db.exec(CREATE_TABLE_SQL);
      return Promise.resolve();
    },
    insertReport(area, status) {
      const result = db.prepare(INSERT_SQL).run(area, status);
      return Promise.resolve({ id: Number(result.lastInsertRowid), area, status });
    },
    getLatestStatusByArea() {
      const rows = db.prepare(LATEST_BY_AREA_SQL).all();
      return Promise.resolve(rows);
    },
  };
}

function loadStore() {
  try {
    const sqlite3 = require("sqlite3").verbose();
    return createSqlite3Store(sqlite3);
  } catch (err) {
    console.warn(
      "sqlite3 native addon not available (" +
        err.message +
        "). Using Node.js built-in SQLite instead."
    );
    return createBuiltinStore();
  }
}

const store = loadStore();

module.exports = {
  initDatabase: () => store.initDatabase(),
  insertReport: (area, status) => store.insertReport(area, status),
  getLatestStatusByArea: () => store.getLatestStatusByArea(),
};
