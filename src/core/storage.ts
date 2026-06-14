import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { StoredCommit, StoredSummary, HookState } from './types';

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

function saveDbInternal(dbPath: string): void {
  const db = instances.get(dbPath);
  if (db) fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function queryAll<T>(db: SqlJsDatabase, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
  stmt.free();
  return rows;
}

function queryOne<T>(db: SqlJsDatabase, sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// ---- Commit CRUD ----
export function upsertCommit(dbPath: string, c: StoredCommit): void {
  const db = getDatabase(dbPath);
  db.run('INSERT OR REPLACE INTO commits (repo_path,commit_hash,author,date,message,generated_at) VALUES (?,?,?,?,?,?)',
    [c.repo_path, c.commit_hash, c.author, c.date, c.message, c.generated_at]);
  saveDbInternal(dbPath);
}

export function getCommit(dbPath: string, repo: string, hash: string): StoredCommit | null {
  return queryOne<StoredCommit>(getDatabase(dbPath), 'SELECT * FROM commits WHERE repo_path=? AND commit_hash=?', [repo, hash]);
}

export function deleteCommit(dbPath: string, repo: string, hash: string): void {
  const db = getDatabase(dbPath);
  db.run('DELETE FROM summaries WHERE repo_path=? AND commit_hash=?', [repo, hash]);
  db.run('DELETE FROM commits WHERE repo_path=? AND commit_hash=?', [repo, hash]);
  saveDbInternal(dbPath);
}

// ---- Summary CRUD ----
export function upsertSummary(dbPath: string, s: Omit<StoredSummary, 'id' | 'created_at'>): void {
  const db = getDatabase(dbPath);
  db.run('DELETE FROM summaries WHERE commit_hash=? AND repo_path=?', [s.commit_hash, s.repo_path]);
  db.run('INSERT INTO summaries (commit_hash,repo_path,summary,intent,scope,risk,truncated,model,tokens_used,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [s.commit_hash, s.repo_path, s.summary, s.intent, s.scope, s.risk, s.truncated, s.model, s.tokens_used, new Date().toISOString()]);
  saveDbInternal(dbPath);
}

export function getSummaryByHash(dbPath: string, repo: string, hash: string): StoredSummary | null {
  return queryOne<StoredSummary>(getDatabase(dbPath), 'SELECT * FROM summaries WHERE repo_path=? AND commit_hash=?', [repo, hash]);
}

export function getSummariesByRepo(dbPath: string, repo: string, limit: number, offset: number, search?: string): StoredSummary[] {
  const db = getDatabase(dbPath);
  let sql = 'SELECT s.* FROM summaries s JOIN commits c ON s.commit_hash=c.commit_hash AND s.repo_path=c.repo_path WHERE s.repo_path=?';
  const params: any[] = [repo];
  if (search) { sql += ' AND (s.summary LIKE ? OR c.message LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  sql += ' ORDER BY c.date DESC LIMIT ? OFFSET ?'; params.push(limit, offset);
  return queryAll<StoredSummary>(db, sql, params);
}

export function getStats(dbPath: string, repo: string): {
  totalCommits: number; modelDistribution: Record<string, number>;
  monthlyCounts: { month: string; count: number }[]; totalTokensUsed: number;
} {
  const db = getDatabase(dbPath);
  const cnt = queryOne<{ c: number }>(db, 'SELECT COUNT(*) as c FROM summaries WHERE repo_path=?', [repo]);
  const models = queryAll<{ model: string; c: number }>(db, 'SELECT model, COUNT(*) as c FROM summaries WHERE repo_path=? GROUP BY model', [repo]);
  const months = queryAll<{ month: string; count: number }>(db, "SELECT substr(c.date,1,7) as month, COUNT(*) as count FROM summaries s JOIN commits c ON s.commit_hash=c.commit_hash AND s.repo_path=c.repo_path WHERE s.repo_path=? GROUP BY month ORDER BY month ASC", [repo]);
  const tokens = queryOne<{ t: number }>(db, 'SELECT COALESCE(SUM(tokens_used),0) as t FROM summaries WHERE repo_path=?', [repo]);
  const md: Record<string, number> = {}; models.forEach(m => md[m.model] = m.c);
  return { totalCommits: cnt?.c || 0, modelDistribution: md, monthlyCounts: months, totalTokensUsed: tokens?.t || 0 };
}

// ---- Hook State ----
export function getHookState(dbPath: string, repo: string): HookState | null {
  return queryOne<HookState>(getDatabase(dbPath), 'SELECT * FROM hook_state WHERE repo_path=?', [repo]);
}

export function setHookState(dbPath: string, s: HookState): void {
  const db = getDatabase(dbPath);
  db.run('INSERT OR REPLACE INTO hook_state (repo_path,installed_at,backup_path) VALUES (?,?,?)', [s.repo_path, s.installed_at, s.backup_path]);
  saveDbInternal(dbPath);
}

export function removeHookState(dbPath: string, repo: string): void {
  getDatabase(dbPath).run('DELETE FROM hook_state WHERE repo_path=?', [repo]);
  saveDbInternal(dbPath);
}
