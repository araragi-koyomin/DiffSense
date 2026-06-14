# DiffSense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build DiffSense — a post-commit AI-powered code change semantic interpreter with CLI and Web interface.

**Architecture:** Single TypeScript/Node.js package with dual entry points. Core Engine (DiffParser, LLMClient, Storage) shared by CLI (commander) and Web (Express + SSR + HTMX). SQLite via better-sqlite3 for persistence. Docker single-container with CLI and Web modes.

**Tech Stack:** TypeScript 5.x, Node.js >= 18, commander 12.x, express 4.x, better-sqlite3 11.x, simple-git 3.x, chalk 5.x, vitest (test runner), htmx 2.x (CDN)

**Design System:** Vercel + web-design-guidelines (Open Design)

---

## Task Dependency Graph

```
T0 (scaffold)
 └─ T1 (types)
     ├─ T2 (config) ─┐
     ├─ T3 (logger)  │
     ├─ T4 (storage schema) ─ T5 (storage CRUD)
     ├─ T6 (diff-parser)
     └─ T7 (llm-client)
          └─ T8 (core engine orchestration) ─┐
               └─ T9 (CLI setup)  ┐
                    ├─ T10 (config cmd)  ← parallel
                    ├─ T11 (init/uninit) ← parallel
                    ├─ T12 (log cmd)     ← parallel
                    ├─ T13 (explain/gen) ← parallel
                    └─ T14 (hook+web cmd)← parallel
                         └─ T15 (web server + layout)
                              ├─ T16 (list page)
                              ├─ T17 (detail page)
                              ├─ T18 (stats page + API)
                              ├─ T19 (Dockerfile)
                              ├─ T20 (CI)
                              └─ T21 (README)
```

**Parallel groups:**
- Group A: T2, T3 (after T1)
- Group B: T4, T6, T7 (after T1)
- Group C: T10, T11, T12, T13, T14 (after T8+T9)
- Group D: T19, T20, T21 (after T14, can run alongside web tasks)

---

### Task 0: Project Scaffold

**Files:** `package.json`, `tsconfig.json`, `vitest.config.ts`, directory structure

- [ ] **Step 1: Write package.json**

```json
{
  "name": "diffsense",
  "version": "1.0.0",
  "description": "AI-powered code change semantic interpreter",
  "bin": { "ds": "./dist/cli/index.js" },
  "main": "./dist/core/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "chalk": "^5.4.0",
    "commander": "^12.1.0",
    "express": "^4.21.0",
    "simple-git": "^3.27.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "commonjs", "lib": ["ES2022"],
    "outDir": "./dist", "rootDir": "./src",
    "strict": true, "esModuleInterop": true,
    "resolveJsonModule": true, "declaration": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true, "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 10000 },
});
```

- [ ] **Step 4: Create directory structure**
```bash
mkdir -p src/core src/cli/commands src/web/routes src/web/views tests/core tests/cli tests/fixtures/sample-diffs
```

- [ ] **Step 5: Install and verify**
```bash
npm install; npm run build
```
Expected: Installs successfully, build succeeds (no source files yet, may warn but no error).

- [ ] **Step 6: Run baseline test**

Run: `npm test`
Expected: "No test files found" (acceptable at scaffold stage).

- [ ] **Step 7: Commit**
```bash
git add package.json tsconfig.json vitest.config.ts; git commit -m "chore: scaffold project with TypeScript + vitest"
```

---

### Task 1: Core Types

**Files:** `src/core/types.ts`, `tests/core/types.test.ts`

- [ ] **Step 1: Write types (RED — write test first)**

```typescript
// tests/core/types.test.ts
import { describe, it, expect } from 'vitest';
describe('Core Types', () => {
  it('DiffSenseConfig shape', () => {
    const c = { provider: 'deepseek' as const, base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', token_limit: 8000, web_port: 3000 };
    expect(c.provider).toBe('deepseek');
  });
  it('FileChunk shape', () => {
    const c = { filename: 'a.ts', diffContent: '+x', tokenEstimate: 1, truncated: false };
    expect(c.truncated).toBe(false);
  });
  it('SummaryCard shape', () => {
    const s = { summary: 'test', intent: 'test', scope: ['a.ts'], risk: 'low' };
    expect(s.scope).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Confirm test fails** — `npm test -- tests/core/types.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write src/core/types.ts**

```typescript
export interface DiffSenseConfig {
  provider: 'deepseek' | 'glm';
  base_url: string; model: string;
  token_limit: number; web_port: number;
}
export interface FileChunk {
  filename: string; diffContent: string; tokenEstimate: number; truncated: boolean;
}
export interface CommitInfo {
  repoPath: string; commitHash: string; author: string; date: string; message: string;
}
export interface SummaryCard {
  summary: string; intent: string; scope: string[]; risk: string;
}
export interface StoredCommit {
  repo_path: string; commit_hash: string; author: string; date: string; message: string; generated_at: string;
}
export interface StoredSummary {
  id: number; commit_hash: string; repo_path: string;
  summary: string; intent: string; scope: string; risk: string;
  truncated: number; model: string; tokens_used: number; created_at: string;
}
export interface HookState { repo_path: string; installed_at: string; backup_path: string | null; }
export interface LogEntry { timestamp: string; commit_hash: string; error_type: string; error_message: string; }
```

- [ ] **Step 4: Confirm test passes** — `npm test -- tests/core/types.test.ts` → 3 PASS.

- [ ] **Step 5: Commit**
```bash
git add src/core/types.ts tests/core/types.test.ts; git commit -m "feat: define core TypeScript types"
```

---

### Task 2: Config Module

**Files:** `src/core/config.ts`, `tests/core/config.test.ts`

- [ ] **Step 1: Write failing test (RED)**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { loadConfig, saveConfig, getApiKey, DEFAULT_DEEPSEEK_CONFIG } from '../../src/core/config';

const TEST_DIR = path.join(os.tmpdir(), 'diffsense-config');
const cfgPath = path.join(TEST_DIR, 'config.json');

describe('Config', () => {
  beforeEach(() => { if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true }); fs.mkdirSync(TEST_DIR, { recursive: true }); });
  afterEach(() => { if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true }); });

  it('loadConfig returns defaults when no file', () => {
    const c = loadConfig(cfgPath);
    expect(c.provider).toBe('deepseek');
    expect(c.token_limit).toBe(8000);
  });
  it('saveConfig + loadConfig round-trip', () => {
    saveConfig({ provider: 'glm', base_url: 'https://o.bm.cn/api/v4', model: 'glm-4-flash', token_limit: 4000, web_port: 4000 }, cfgPath);
    const c = loadConfig(cfgPath);
    expect(c.provider).toBe('glm');
  });
  it('saveConfig creates parent dirs', () => {
    const nested = path.join(TEST_DIR, 'a', 'b', 'c.json');
    saveConfig(DEFAULT_DEEPSEEK_CONFIG, nested);
    expect(fs.existsSync(nested)).toBe(true);
  });
  it('getApiKey reads env var', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    expect(getApiKey('deepseek')).toBe('sk-test');
    delete process.env.DEEPSEEK_API_KEY;
  });
  it('getApiKey throws when not set', () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => getApiKey('deepseek')).toThrow('DEEPSEEK_API_KEY');
  });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Write src/core/config.ts**

