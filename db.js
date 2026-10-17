/**
 * db.js - SQLite database initialization and parameterized queries.
 * 
 * Uses Node's built-in `node:sqlite` (available in Node 22+) with optional
 * fallback to `better-sqlite3` if installed.
 * All queries are strictly parameterized to prevent SQL injection.
 */

const path = require('node:path');
const fs = require('node:fs');

let dbInstance = null;
let isNodeSqlite = true;

function createInMemoryDb() {
  const profiles = new Map();
  const checks = [];

  return {
    exec: () => {},
    close: () => { profiles.clear(); checks.length = 0; },
    prepare: (sql) => {
      const lower = sql.toLowerCase().trim();
      return {
        get: (param) => {
          if (lower.includes('from profiles where id = ?')) {
            return profiles.get(param) || null;
          }
          return null;
        },
        run: (...params) => {
          if (lower.startsWith('insert into profiles') || lower.includes('on conflict(id)')) {
            const [id, name, year, branch, degree, cgpa, skills, docs, links, availability_weeks, notes, updated_at] = params;
            profiles.set(id, { id, name, year, branch, degree, cgpa, skills, docs, links, availability_weeks, notes, updated_at });
          } else if (lower.startsWith('delete from profiles')) {
            profiles.delete(params[0]);
          } else if (lower.startsWith('insert into opportunity_checks')) {
            const [id, title, opportunity_type, deadline, input_text, requirements, score_floor, score_ceiling, verdict, created_at] = params;
            checks.unshift({ id, title, opportunity_type, deadline, input_text, requirements, score_floor, score_ceiling, verdict, created_at });
          }
          return { changes: 1 };
        },
        all: (limit = 20) => {
          if (lower.includes('from opportunity_checks')) {
            return checks.slice(0, Number(limit) || 20);
          }
          return [];
        }
      };
    }
  };
}

/**
 * Initializes the database connection and creates required tables.
 * @param {string} [customPath] - Path to SQLite database file.
 */
