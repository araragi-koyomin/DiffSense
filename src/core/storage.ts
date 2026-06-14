import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
/**
 * Because sql.js exports Database as a runtime property on the
 * initialised module (not a named export), we capture the
 * constructor type from the resolved module.
 */
type SqlJsModule = Awaited<ReturnType<typeof initSqlJs>>;
type SqlJsDatabase = InstanceType<SqlJsModule['Database']>;

const instances = new Map<string, SqlJsDatabase>();

const DDL = `
CREATE TABLE IF NOT EXISTS commits (
    repo_path TEXT NOT NULL, commit_hash TEXT NOT NULL,
    author TEXT, date TEXT, message TEXT, generated_at TEXT,
    PRIMARY KEY (commit_hash, repo_path)
);
CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_hash TEXT NOT NULL, repo_path TEXT NOT NULL,
    summary TEXT NOT NULL, intent TEXT, scope TEXT, risk TEXT,
    truncated INTEGER DEFAULT 0, model TEXT, tokens_used INTEGER,
    created_at TEXT,
    FOREIGN KEY (commit_hash, repo_path) REFERENCES commits(commit_hash, repo_path)
);
CREATE TABLE IF NOT EXISTS hook_state (
    repo_path TEXT PRIMARY KEY, installed_at TEXT, backup_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_summaries_repo_date ON summaries(repo_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commits_repo_date ON commits(repo_path, date DESC);
`;

async function getSql(): Promise<SqlJsModule> {
  if (!SQL) SQL = await initSqlJs();
  return SQL;
}

function saveDb(dbPath: string, db: SqlJsDatabase): void {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

export async function initDatabase(dbPath: string): Promise<void> {
  if (instances.has(dbPath)) return;
  const sql = await getSql();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let db: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    db = new sql.Database(fs.readFileSync(dbPath));
  } else {
    db = new sql.Database();
  }

  const stmts = DDL.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const s of stmts) {
    db.run(s + ';');
  }
  saveDb(dbPath, db);
  instances.set(dbPath, db);
}

export function getDatabase(dbPath: string): SqlJsDatabase {
  const db = instances.get(dbPath);
  if (!db) throw new Error(`数据库未初始化: ${dbPath}。请先调用 initDatabase()`);
  return db;
}

export function closeDatabase(dbPath: string): void {
  const db = instances.get(dbPath);
  if (db) { db.close(); instances.delete(dbPath); }
}

export function closeAllDatabases(): void {
  for (const [, db] of instances) db.close();
  instances.clear();
}