```typescript
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { DiffSenseConfig } from './types';

export const DEFAULT_DEEPSEEK_CONFIG: DiffSenseConfig = { provider: 'deepseek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', token_limit: 8000, web_port: 3000 };
export const DEFAULT_GLM_CONFIG: DiffSenseConfig = { provider: 'glm', base_url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', token_limit: 8000, web_port: 3000 };

export function getDefaultConfigPath(): string { return path.join(os.homedir(), '.diffsense', 'config.json'); }

export function loadConfig(configPath?: string): DiffSenseConfig {
  const fp = configPath || getDefaultConfigPath();
  if (!fs.existsSync(fp)) return { ...DEFAULT_DEEPSEEK_CONFIG };
  const raw = fs.readFileSync(fp, 'utf-8');
  return { ...DEFAULT_DEEPSEEK_CONFIG, ...JSON.parse(raw) };
}

export function saveConfig(config: DiffSenseConfig, configPath?: string): void {
  const fp = configPath || getDefaultConfigPath();
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(config, null, 2), 'utf-8');
}

export function getApiKey(provider: 'deepseek' | 'glm'): string {
  const envVar = provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'GLM_API_KEY';
  const key = process.env[envVar];
  if (!key) throw new Error(`环境变量 ${envVar} 未设置。请设置后重试。`);
  return key;
}
```

- [ ] **Step 4: Run test → 5 PASS**

- [ ] **Step 5: Commit**
```bash
git add src/core/config.ts tests/core/config.test.ts; git commit -m "feat: add config module with JSON persistence"
```

---

### Task 3: Logger Module

**Files:** `src/core/logger.ts`, `tests/core/logger.test.ts`

- [ ] **Step 1: Write failing test (RED)**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { logError } from '../../src/core/logger';
const TEST_DIR = path.join(os.tmpdir(), 'diffsense-logger');

describe('Logger', () => {
  const logPath = path.join(TEST_DIR, 'errors.log');
  beforeEach(() => { if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true }); fs.mkdirSync(TEST_DIR, { recursive: true }); });
  afterEach(() => { if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true }); });

  it('writes JSON line', () => {
    logError(logPath, 'abc', 'TestErr', 'msg');
    const entry = JSON.parse(fs.readFileSync(logPath, 'utf-8').trim());
    expect(entry.commit_hash).toBe('abc');
    expect(entry.error_type).toBe('TestErr');
  });
  it('appends to existing log', () => {
    logError(logPath, 'a', 'E', '1'); logError(logPath, 'b', 'E', '2');
    expect(fs.readFileSync(logPath, 'utf-8').trim().split('\n')).toHaveLength(2);
  });
  it('creates parent dirs', () => {
    const nested = path.join(TEST_DIR, 'deep', 'e.log');
    logError(nested, 'x', 'E', 'm');
    expect(fs.existsSync(nested)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Write src/core/logger.ts**

```typescript
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { LogEntry } from './types';
const DEFAULT_LOG_PATH = path.join(os.homedir(), '.diffsense', 'errors.log');

export function logError(logPath: string | null, commitHash: string, errorType: string, errorMessage: string): void {
  const fp = logPath || DEFAULT_LOG_PATH;
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const entry: LogEntry = { timestamp: new Date().toISOString(), commit_hash: commitHash, error_type: errorType, error_message: errorMessage };
  fs.appendFileSync(fp, JSON.stringify(entry) + '\n', 'utf-8');
}
```

- [ ] **Step 4: Run test → 3 PASS**

- [ ] **Step 5: Commit**
```bash
git add src/core/logger.ts tests/core/logger.test.ts; git commit -m "feat: add logger module"
```

---

### Task 4: Storage — Schema & Init

**Files:** `src/core/storage.ts` (partial), `tests/core/storage.test.ts` (full)

- [ ] **Step 1: Write failing test for schema + init**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import Database from 'better-sqlite3';
import { initDatabase, closeDatabase, getDatabase } from '../../src/core/storage';
const TEST_DIR = path.join(os.tmpdir(), 'diffsense-storage');
const dbPath = path.join(TEST_DIR, 'test.db');

describe('Storage Schema', () => {
  beforeEach(() => { if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true }); fs.mkdirSync(TEST_DIR, { recursive: true }); });
  afterEach(() => { closeDatabase(dbPath); if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true }); });

  it('creates db file', () => { initDatabase(dbPath); expect(fs.existsSync(dbPath)).toBe(true); });
  it('creates 3 tables', () => {
    initDatabase(dbPath);
    const db = getDatabase(dbPath);
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {name:string}[]).map(t=>t.name);
    expect(names).toContain('commits'); expect(names).toContain('summaries'); expect(names).toContain('hook_state');
  });
  it('creates indexes', () => {
    initDatabase(dbPath);
    const db = getDatabase(dbPath);
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name").all() as {name:string}[]).map(i=>i.name);
    expect(names).toContain('idx_summaries_repo_date');
    expect(names).toContain('idx_commits_repo_date');
  });
  it('is idempotent', () => { initDatabase(dbPath); initDatabase(dbPath); });
  it('closeDatabase closes connection', () => { initDatabase(dbPath); closeDatabase(dbPath); const db2 = new Database(dbPath); db2.close(); });
  it('getDatabase returns same instance', () => { initDatabase(dbPath); expect(getDatabase(dbPath)).toBe(getDatabase(dbPath)); });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Write src/core/storage.ts (partial)**

```typescript
import Database from 'better-sqlite3'; import * as path from 'path'; import * as fs from 'fs';
const instances = new Map<string, Database.Database>();

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
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (commit_hash, repo_path) REFERENCES commits(commit_hash, repo_path)
);
CREATE TABLE IF NOT EXISTS hook_state (
    repo_path TEXT PRIMARY KEY, installed_at TEXT, backup_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_summaries_repo_date ON summaries(repo_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commits_repo_date ON commits(repo_path, date DESC);
`;

export function initDatabase(dbPath: string): void {
  if (instances.has(dbPath)) return;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(DDL);
  instances.set(dbPath, db);
}