function initDb(customPath) {
  if (dbInstance) {
    return dbInstance;
  }

  const defaultDbPath = process.env.VERCEL 
    ? path.join('/tmp', 'opportunitykit.db')
    : path.join(__dirname, 'opportunitykit.db');
  const dbPath = customPath || process.env.DB_PATH || defaultDbPath;

  // Attempt to use better-sqlite3 first if available, else built-in node:sqlite, else in-memory fallback
  try {
    const BetterSqlite = require('better-sqlite3');
    dbInstance = new BetterSqlite(dbPath);
    isNodeSqlite = false;
  } catch (err) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      dbInstance = new DatabaseSync(dbPath);
      isNodeSqlite = true;
    } catch (sqliteErr) {
      // In-memory fallback if native SQLite is unavailable in serverless environment
      dbInstance = createInMemoryDb();
      isNodeSqlite = false;
    }
  }

  // Create tables with parameterized DDL
  try {
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT,
        year INTEGER,
        branch TEXT,
        degree TEXT,
        cgpa REAL,
        skills TEXT,
        docs TEXT,
        links TEXT,
        availability_weeks INTEGER,
        notes TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS opportunity_checks (
        id TEXT PRIMARY KEY,
        title TEXT,
        opportunity_type TEXT,
        deadline TEXT,
        input_text TEXT,
        requirements TEXT,
        score_floor INTEGER,
        score_ceiling INTEGER,
        verdict TEXT,
        created_at TEXT
      );
    `);
  } catch (e) {
    // If DDL fails (e.g. read-only file system on serverless), fallback to in-memory
    dbInstance = createInMemoryDb();
  }

  return dbInstance;
}

/**
 * Retrieves the saved student profile.
 * @param {string} [userId='demo_user']
 * @returns {object|null}
 */
function getProfile(userId = 'demo_user') {
  const db = initDb();
  const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
  const row = stmt.get(userId);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name || '',
    year: row.year !== null ? Number(row.year) : null,
    branch: row.branch || '',
    degree: row.degree || '',
    cgpa: row.cgpa !== null ? Number(row.cgpa) : null,
    skills: row.skills ? JSON.parse(row.skills) : [],
    docs: row.docs ? JSON.parse(row.docs) : {},
    links: row.links ? JSON.parse(row.links) : {},
    availabilityWeeks: row.availability_weeks !== null ? Number(row.availability_weeks) : null,
    notes: row.notes || '',
    updatedAt: row.updated_at
  };
}

/**
 * Upserts the student profile using parameterized queries.
 * @param {object} profileData
 * @param {string} [userId='demo_user']
 * @returns {object}
 */
function saveProfile(profileData, userId = 'demo_user') {
  const db = initDb();
  const now = new Date().toISOString();

  const skillsJson = JSON.stringify(Array.isArray(profileData.skills) ? profileData.skills : []);
  const docsJson = JSON.stringify(profileData.docs && typeof profileData.docs === 'object' ? profileData.docs : {});
  const linksJson = JSON.stringify(profileData.links && typeof profileData.links === 'object' ? profileData.links : {});

  const stmt = db.prepare(`
    INSERT INTO profiles (id, name, year, branch, degree, cgpa, skills, docs, links, availability_weeks, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      year = excluded.year,
      branch = excluded.branch,
      degree = excluded.degree,
      cgpa = excluded.cgpa,
      skills = excluded.skills,
      docs = excluded.docs,
      links = excluded.links,
      availability_weeks = excluded.availability_weeks,
      notes = excluded.notes,
      updated_at = excluded.updated_at;
  `);

  stmt.run(
    userId,
    profileData.name || '',
    profileData.year !== undefined && profileData.year !== null && profileData.year !== '' ? Number(profileData.year) : null,
    profileData.branch || '',
    profileData.degree || '',
    profileData.cgpa !== undefined && profileData.cgpa !== null && profileData.cgpa !== '' ? Number(profileData.cgpa) : null,
    skillsJson,
    docsJson,
    linksJson,
    profileData.availabilityWeeks !== undefined && profileData.availabilityWeeks !== null && profileData.availabilityWeeks !== '' ? Number(profileData.availabilityWeeks) : null,
    profileData.notes || '',
    now
  );

  return getProfile(userId);
}

/**
 * Deletes the student profile and clears all associated personal data.
 * @param {string} [userId='demo_user']
 * @returns {boolean}
 */
function deleteProfile(userId = 'demo_user') {
  const db = initDb();
  const stmt = db.prepare('DELETE FROM profiles WHERE id = ?');
  stmt.run(userId);
  return true;
}

/**
 * Saves a recent opportunity check into history.
 * @param {object} check
 */
function saveCheck(check) {
  const db = initDb();
  const id = check.id || `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO opportunity_checks (id, title, opportunity_type, deadline, input_text, requirements, score_floor, score_ceiling, verdict, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    check.title || 'Untitled Opportunity',
    check.opportunityType || 'internship',
    check.deadline || null,
    check.inputText || '',
    JSON.stringify(check.requirements || []),
    check.scoreFloor || 0,
    check.scoreCeiling || 0,
    check.verdict || 'not-ready',
    now
  );

  return { id, createdAt: now };
}

/**
 * Returns recent opportunity checks.
 * @param {number} [limit=20]
 * @returns {Array}
 */
function getChecks(limit = 20) {
  const db = initDb();
  const stmt = db.prepare('SELECT * FROM opportunity_checks ORDER BY created_at DESC LIMIT ?');
  const rows = stmt.all(limit);

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    opportunityType: r.opportunity_type,
    deadline: r.deadline,
    inputText: r.input_text,
    requirements: r.requirements ? JSON.parse(r.requirements) : [],
    scoreFloor: r.score_floor,
    scoreCeiling: r.score_ceiling,
    verdict: r.verdict,
    createdAt: r.created_at
  }));
}

/**
 * Closes the database connection.
 */
function closeDb() {
  if (dbInstance) {
    if (typeof dbInstance.close === 'function') {
      dbInstance.close();
    }
    dbInstance = null;
  }
}

module.exports = {
  initDb,
  getProfile,
  saveProfile,
  deleteProfile,
  saveCheck,
  getChecks,
  closeDb
};