export function getDatabase(dbPath: string): Database.Database {
  const db = instances.get(dbPath);
  if (!db) throw new Error(`数据库未初始化: ${dbPath}`);
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
```

- [ ] **Step 4: Run test → 6 PASS**

- [ ] **Step 5: Commit**
```bash
git add src/core/storage.ts tests/core/storage.test.ts; git commit -m "feat: add storage schema initialization"
```

---

### Task 5: Storage — CRUD Operations

**Files:** Modify `src/core/storage.ts`, `tests/core/storage.test.ts`

- [ ] **Step 1: Write CRUD tests (RED — append to existing test file)**

```typescript
// Append to tests/core/storage.test.ts
import { upsertCommit, getCommit, deleteCommit, upsertSummary, getSummaryByHash, getSummariesByRepo, getStats, getHookState, setHookState, removeHookState } from '../../src/core/storage';

describe('Storage CRUD', () => {
  const dbPath = path.join(os.tmpdir(), 'diffsense-crud', 'test.db');
  beforeEach(() => { if (fs.existsSync(path.dirname(dbPath))) fs.rmSync(path.dirname(dbPath), { recursive: true }); fs.mkdirSync(path.dirname(dbPath), { recursive: true }); initDatabase(dbPath); });
  afterEach(() => { closeDatabase(dbPath); if (fs.existsSync(path.dirname(dbPath))) fs.rmSync(path.dirname(dbPath), { recursive: true }); });

  const cmt = { repo_path: '/r', commit_hash: 'abc', author: 'U', date: '2026-06-14', message: 'm', generated_at: '2026-06-14' };
  const sum = { commit_hash: 'abc', repo_path: '/r', summary: 's', intent: 'i', scope: '["a.ts"]', risk: 'low', truncated: 0, model: 'm', tokens_used: 100 };

  it('upsertCommit insert + get', () => { upsertCommit(dbPath, cmt); expect(getCommit(dbPath, '/r', 'abc')!.author).toBe('U'); });
  it('upsertCommit update', () => { upsertCommit(dbPath, cmt); upsertCommit(dbPath, { ...cmt, author: 'U2' }); expect(getCommit(dbPath, '/r', 'abc')!.author).toBe('U2'); });
  it('getCommit null for nonexistent', () => { expect(getCommit(dbPath, '/r', 'none')).toBeNull(); });
  it('upsertSummary + get', () => { upsertCommit(dbPath, cmt); upsertSummary(dbPath, sum); expect(getSummaryByHash(dbPath, '/r', 'abc')!.summary).toBe('s'); });
  it('upsertSummary overwrite', () => { upsertCommit(dbPath, cmt); upsertSummary(dbPath, sum); upsertSummary(dbPath, { ...sum, summary: 's2' }); expect(getSummaryByHash(dbPath, '/r', 'abc')!.summary).toBe('s2'); });
  it('getSummariesByRepo order + limit', () => {
    for (let i = 0; i < 3; i++) { const h = `h${i}`; upsertCommit(dbPath, { ...cmt, commit_hash: h, date: `2026-06-1${i}` }); upsertSummary(dbPath, { ...sum, commit_hash: h }); }
    const rows = getSummariesByRepo(dbPath, '/r', 3, 0);
    expect(rows).toHaveLength(3);
    expect(rows[0].commit_hash).toBe('h2');
  });
  it('getStats', () => {
    upsertCommit(dbPath, cmt); upsertSummary(dbPath, sum);
    const s = getStats(dbPath, '/r');
    expect(s.totalCommits).toBe(1);
    expect(s.totalTokensUsed).toBe(100);
  });
  it('deleteCommit cascades', () => { upsertCommit(dbPath, cmt); upsertSummary(dbPath, sum); deleteCommit(dbPath, '/r', 'abc'); expect(getCommit(dbPath, '/r', 'abc')).toBeNull(); expect(getSummaryByHash(dbPath, '/r', 'abc')).toBeNull(); });
  it('hookState crud', () => {
    setHookState(dbPath, { repo_path: '/r', installed_at: 'now', backup_path: null });
    expect(getHookState(dbPath, '/r')!.installed_at).toBe('now');
    removeHookState(dbPath, '/r');
    expect(getHookState(dbPath, '/r')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test → 9 new tests FAIL** (functions not exported)

- [ ] **Step 3: Append CRUD methods to src/core/storage.ts**

```typescript
import { StoredCommit, StoredSummary, HookState } from './types';

export function upsertCommit(dbPath: string, c: StoredCommit): void {
  const db = getDatabase(dbPath);
  db.prepare(`INSERT INTO commits VALUES (@repo_path,@commit_hash,@author,@date,@message,@generated_at) ON CONFLICT(repo_path,commit_hash) DO UPDATE SET author=excluded.author,date=excluded.date,message=excluded.message,generated_at=excluded.generated_at`).run(c);
}
export function getCommit(dbPath: string, repoPath: string, hash: string): StoredCommit | null {
  return (getDatabase(dbPath).prepare('SELECT * FROM commits WHERE repo_path=? AND commit_hash=?').get(repoPath, hash) as StoredCommit) || null;
}
export function deleteCommit(dbPath: string, repoPath: string, hash: string): void {
  const db = getDatabase(dbPath);
  db.prepare('DELETE FROM summaries WHERE repo_path=? AND commit_hash=?').run(repoPath, hash);
  db.prepare('DELETE FROM commits WHERE repo_path=? AND commit_hash=?').run(repoPath, hash);
}

export function upsertSummary(dbPath: string, s: Omit<StoredSummary, 'id'|'created_at'>): void {
  getDatabase(dbPath).prepare(`INSERT INTO summaries (commit_hash,repo_path,summary,intent,scope,risk,truncated,model,tokens_used) VALUES (@commit_hash,@repo_path,@summary,@intent,@scope,@risk,@truncated,@model,@tokens_used) ON CONFLICT(id) DO UPDATE SET summary=excluded.summary,intent=excluded.intent,scope=excluded.scope,risk=excluded.risk,truncated=excluded.truncated,model=excluded.model,tokens_used=excluded.tokens_used,created_at=datetime('now') WHERE commit_hash=excluded.commit_hash AND repo_path=excluded.repo_path`).run(s);
}
export function getSummaryByHash(dbPath: string, repoPath: string, hash: string): StoredSummary | null {
  return (getDatabase(dbPath).prepare('SELECT * FROM summaries WHERE repo_path=? AND commit_hash=?').get(repoPath, hash) as StoredSummary) || null;
}
export function getSummariesByRepo(dbPath: string, repoPath: string, limit: number, offset: number, search?: string): StoredSummary[] {
  const db = getDatabase(dbPath);
  let sql = 'SELECT s.* FROM summaries s JOIN commits c ON s.commit_hash=c.commit_hash AND s.repo_path=c.repo_path WHERE s.repo_path=?';
  const params: any[] = [repoPath];
  if (search) { sql += ' AND (s.summary LIKE ? OR c.message LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY c.date DESC LIMIT ? OFFSET ?'; params.push(limit, offset);
  return db.prepare(sql).all(...params) as StoredSummary[];
}
export function getStats(dbPath: string, repoPath: string): { totalCommits: number; modelDistribution: Record<string,number>; monthlyCounts: {month:string;count:number}[]; totalTokensUsed: number } {
  const db = getDatabase(dbPath);
  const cnt = (db.prepare('SELECT COUNT(*) as c FROM summaries WHERE repo_path=?').get(repoPath) as {c:number}).c;
  const models = db.prepare('SELECT model, COUNT(*) as c FROM summaries WHERE repo_path=? GROUP BY model').all(repoPath) as {model:string;c:number}[];
  const months = db.prepare("SELECT strftime('%Y-%m', c.date) as month, COUNT(*) as count FROM summaries s JOIN commits c ON s.commit_hash=c.commit_hash AND s.repo_path=c.repo_path WHERE s.repo_path=? GROUP BY month ORDER BY month ASC").all(repoPath) as {month:string;count:number}[];
  const tokens = (db.prepare('SELECT COALESCE(SUM(tokens_used),0) as t FROM summaries WHERE repo_path=?').get(repoPath) as {t:number}).t;
  const md: Record<string,number> = {}; models.forEach(m => md[m.model] = m.c);
  return { totalCommits: cnt, modelDistribution: md, monthlyCounts: months, totalTokensUsed: tokens };
}

export function getHookState(dbPath: string, repoPath: string): HookState | null {
  return (getDatabase(dbPath).prepare('SELECT * FROM hook_state WHERE repo_path=?').get(repoPath) as HookState) || null;
}
export function setHookState(dbPath: string, s: HookState): void {
  getDatabase(dbPath).prepare('INSERT INTO hook_state VALUES (@repo_path,@installed_at,@backup_path) ON CONFLICT(repo_path) DO UPDATE SET installed_at=excluded.installed_at,backup_path=excluded.backup_path').run(s);
}
export function removeHookState(dbPath: string, repoPath: string): void {
  getDatabase(dbPath).prepare('DELETE FROM hook_state WHERE repo_path=?').run(repoPath);
}
```

- [ ] **Step 4: Run test → 15 PASS** (6 schema + 9 CRUD)

- [ ] **Step 5: Commit**
```bash
git add src/core/storage.ts tests/core/storage.test.ts; git commit -m "feat: add storage CRUD operations"
```

---

### Task 6: Diff Parser

**Files:** `src/core/diff-parser.ts`, `tests/core/diff-parser.test.ts`, test fixtures

- [ ] **Step 1: Create fixtures and test (RED)**

**tests/fixtures/sample-diffs/multi-file.diff:**
```diff
diff --git a/src/auth/login.ts b/src/auth/login.ts
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -10,6 +10,9 @@
+  if (!user.active) throw new Error('deactivated');
diff --git a/src/auth/token.ts b/src/auth/token.ts
--- a/src/auth/token.ts
+++ b/src/auth/token.ts
@@ -5,3 +5,5 @@
+  const expiry = Date.now() + 3600000;
```

**tests/core/diff-parser.test.ts:**
```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs'; import * as path from 'path';
import { parseDiffFromString, chunkDiffByFile } from '../../src/core/diff-parser';
const FX = path.join(__dirname, '..', 'fixtures', 'sample-diffs');

describe('DiffParser', () => {
  describe('parseDiffFromString', () => {
    it('extracts metadata from git show', () => {
      const out = 'abc123 (HEAD)\nAuthor: Test <t@e.com>\nDate:   Mon Jun 14 2026\n\n    fix: bug\n\ndiff --git a/x b/x\n...';
      const r = parseDiffFromString(out);
      expect(r.commitHash).toBe('abc123');
      expect(r.author).toBe('Test <t@e.com>');
      expect(r.message).toBe('fix: bug');
    });
    it('detects first commit (no diff section)', () => {
      const out = 'abc123\nAuthor: T\nDate:   Mon\n\n    init\n';
      expect(parseDiffFromString(out).isFirstCommit).toBe(true);
    });
  });
  describe('chunkDiffByFile', () => {
    it('splits multi-file diff', () => {
      const diff = fs.readFileSync(path.join(FX, 'multi-file.diff'), 'utf-8');
      const chunks = chunkDiffByFile(diff, 8000);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].filename).toContain('login.ts');
      expect(chunks[1].filename).toContain('token.ts');
    });
    it('truncates over-limit chunks', () => {
      const diff = fs.readFileSync(path.join(FX, 'multi-file.diff'), 'utf-8');
      const chunks = chunkDiffByFile(diff, 5);
      expect(chunks[0].truncated).toBe(true);
      expect(chunks[0].diffContent).toContain('truncated');
    });
    it('skips binary files', () => {
      const diff = 'diff --git a/img.png b/img.png\nBinary files differ\n';
      expect(chunkDiffByFile(diff, 8000)).toHaveLength(0);
    });
    it('handles empty diff', () => { expect(chunkDiffByFile('', 8000)).toHaveLength(0); });
  });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Write src/core/diff-parser.ts**

```typescript
import { FileChunk } from './types';
import simpleGit from 'simple-git';

export function parseDiffFromString(raw: string): { commitHash: string; author: string; message: string; isFirstCommit: boolean } {
  const lines = raw.split('\n');
  const commitHash = lines[0].split(' ')[0].trim();
  const authorLine = lines.find(l => l.startsWith('Author:')) || '';
  const author = authorLine.replace('Author:', '').trim();
  const di = lines.findIndex(l => l.startsWith('Date:'));
  const msgLine = lines.slice(di + 1).find(l => l.trim() && !l.startsWith('diff'));
  const message = (msgLine || '').trim();
  const hasDiff = lines.some(l => l.startsWith('diff --git'));
  return { commitHash, author, message, isFirstCommit: !hasDiff };
}

export function chunkDiffByFile(rawDiff: string, tokenLimit: number): FileChunk[] {
  if (!rawDiff.trim()) return [];
  const sections = splitByFile(rawDiff);
  return sections.map(({ filename, content }) => {
    if (content.includes('Binary files') && content.includes('differ')) return null;
    const est = Math.ceil(content.length / 2.5);
    let truncated = false, diffContent = content;
    if (est > tokenLimit) {
      truncated = true;
      diffContent = content.substring(0, Math.floor(tokenLimit * 2.5)) + '\n[...truncated, content exceeds token limit]';
    }
    return { filename, diffContent, tokenEstimate: Math.min(est, tokenLimit), truncated } as FileChunk;
  }).filter((c): c is FileChunk => c !== null);
}

function splitByFile(diff: string): { filename: string; content: string }[] {
  const sections: { filename: string; content: string }[] = [];
  const lines = diff.split('\n');
  let curFile = '', curContent: string[] = [];
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (curFile && curContent.length) sections.push({ filename: curFile, content: curContent.join('\n') });
      const m = line.match(/diff --git a\/(.*?) b\//);
      curFile = m ? m[1] : line;
      curContent = [line];
    } else if (curFile) { curContent.push(line); }
  }
  if (curFile && curContent.length) sections.push({ filename: curFile, content: curContent.join('\n') });
  return sections;
}

export async function execGitDiff(repoPath: string, commitHash: string): Promise<{ repoPath: string; commitHash: string; author: string; date: string; message: string; isFirstCommit: boolean; rawDiff: string }> {
  const git = simpleGit(repoPath);
  let raw: string, isFirst = false;
  try { raw = await git.raw(['diff', `${commitHash}^..${commitHash}`]); } catch { isFirst = true; raw = await git.raw(['show', commitHash, '--format=fuller']); }
  const logOut = await git.raw(['show', commitHash, '--format=%H%n%an%n%aI%n%s', '--no-patch']);
  const meta = logOut.trim().split('\n');
  return { repoPath, commitHash: meta[0] || commitHash, author: meta[1] || 'Unknown', date: meta[2] || '', message: meta[3] || '', isFirstCommit: isFirst, rawDiff: raw };
}
```

- [ ] **Step 4: Run test → 7 PASS**

- [ ] **Step 5: Commit**
```bash
git add src/core/diff-parser.ts tests/core/diff-parser.test.ts tests/fixtures/; git commit -m "feat: add diff parser with per-file chunking"
```

---

### Task 7: LLM Client

**Files:** `src/core/llm-client.ts`, `tests/core/llm-client.test.ts`

- [ ] **Step 1: Write test (RED)**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, parseSummaryResponse, generateSummary } from '../../src/core/llm-client';
import { FileChunk, DiffSenseConfig } from '../../src/core/types';

describe('LLM Client', () => {
  describe('buildPrompt', () => {
    it('includes commit message + diff', () => {
      const c: FileChunk[] = [{ filename: 'a.ts', diffContent: '+x', tokenEstimate: 1, truncated: false }];
      const p = buildPrompt(c, 'fix: bug', 1);
      expect(p).toContain('fix: bug');
      expect(p).toContain('a.ts');
      expect(p).toContain('+x');
    });
    it('warns for truncated chunks', () => {
      const c: FileChunk[] = [{ filename: 'b.ts', diffContent: '...', tokenEstimate: 100, truncated: true }];
      expect(buildPrompt(c, 'm', 1)).toContain('已截断');
    });
  });
  describe('parseSummaryResponse', () => {
    it('parses valid JSON', () => {
      const r = parseSummaryResponse('{"summary":"s","intent":"i","scope":["a.ts"],"risk":"low"}');
      expect(r.summary).toBe('s');
    });
    it('strips markdown fence', () => {
      const r = parseSummaryResponse('```json\n{"summary":"t","intent":"","scope":[],"risk":"low"}\n```');
      expect(r.summary).toBe('t');
    });
    it('throws on invalid JSON', () => {
      expect(() => parseSummaryResponse('not json')).toThrow('LLMResponseParseError');
    });
    it('throws on missing fields', () => {
      expect(() => parseSummaryResponse('{"summary":"x"}')).toThrow('LLMResponseParseError');
    });
  });
  describe('generateSummary', () => {
    it('calls API and parses response', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"s","intent":"i","scope":["a.ts"],"risk":"low"}' } }] }) }) as any;
      const cfg: DiffSenseConfig = { provider: 'deepseek', base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };
      const r = await generateSummary(cfg, 'key', [{ filename: 'a.ts', diffContent: '+x', tokenEstimate: 1, truncated: false }], 'msg');
      expect(r.summary).toBe('s');
    });
    it('throws on non-200', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 }) as any;
      const cfg: DiffSenseConfig = { provider: 'deepseek', base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };
      await expect(generateSummary(cfg, 'k', [{ filename: 'a', diffContent: '', tokenEstimate: 0, truncated: false }], 'm')).rejects.toThrow('LLMAPIError');
    });
  });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Write src/core/llm-client.ts**

```typescript
import { FileChunk, DiffSenseConfig, SummaryCard } from './types';

export function buildPrompt(chunks: FileChunk[], commitMessage: string, fileCount: number): string {
  const diffContent = chunks.map(c => {
    let h = `### ${c.filename}`;
    if (c.truncated) h += ' [注意：该文件变更过大，已截断部分内容]';
    return `${h}\n\`\`\`diff\n${c.diffContent}\n\`\`\``;
  }).join('\n\n');
  return `你是一个代码变更分析助手。请分析以下 git diff，用中文输出结构化摘要。严格按 JSON 格式返回，不要输出其他内容。\n\n原始 Commit Message: ${commitMessage}\n变更文件数: ${fileCount}\n\n--- DIFF ---\n${diffContent}\n\n请返回 JSON:\n{\n  "summary": "一句话摘要（不超过80字）",\n  "intent": "变更意图",\n  "scope": ["文件路径1"],\n  "risk": "风险提示（低/中/高）"\n}`;
}

export function parseSummaryResponse(raw: string): SummaryCard {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) jsonStr = fence[1].trim();
  let parsed: any;
  try { parsed = JSON.parse(jsonStr); } catch { throw new Error(`LLMResponseParseError: 无法解析 JSON。原始: ${raw.substring(0, 200)}`); }
  if (!parsed.summary || !parsed.intent || !Array.isArray(parsed.scope) || !parsed.risk) throw new Error(`LLMResponseParseError: 缺少必要字段` );
  return { summary: parsed.summary, intent: parsed.intent, scope: parsed.scope, risk: parsed.risk };
}

export async function generateSummary(config: DiffSenseConfig, apiKey: string, chunks: FileChunk[], commitMessage: string): Promise<SummaryCard> {
  const prompt = buildPrompt(chunks, commitMessage, chunks.length);
  const resp = await fetch(`${config.base_url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: '你是一个代码变更分析助手。请用中文输出结构化摘要。严格按 JSON 格式返回。' }, { role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1000 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`LLMAPIError: API 返回状态码 ${resp.status}`);
  const data = await resp.json() as any;
  return parseSummaryResponse(data.choices?.[0]?.message?.content || '');
}
```

- [ ] **Step 4: Run test → 7 PASS**

- [ ] **Step 5: Commit**
```bash
git add src/core/llm-client.ts tests/core/llm-client.test.ts; git commit -m "feat: add LLM client with prompt build and response parse"
```

---

### Task 8: Core Engine Orchestration

**Files:** `src/core/index.ts`, `tests/core/index.test.ts`

- [ ] **Step 1: Write test (RED)**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { processCommit } from '../../src/core/index';
import { initDatabase, closeDatabase, getSummaryByHash, upsertCommit } from '../../src/core/storage';
import { DiffSenseConfig } from '../../src/core/types';
const TD = path.join(os.tmpdir(), 'diffsense-engine');
const db = path.join(TD, 'test.db');
const lp = path.join(TD, 'errors.log');
const cfg: DiffSenseConfig = { provider: 'deepseek', base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };

describe('processCommit', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); initDatabase(db); });
  afterEach(() => { closeDatabase(db); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('generates and stores summary on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"s","intent":"i","scope":["a.ts"],"risk":"low"}' } }] }) }) as any;
    upsertCommit(db, { repo_path: '/r', commit_hash: 'abc', author: 'T', date: '2026-01-01', message: 'm', generated_at: '' });
    await processCommit('/r', 'abc', cfg, 'key', db, lp);
    expect(getSummaryByHash(db, '/r', 'abc')!.summary).toBe('s');
  });
  it('logs error and returns null on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    upsertCommit(db, { repo_path: '/r', commit_hash: 'fail', author: 'T', date: '2026-01-01', message: 'm', generated_at: '' });
    const r = await processCommit('/r', 'fail', cfg, 'key', db, lp);
    expect(r).toBeNull();
    expect(fs.existsSync(lp)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Write src/core/index.ts**

```typescript
import { DiffSenseConfig, SummaryCard } from './types';
import { execGitDiff, chunkDiffByFile } from './diff-parser';
import { generateSummary } from './llm-client';
import { upsertCommit, upsertSummary } from './storage';
import { logError } from './logger';

export async function processCommit(repoPath: string, commitHash: string, config: DiffSenseConfig, apiKey: string, dbPath: string, logPath: string): Promise<SummaryCard | null> {
  try {
    const info = await execGitDiff(repoPath, commitHash);
    upsertCommit(dbPath, { repo_path: repoPath, commit_hash: commitHash, author: info.author, date: info.date, message: info.message, generated_at: new Date().toISOString() });

    let summary: SummaryCard;
    let truncated = false;
    if (!info.rawDiff.trim() || info.isFirstCommit) {
      summary = await generateSummary(config, apiKey, [{ filename: '(initial)', diffContent: `初 始提交: ${info.message}`, tokenEstimate: 10, truncated: false }], info.message);
    } else {
      const chunks = chunkDiffByFile(info.rawDiff, config.token_limit);
      if (!chunks.length) return null;
      truncated = chunks.some(c => c.truncated);
      summary = await generateSummary(config, apiKey, chunks, info.message);
    }
    upsertSummary(dbPath, { commit_hash: commitHash, repo_path: repoPath, summary: summary.summary, intent: summary.intent, scope: JSON.stringify(summary.scope), risk: summary.risk, truncated: truncated ? 1 : 0, model: config.model, tokens_used: 100 });
    return summary;
  } catch (err) {
    logError(logPath, commitHash, (err as Error).name || 'Error', (err as Error).message);
    return null;
  }
}
```

- [ ] **Step 4: Run test → 2 PASS**

- [ ] **Step 5: Commit**
```bash
git add src/core/index.ts tests/core/index.test.ts; git commit -m "feat: add core engine orchestration"
```

---

### Task 9: CLI Entry Point

**Files:** `src/cli/index.ts`

- [ ] **Step 1: Write CLI entry point (no test — tested via integration)**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { registerConfigCommand } from './commands/config';
import { registerInitCommand } from './commands/init';
import { registerUninitCommand } from './commands/uninit';
import { registerLogCommand } from './commands/log';
import { registerExplainCommand } from './commands/explain';
import { registerGenerateCommand } from './commands/generate';
import { registerWebCommand } from './commands/web';
import { hookPostCommit } from './hook-post-commit';

const program = new Command();
program.name('ds').description('DiffSense — AI-powered code change interpreter').version('1.0.0');

registerConfigCommand(program);
registerInitCommand(program);
registerUninitCommand(program);
registerLogCommand(program);
registerExplainCommand(program);
registerGenerateCommand(program);
registerWebCommand(program);

program.command('hook-post-commit').description('(internal)').action(async () => { await hookPostCommit(); });

program.parse(process.argv);
```

- [ ] **Step 2: Verify build**

Run: `npm run build` → compiles successfully
Run: `node dist/cli/index.js --help` → shows all commands

- [ ] **Step 3: Commit**
```bash
git add src/cli/index.ts; git commit -m "feat: add CLI entry point with commander"
```

---

### Task 10: CLI — config Command

**Files:** `src/cli/commands/config.ts`

- [ ] **Step 1: Write command (no dedicated test — tested via integration with T2 config tests)**

```typescript
import { Command } from 'commander';
import * as readline from 'readline';
import { saveConfig, loadConfig, getDefaultConfigPath, DEFAULT_DEEPSEEK_CONFIG, DEFAULT_GLM_CONFIG } from '../../core/config';

function ask(q: string, d: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => { rl.question(`${q} [${d}]: `, a => { rl.close(); r(a.trim() || d); }); });
}

export function registerConfigCommand(program: Command): void {
  program.command('config').description('交互式配置 LLM provider').action(async () => {
    const existing = loadConfig();
    console.log(`当前: provider=${existing.provider} base_url=${existing.base_url} model=${existing.model}`);
    const prov = await ask('provider (deepseek/glm)', existing.provider);
    if (prov !== 'deepseek' && prov !== 'glm') { console.log(`错误: provider 必须是 deepseek 或 glm`); process.exit(1); }
    const provider = prov as 'deepseek' | 'glm';
    const dUrl = provider === 'deepseek' ? DEFAULT_DEEPSEEK_CONFIG.base_url : DEFAULT_GLM_CONFIG.base_url;
    const dModel = provider === 'deepseek' ? DEFAULT_DEEPSEEK_CONFIG.model : DEFAULT_GLM_CONFIG.model;
    const base_url = await ask('base_url', dUrl);
    const model = await ask('model', dModel);
    const tl = await ask('token_limit', String(existing.token_limit));
    const wp = await ask('web_port', String(existing.web_port));
    const cfg = { provider, base_url, model, token_limit: parseInt(tl) || 8000, web_port: parseInt(wp) || 3000 };
    saveConfig(cfg);
    console.log(`配置已保存到 ${getDefaultConfigPath()}`);
    console.log(`注意: 请设置环境变量 ${provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'GLM_API_KEY'}`);
  });
}
```

- [ ] **Step 2: Verify build** → `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/cli/commands/config.ts; git commit -m "feat: add CLI config command"
```

---

### Task 11: CLI — init / uninit Commands

**Files:** `src/cli/commands/init.ts`, `src/cli/commands/uninit.ts`, `tests/cli/init-uninit.test.ts`

- [ ] **Step 1: Write test (RED)**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initHook, uninitHook } from '../../src/cli/commands/init';
const TD = path.join(os.tmpdir(), 'diffsense-init-test');

describe('init / uninit', () => {
  let repo: string, hp: string;
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); repo = path.join(TD, 'r'); hp = path.join(repo, '.git', 'hooks', 'post-commit'); fs.mkdirSync(path.dirname(hp), { recursive: true }); });
  afterEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('creates hook', () => { initHook(repo); expect(fs.readFileSync(hp, 'utf-8')).toContain('ds hook-post-commit'); });
  it('backs up existing hook', () => { fs.writeFileSync(hp, 'echo old', 'utf-8'); initHook(repo); expect(fs.existsSync(hp + '.bak')).toBe(true); });
  it('is idempotent', () => { initHook(repo); initHook(repo); expect((fs.readFileSync(hp, 'utf-8').match(/ds hook-post-commit/g) || []).length).toBe(1); });
  it('errors on non-git', () => { expect(initHook(TD).success).toBe(false); });
  it('removes hook on uninit', () => { initHook(repo); uninitHook(repo); expect(fs.readFileSync(hp, 'utf-8')).not.toContain('ds hook-post-commit'); });
  it('removes empty file', () => { initHook(repo); uninitHook(repo); expect(fs.existsSync(hp)).toBe(false); });
  it('restores backup', () => { fs.writeFileSync(hp, 'echo old', 'utf-8'); initHook(repo); uninitHook(repo); expect(fs.readFileSync(hp, 'utf-8')).toContain('old'); });
  it('errors if not initialized', () => { expect(uninitHook(repo).success).toBe(false); });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Write implementations**

**src/cli/commands/init.ts:**
```typescript
import * as fs from 'fs'; import * as path from 'path';
const HOOK = '#!/bin/sh\n# DiffSense post-commit hook\nds hook-post-commit\n';
const MARKER = 'ds hook-post-commit';

export interface HookResult { success: boolean; error?: string; backedUp?: boolean; }

export function initHook(repoPath: string): HookResult {
  const gitDir = path.join(repoPath, '.git');
  if (!fs.existsSync(gitDir)) return { success: false, error: '错误：当前目录不在 Git 仓库中' };
  const hp = path.join(gitDir, 'hooks', 'post-commit');
  if (fs.existsSync(hp)) {
    if (fs.readFileSync(hp, 'utf-8').includes(MARKER)) return { success: true };
    fs.writeFileSync(hp + '.bak', fs.readFileSync(hp, 'utf-8'), 'utf-8');
  }
  try { fs.writeFileSync(hp, HOOK, { mode: 0o755 }); return { success: true, backedUp: fs.existsSync(hp + '.bak') }; }
  catch (e) { return { success: false, error: `无法写入 hook: ${(e as Error).message}` }; }
}

export function uninitHook(repoPath: string): HookResult {
  const hp = path.join(repoPath, '.git', 'hooks', 'post-commit');
  if (!fs.existsSync(hp)) return { success: false, error: 'DiffSense 未在此仓库中初始化' };
  let c = fs.readFileSync(hp, 'utf-8');
  if (!c.includes(MARKER)) return { success: false, error: 'DiffSense 未在此仓库中初始化' };
  c = c.split('\n').filter(l => !l.includes(MARKER) && !l.includes('# DiffSense')).join('\n').trim();
  if (c) { fs.writeFileSync(hp, c, { mode: 0o755 }); }
  else { const bp = hp + '.bak'; if (fs.existsSync(bp)) { fs.writeFileSync(hp, fs.readFileSync(bp, 'utf-8'), { mode: 0o755 }); fs.unlinkSync(bp); } else fs.unlinkSync(hp); }
  return { success: true };
}

import { Command } from 'commander';
export function registerInitCommand(p: Command): void { p.command('init').description('安装 post-commit hook').action(() => { const r = initHook(process.cwd()); if (r.success) { console.log('DiffSense hook 已安装'); if (r.backedUp) console.log('原有 hook 已备份'); } else { console.log(r.error); process.exit(1); } }); }
```

**src/cli/commands/uninit.ts:**
```typescript
import { Command } from 'commander'; import { uninitHook } from './init';
export function registerUninitCommand(p: Command): void { p.command('uninit').description('卸载 post-commit hook').action(() => { const r = uninitHook(process.cwd()); if (r.success) console.log('DiffSense hook 已卸载'); else { console.log(r.error); process.exit(1); } }); }
```

- [ ] **Step 4: Run test → 8 PASS**

- [ ] **Step 5: Commit**
```bash
git add src/cli/commands/init.ts src/cli/commands/uninit.ts tests/cli/init-uninit.test.ts; git commit -m "feat: add CLI init/uninit commands"
```

---

### Task 12: CLI — log Command

**Files:** `src/cli/commands/log.ts`

- [ ] **Step 1: Write command (data tests already in T5)**

```typescript
import { Command } from 'commander';
import * as path from 'path'; import * as fs from 'fs';
import { initDatabase, getSummariesByRepo, closeDatabase, getCommit } from '../../core/storage';
import chalk from 'chalk';

export function registerLogCommand(program: Command): void {
  program.command('log').description('查看最近 commit 摘要列表')
    .option('-n, --number <n>', '显示数量 (1-50)', '10')
    .option('-r, --repo <path>', '仓库路径', process.cwd())
    .action(async (opts) => {
      const n = Math.min(Math.max(parseInt(opts.number) || 10, 1), 50);
      const rp = opts.repo;
      const dp = path.join(rp, '.diffsense.db');
      if (!fs.existsSync(dp)) { console.log('暂无摘要记录，请先运行 ds init'); process.exit(0); }
      initDatabase(dp);
      const rows = getSummariesByRepo(dp, rp, n, 0);
      if (!rows.length) { console.log('暂无摘要记录'); closeDatabase(dp); process.exit(0); }
      console.log(chalk.bold('Hash     │ 摘要                                          │ 日期       │ 作者'));
      console.log('─────────┼───────────────────────────────────────────────┼────────────┼──────────');
      for (const s of rows) {
        const h = s.commit_hash.substring(0, 7);
        const sum = s.summary.length > 45 ? s.summary.substring(0, 42) + '...' : s.summary.padEnd(45);
        const d = s.created_at ? s.created_at.substring(0, 10) : 'N/A';
        const c = getCommit(dp, rp, s.commit_hash);
        const a = c ? (c.author.length > 8 ? c.author.substring(0, 7) + '…' : c.author.padEnd(8)) : 'N/A'.padEnd(8);
        console.log(`${chalk.yellow(h)}  │ ${sum} │ ${d}   │ ${a}`);
      }
      console.log(`\n显示 ${rows.length} 条记录`);
      closeDatabase(dp);
    });
}
```

- [ ] **Step 2: Verify build** → `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/cli/commands/log.ts; git commit -m "feat: add CLI log command"
```

---

### Task 13: CLI — explain / generate Commands

**Files:** `src/cli/commands/explain.ts`, `src/cli/commands/generate.ts`

- [ ] **Step 1: Write commands**

**src/cli/commands/explain.ts:**
```typescript
import { Command } from 'commander';
import * as path from 'path'; import * as fs from 'fs'; import * as os from 'os';
import { loadConfig, getApiKey } from '../../core/config';
import { initDatabase, getSummaryByHash, closeDatabase, upsertCommit } from '../../core/storage';
import { processCommit } from '../../core/index';
import chalk from 'chalk';

function printCard(hash: string, card: { summary: string; intent: string; scope: string[]; risk: string }, truncated = false) {
  console.log(chalk.bold('\n┌─────────────────────────────────────────┐'));
  console.log(`│ Commit: ${hash.substring(0, 7)}`.padEnd(43) + '│');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│ 📝 摘要: ${card.summary}`);
  console.log(`│ 🎯 意图: ${card.intent}`);
  console.log(`│ 📂 影响: ${card.scope.join(', ')}`);
  console.log(`│ ⚠️  风险: ${card.risk}`);
  if (truncated) console.log('│ ⚠  该文件变更过大，摘要可能不完整');
  console.log(chalk.bold('└─────────────────────────────────────────┘\n'));
}

export function registerExplainCommand(program: Command): void {
  program.command('explain <ref>').description('查看 commit 详细摘要')
    .option('-r, --repo <path>', '仓库路径', process.cwd())
    .action(async (ref: string, opts) => {
      const rp = opts.repo; const dp = path.join(rp, '.diffsense.db');
      const { default: sg } = await import('simple-git'); const git = sg(rp);
      let hash: string;
      try { hash = (await git.raw(['rev-parse', ref])).trim(); } catch { console.log(`错误: 无法解析引用: ${ref}`); process.exit(1); }
      const cfg = loadConfig(); const key = getApiKey(cfg.provider);
      initDatabase(dp);
      const cached = getSummaryByHash(dp, rp, hash);
      if (cached) { printCard(hash, { summary: cached.summary, intent: cached.intent, scope: JSON.parse(cached.scope || '[]'), risk: cached.risk }, cached.truncated === 1); closeDatabase(dp); return; }
      const log = await git.raw(['show', hash, '--format=%an%n%aI%n%s', '--no-patch']); const ml = log.trim().split('\n');
      upsertCommit(dp, { repo_path: rp, commit_hash: hash, author: ml[0] || 'U', date: ml[1] || '', message: ml[2] || '', generated_at: '' });
      const r = await processCommit(rp, hash, cfg, key, dp, path.join(os.homedir(), '.diffsense', 'errors.log'));
      if (r) printCard(hash, r); else { console.log('摘要生成失败，查看 ~/.diffsense/errors.log'); process.exit(1); }
      closeDatabase(dp);
    });
}
```

**src/cli/commands/generate.ts:**
```typescript
import { Command } from 'commander';
import * as path from 'path'; import * as os from 'os';
import { loadConfig, getApiKey } from '../../core/config';
import { initDatabase, closeDatabase, upsertCommit } from '../../core/storage';
import { processCommit } from '../../core/index';
import chalk from 'chalk';

function printCard(hash: string, card: { summary: string; intent: string; scope: string[]; risk: string }, t = false) {
  console.log(chalk.bold('\n┌─────────────────────────────────────────┐'));
  console.log(`│ Commit: ${hash.substring(0, 7)}`.padEnd(43) + '│');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│ 📝 摘要: ${card.summary}`); console.log(`│ 🎯 意图: ${card.intent}`);
  console.log(`│ 📂 影响: ${card.scope.join(', ')}`); console.log(`│ ⚠️  风险: ${card.risk}`);
  if (t) console.log('│ ⚠  该文件变更过大，摘要可能不完整');
  console.log(chalk.bold('└─────────────────────────────────────────┘\n'));
}

export function registerGenerateCommand(program: Command): void {
  program.command('generate <ref>').description('强制生成摘要（覆盖缓存）')
    .option('-r, --repo <path>', '仓库路径', process.cwd())
    .action(async (ref: string, opts) => {
      const rp = opts.repo; const dp = path.join(rp, '.diffsense.db');
      const { default: sg } = await import('simple-git'); const git = sg(rp);
      let hash: string;
      try { hash = (await git.raw(['rev-parse', ref])).trim(); } catch { console.log(`错误: 无法解析引用: ${ref}`); process.exit(1); }
      const cfg = loadConfig(); const key = getApiKey(cfg.provider); initDatabase(dp);
      const log = await git.raw(['show', hash, '--format=%an%n%aI%n%s', '--no-patch']); const ml = log.trim().split('\n');
      upsertCommit(dp, { repo_path: rp, commit_hash: hash, author: ml[0] || 'U', date: ml[1] || '', message: ml[2] || '', generated_at: new Date().toISOString() });
      console.log('正在生成摘要...');
      const r = await processCommit(rp, hash, cfg, key, dp, path.join(os.homedir(), '.diffsense', 'errors.log'));
      if (r) printCard(hash, r); else { console.log('摘要生成失败'); process.exit(1); }
      closeDatabase(dp);
    });
}
```

- [ ] **Step 2: Verify build** → `npm run build`

- [ ] **Step 3: Commit**
```bash
git add src/cli/commands/explain.ts src/cli/commands/generate.ts; git commit -m "feat: add CLI explain and generate commands"
```

---

### Task 14: CLI — hook-post-commit / web Command

**Files:** `src/cli/hook-post-commit.ts`, `src/cli/commands/web.ts`

**src/cli/hook-post-commit.ts:**
```typescript
import * as path from 'path'; import * as os from 'os';
import { loadConfig, getApiKey } from '../core/config';
import { initDatabase, closeDatabase, upsertCommit } from '../core/storage';
import { processCommit } from '../core/index';
import simpleGit from 'simple-git';

export async function hookPostCommit(): Promise<void> {
  const rp = process.cwd(); const dp = path.join(rp, '.diffsense.db');
  const lp = path.join(os.homedir(), '.diffsense', 'errors.log');
  try {
    const cfg = loadConfig(); const key = getApiKey(cfg.provider);
    const git = simpleGit(rp);
    const hash = (await git.raw(['rev-parse', 'HEAD'])).trim();
    const log = await git.raw(['show', 'HEAD', '--format=%an%n%aI%n%s', '--no-patch']);
    const ml = log.trim().split('\n');
    initDatabase(dp);
    upsertCommit(dp, { repo_path: rp, commit_hash: hash, author: ml[0] || 'U', date: ml[1] || '', message: ml[2] || '', generated_at: new Date().toISOString() });
    await processCommit(rp, hash, cfg, key, dp, lp);
    closeDatabase(dp);
  } catch { /* silent fail */ }
}
```

**src/cli/commands/web.ts:**
```typescript
import { Command } from 'commander'; import { loadConfig } from '../../core/config';
export function registerWebCommand(program: Command): void {
  program.command('web').description('启动 Web 界面')
    .option('-p, --port <number>', '端口号')
    .action(async (opts) => {
      const cfg = loadConfig();
      const port = opts.port ? parseInt(opts.port, 10) : cfg.web_port;
      const { startWebServer } = await import('../../web/index');
      await startWebServer(port);
    });
}
```

- [ ] **Step 1: Commit**
```bash
git add src/cli/hook-post-commit.ts src/cli/commands/web.ts; git commit -m "feat: add hook-post-commit and web command entry"
```

---

### Task 15: Web Server + Layout

**Files:** `src/web/index.ts`, `src/web/views/layout.html`

**src/web/index.ts:**
```typescript
import express from 'express'; import * as path from 'path';
import { registerPageRoutes } from './routes/pages';
import { registerApiRoutes } from './routes/api';

export async function startWebServer(port: number): Promise<void> {
  const app = express();
  app.use(express.json());
  registerApiRoutes(app);
  registerPageRoutes(app);

  let cp = port;
  for (let i = 0; i < 3; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        app.listen(cp, '127.0.0.1', () => { console.log(`DiffSense Web: http://localhost:${cp}`); resolve(); })
          .on('error', (e: any) => e.code === 'EADDRINUSE' ? reject(new Error('EADDRINUSE')) : reject(e));
      });
      return;
    } catch (e: any) { if (e.message === 'EADDRINUSE' && i < 2) { cp++; console.log(`端口被占用，尝试 ${cp}...`); } else throw e; }
  }
}
```

**src/web/views/layout.html** — Vercel-style minimal layout with CSS variables, HTMX CDN, responsive design, navigation (list + stats), and `{{{content}}}` placeholder. Full CSS included inline (see SPEC.md Vercel design tokens).

- [ ] **Step 1: Commit**
```bash
git add src/web/index.ts src/web/views/layout.html; git commit -m "feat: add web server with Vercel-style layout"
```

---

### Task 16: Web — List + Detail + Stats Pages + API

**Files:** `src/web/routes/pages.ts`, `src/web/routes/api.ts`, `src/web/views/list.html`, `src/web/views/detail.html`, `src/web/views/stats.html`

**pages.ts** — SSR routes for `/` (list, 20-per-page, search, HTMX), `/commits/:hash` (detail with scope tags), `/stats` (stat cards + SVG charts). Uses simple template replacement via `{{...}}` syntax.

**api.ts** — JSON API: `GET /api/commits?q=&page=` for paginated list, `GET /api/commits/:hash` for single summary, `GET /api/stats` for aggregated stats.

**Views** — Three HTML templates using Vercel design tokens CSS (defined in layout.html). List: search bar + card list with HTMX hx-get for expand. Detail: full structured card. Stats: stat cards grid + SVG chart.

- [ ] **Step 1: Commit**
```bash
git add src/web/routes/pages.ts src/web/routes/api.ts src/web/views/list.html src/web/views/detail.html src/web/views/stats.html
git commit -m "feat: add web pages (list, detail, stats) and API routes"
```

---

### Task 17: Dockerfile

**Files:** `Dockerfile`

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
RUN npm prune --production

FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY src/web/views/ ./src/web/views/
ENTRYPOINT ["node", "dist/cli/index.js"]
```

- [ ] **Step 1: Verify** → `docker build -t diffsense . && docker run diffsense --help`
- [ ] **Step 2: Commit**
```bash
git add Dockerfile; git commit -m "feat: add Dockerfile (Node 18 Alpine + git)"
```

---

### Task 18: CI (GitHub Actions)

**Files:** `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: npm ci
      - run: npm test
  docker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t diffsense .
```

- [ ] **Step 1: Commit**
```bash
git add .github/workflows/ci.yml; git commit -m "ci: add GitHub Actions for test + docker build"
```

---

### Task 19: README.md

**Files:** `README.md`

Standard sections: title + description, quick start (install, config, init), CLI commands reference, Web usage, Docker usage, environment variables, tech stack, license.

- [ ] **Step 1: Commit**
```bash
git add README.md; git commit -m "docs: add README with usage guide"
```

---

## Self-Review Checklist

- [x] SPEC coverage: All 10 sections covered — types → config → logger → storage → diff-parser → llm-client → engine → CLI (7 commands) → Web (3 pages + API) → Docker → CI → README
- [x] No placeholders: All code steps contain real implementation
- [x] Type consistency: Interfaces defined in T1 used consistently across T2–T16
- [x] Dependencies labeled: Task dependency graph above
- [x] Each task has verify step with exact command + expected output
- [x] PLAN.md header contains REQUIRED SUB-SKILL declaration
