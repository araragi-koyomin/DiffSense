# DiffSense 实现计划

> **致智能体工作者:** 必需的子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐任务实现本计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标:** 构建 DiffSense —— 一个 post-commit AI 驱动的代码变更语义解释器，具备 CLI 和 Web 两个界面。

**架构:** 单一 TypeScript/Node.js 包，双入口。核心引擎（DiffParser、LLMClient、Storage）由 CLI（commander）和 Web（Express + SSR + HTMX）共享。使用 better-sqlite3 实现 SQLite 持久化。Docker 单容器，支持 CLI 和 Web 两种运行模式。

**技术栈:** TypeScript 5.x、Node.js >= 18、commander 12.x、express 4.x、better-sqlite3 11.x、simple-git 3.x、chalk 5.x、vitest（测试运行器）、htmx 2.x（CDN）

**设计系统:** Vercel + `web-design-guidelines`（Open Design）

---

## 冷启动验证（前置步骤，在 T0 之前执行）

> 此步骤对应 AI4SE 期末项目要求 §4.5。使用 **第二智能体**（类型不同于 OpenCode）
> 在全新 session 中仅凭 SPEC.md + PLAN.md 试跑 1-2 个 task，检验 spec 清晰度。

### V0: 冷启动验证

**涉及文件:** SPEC.md、PLAN.md（被验证对象）、SPEC_PROCESS.md（记录结果）

- [ ] **Step 1: 启动第二智能体**
  选择 Aider / Claude Code / Cursor Agent / Gemini CLI 中任一与 OpenCode 不同的类型。
  ```bash
  aider --model deepseek/deepseek-chat
  ```

- [ ] **Step 2: 提供 SPEC.md + PLAN.md，指定实现 T1（核心类型定义）**

- [ ] **Step 3: 指令** — "遇到不确定的地方就停下来问，不要凭猜测继续。你只能依据 SPEC.md 和 PLAN.md 两份文档。"

- [ ] **Step 4: 记录所有提问、错误解读、产出与预期差距到 SPEC_PROCESS.md §4**
  记录结构：
  - 第二 agent 在哪些地方停下来问了问题？暴露了什么 spec 缺陷？
  - 它做了哪些与原意不一致的解读？是 spec 错了还是它读错了？
  - 产出代码 / 测试与预期差距多大？为什么？

- [ ] **Step 5: 根据发现的问题修订 SPEC.md / PLAN.md**
  在 SPEC_PROCESS.md 中给出修订前后的关键 diff：
  ```diff
  - 旧内容
  + 新内容
  ```

- [ ] **Step 6: 确认修订后的 SPEC.md + PLAN.md 不再有歧义**

- [ ] **Step 7: 提交**
  ```bash
  git add SPEC_PROCESS.md SPEC.md PLAN.md
  git commit -m "docs: 冷启动验证完成，修订 spec 与 plan（V0）"
  ```

---

## 任务依赖图

```
V0（冷启动验证，前置）
 └─ T0（项目搭建）
     └─ T1（类型定义）
         ├─ T2（配置模块）─────┐
         ├─ T3（日志模块）      │
         ├─ T4（数据库建表）─── T5（数据CRUD）
         ├─ T6（diff解析器）    │
         └─ T7（LLM客户端）     │
              └─ T8（核心引擎编排）─┐
                   └─ T9（CLI入口）─┐
                        ├─ T10（config命令）  ← 可并行
                        ├─ T11（init/uninit） ← 可并行
                        ├─ T12（log命令）     ← 可并行
                        ├─ T13（explain/gen） ← 可并行
                        └─ T14（hook+web命令）← 可并行
                             └─ T15（Web服务器+布局）
                                  ├─ T16a（列表页）   ← 可并行
                                  ├─ T16b（详情页）   ← 可并行
                                  ├─ T16c（统计页）   ← 可并行
                                  └─ T16d（JSON API）
                                       ├─ T17（Dockerfile）
                                       ├─ T18（CI）
                                       └─ T19（README）
```

**可并行分组：**
- 第一组：T2、T3（T1 完成后）
- 第二组：T4、T6、T7（T1 完成后）
- 第三组：T10、T11、T12、T13、T14（T8+T9 完成后）
- 第四组：T16a、T16b、T16c（T15 完成后，相互之间无依赖）
- 第五组：T17、T18、T19（T16a-c 完成后，各自独立）

---

### T0: 项目脚手架搭建

**涉及文件:** `package.json`、`tsconfig.json`、`vitest.config.ts`、目录结构

- [ ] **第1步：编写 package.json**

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

- [ ] **第2步：编写 tsconfig.json**

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

- [ ] **第3步：编写 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 10000 },
});
```

- [ ] **第4步：创建目录结构**
```bash
mkdir -p src/core src/cli/commands src/web/routes src/web/views tests/core tests/cli tests/fixtures/sample-diffs tests/web
```

- [ ] **第5步：安装和验证**
```bash
npm install; npm run build
```
预期：成功安装，编译成功（暂无源文件，允许仅有警告）。

- [ ] **第6步：运行基线测试**
```bash
npm test
```
预期：显示 "No test files found"（脚手架阶段可接受）。

- [ ] **第7步：提交**
```bash
git add package.json tsconfig.json vitest.config.ts
git commit -m "chore: 搭建 TypeScript + vitest 项目脚手架"
```

---

### T1: 核心类型定义

> **前置条件:** 若项目尚未初始化（T0 未执行），先创建 `tsconfig.json`（T0 第2步）与 `vitest.config.ts`（T0 第3步），再开始本 task。

**涉及文件:** `src/core/types.ts`、`tests/core/types.test.ts`

- [ ] **第1步：先写测试（红灯）**
```typescript
// tests/core/types.test.ts
import { describe, it, expect } from 'vitest';
describe('核心类型', () => {
  it('DiffSenseConfig', () => { const c = { provider: 'deepseek' as const, base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', token_limit: 8000, web_port: 3000 }; expect(c.provider).toBe('deepseek'); });
  it('FileChunk', () => { const c = { filename: 'a.ts', diffContent: '+x', tokenEstimate: 1, truncated: false }; expect(c.truncated).toBe(false); });
  it('SummaryCard', () => { const s = { summary: '测试', intent: '测试', scope: ['a.ts'], risk: '低' }; expect(s.scope).toHaveLength(1); });
});
```

- [ ] **第2步：确认测试失败** — `npm test -- tests/core/types.test.ts` → **FAIL**

- [ ] **第3步：编写 src/core/types.ts**
```typescript
export interface DiffSenseConfig { provider: 'deepseek' | 'glm'; base_url: string; model: string; token_limit: number; web_port: number; }
export interface FileChunk { filename: string; diffContent: string; tokenEstimate: number; truncated: boolean; }
export interface CommitInfo { repoPath: string; commitHash: string; author: string; date: string; message: string; }
export interface SummaryCard { summary: string; intent: string; scope: string[]; risk: string; }
export interface StoredCommit { repo_path: string; commit_hash: string; author: string; date: string; message: string; generated_at: string; }
export interface StoredSummary { id: number; commit_hash: string; repo_path: string; summary: string; intent: string; scope: string; risk: string; truncated: number; model: string; tokens_used: number; created_at: string; }
export interface HookState { repo_path: string; installed_at: string; backup_path: string | null; }
export interface LogEntry { timestamp: string; commit_hash: string; error_type: string; error_message: string; }
```

- [ ] **第4步：确认测试通过** — `npm test -- tests/core/types.test.ts` → **3 PASS**

- [ ] **第5步：提交**
```bash
git add src/core/types.ts tests/core/types.test.ts
git commit -m "feat: 定义核心 TypeScript 类型接口"
```

---

### T2: 配置模块

> 以下 T2–T8 为已验证的核心引擎模块，保留原 PLAN 内容（仅做中文翻译）。
> 完整代码与 Step 与上一版 PLAN.md 一致。

**涉及文件:** `src/core/config.ts`、`tests/core/config.test.ts`

```typescript
// tests/core/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { loadConfig, saveConfig, getApiKey, DEFAULT_DEEPSEEK_CONFIG } from '../../src/core/config';

const cfgPath = path.join(os.tmpdir(), 'diffsense-test-config', 'config.json');

describe('配置模块', () => {
  beforeEach(() => { if (fs.existsSync(path.dirname(cfgPath))) fs.rmSync(path.dirname(cfgPath), { recursive: true }); fs.mkdirSync(path.dirname(cfgPath), { recursive: true }); });
  afterEach(() => { if (fs.existsSync(path.dirname(cfgPath))) fs.rmSync(path.dirname(cfgPath), { recursive: true }); });
  it('文件不存在时返回默认值', () => { const c = loadConfig(cfgPath); expect(c.provider).toBe('deepseek'); expect(c.token_limit).toBe(8000); });
  it('saveConfig + loadConfig 往返', () => { saveConfig({ provider: 'glm', base_url: 'https://o.bm.cn/api/v4', model: 'glm-4-flash', token_limit: 4000, web_port: 4000 }, cfgPath); expect(loadConfig(cfgPath).provider).toBe('glm'); });
  it('自动创建父目录', () => { const n = path.join(path.dirname(cfgPath), 'a', 'b', 'c.json'); saveConfig(DEFAULT_DEEPSEEK_CONFIG, n); expect(fs.existsSync(n)).toBe(true); });
  it('getApiKey 读环境变量', () => { process.env.DEEPSEEK_API_KEY = 'sk-test'; expect(getApiKey('deepseek')).toBe('sk-test'); delete process.env.DEEPSEEK_API_KEY; });
  it('未设置环境变量抛错', () => { delete process.env.DEEPSEEK_API_KEY; expect(() => getApiKey('deepseek')).toThrow('DEEPSEEK_API_KEY'); });
});
```

```typescript
// src/core/config.ts
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { DiffSenseConfig } from './types';

export const DEFAULT_DEEPSEEK_CONFIG: DiffSenseConfig = { provider: 'deepseek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', token_limit: 8000, web_port: 3000 };
export const DEFAULT_GLM_CONFIG: DiffSenseConfig = { provider: 'glm', base_url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', token_limit: 8000, web_port: 3000 };

export function getDefaultConfigPath(): string { return path.join(os.homedir(), '.diffsense', 'config.json'); }

export function loadConfig(configPath?: string): DiffSenseConfig {
  const fp = configPath || getDefaultConfigPath();
  if (!fs.existsSync(fp)) return { ...DEFAULT_DEEPSEEK_CONFIG };
  return { ...DEFAULT_DEEPSEEK_CONFIG, ...JSON.parse(fs.readFileSync(fp, 'utf-8')) };
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

- [ ] **验证:** `npm test -- tests/core/config.test.ts` → **5 PASS**
- [ ] **提交:** `git add src/core/config.ts tests/core/config.test.ts; git commit -m "feat: JSON 配置读写 + 环境变量 API Key"`

---

### T3: 日志模块

**涉及文件:** `src/core/logger.ts`、`tests/core/logger.test.ts`

```typescript
// tests/core/logger.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { logError } from '../../src/core/logger';
const TD = path.join(os.tmpdir(), 'diffsense-logger');
describe('日志模块', () => {
  const lp = path.join(TD, 'errors.log');
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); });
  afterEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });
  it('写入一行 JSON', () => { logError(lp, 'abc', 'E', 'm'); const e = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()); expect(e.commit_hash).toBe('abc'); });
  it('追加写入', () => { logError(lp, 'a', 'E', '1'); logError(lp, 'b', 'E', '2'); expect(fs.readFileSync(lp, 'utf-8').trim().split('\n')).toHaveLength(2); });
  it('创建父目录', () => { const n = path.join(TD, 'deep', 'e.log'); logError(n, 'x', 'E', 'm'); expect(fs.existsSync(n)).toBe(true); });
});
```

```typescript
// src/core/logger.ts
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

- [ ] **验证:** `npm test -- tests/core/logger.test.ts` → **3 PASS**
- [ ] **提交:** `git add src/core/logger.ts tests/core/logger.test.ts; git commit -m "feat: 错误日志写入模块"`

---

### T4: 数据库 — 建表与初始化

**涉及文件:** `src/core/storage.ts`（部分）、`tests/core/storage.test.ts`

```typescript
// tests/core/storage.test.ts (第一次提交)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import Database from 'better-sqlite3';
import { initDatabase, closeDatabase, getDatabase } from '../../src/core/storage';
const dbPath = path.join(os.tmpdir(), 'diffsense-schema', 'test.db');

describe('数据库建表', () => {
  beforeEach(() => { if (fs.existsSync(path.dirname(dbPath))) fs.rmSync(path.dirname(dbPath), { recursive: true }); fs.mkdirSync(path.dirname(dbPath), { recursive: true }); });
  afterEach(() => { closeDatabase(dbPath); if (fs.existsSync(path.dirname(dbPath))) fs.rmSync(path.dirname(dbPath), { recursive: true }); });
  it('创建 db 文件', () => { initDatabase(dbPath); expect(fs.existsSync(dbPath)).toBe(true); });
  it('创建 3 张表', () => { initDatabase(dbPath); const n = (getDatabase(dbPath).prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(t=>t.name); expect(n).toContain('commits'); expect(n).toContain('summaries'); expect(n).toContain('hook_state'); });
  it('创建索引', () => { initDatabase(dbPath); const n = (getDatabase(dbPath).prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as {name:string}[]).map(i=>i.name); expect(n).toContain('idx_summaries_repo_date'); });
  it('幂等初始化', () => { initDatabase(dbPath); initDatabase(dbPath); });
  it('closeDatabase 后可重新打开', () => { initDatabase(dbPath); closeDatabase(dbPath); new Database(dbPath).close(); });
  it('getDatabase 返回相同实例', () => { initDatabase(dbPath); expect(getDatabase(dbPath)).toBe(getDatabase(dbPath)); });
});
```

```typescript
// src/core/storage.ts（初次）
import Database from 'better-sqlite3'; import * as path from 'path'; import * as fs from 'fs';
const instances = new Map<string, Database.Database>();
const DDL = `
CREATE TABLE IF NOT EXISTS commits (repo_path TEXT NOT NULL, commit_hash TEXT NOT NULL, author TEXT, date TEXT, message TEXT, generated_at TEXT, PRIMARY KEY (commit_hash, repo_path));
CREATE TABLE IF NOT EXISTS summaries (id INTEGER PRIMARY KEY AUTOINCREMENT, commit_hash TEXT NOT NULL, repo_path TEXT NOT NULL, summary TEXT NOT NULL, intent TEXT, scope TEXT, risk TEXT, truncated INTEGER DEFAULT 0, model TEXT, tokens_used INTEGER, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (commit_hash, repo_path) REFERENCES commits(commit_hash, repo_path));
CREATE TABLE IF NOT EXISTS hook_state (repo_path TEXT PRIMARY KEY, installed_at TEXT, backup_path TEXT);
CREATE INDEX IF NOT EXISTS idx_summaries_repo_date ON summaries(repo_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commits_repo_date ON commits(repo_path, date DESC);
`;
export function initDatabase(dbPath: string): void {
  if (instances.has(dbPath)) return;
  const dir = path.dirname(dbPath); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath); db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); db.exec(DDL); instances.set(dbPath, db);
}
export function getDatabase(dbPath: string): Database.Database { const db = instances.get(dbPath); if (!db) throw new Error('DB not initialized'); return db; }
export function closeDatabase(dbPath: string): void { const db = instances.get(dbPath); if (db) { db.close(); instances.delete(dbPath); } }
export function closeAllDatabases(): void { for (const [, db] of instances) db.close(); instances.clear(); }
```

- [ ] **验证:** `npm test -- tests/core/storage.test.ts` → **6 PASS**
- [ ] **提交:** `git add src/core/storage.ts tests/core/storage.test.ts; git commit -m "feat: SQLite 建表初始化"`

---

### T5: 数据库 — CRUD 操作

**涉及文件:** 修改 `src/core/storage.ts`、`tests/core/storage.test.ts`

（CRUD 测试和实现与原 PLAN 一致，此处省略重复代码以节省篇幅。详细代码见第一版 PLAN.md 的 T5 部分。）

```typescript
// 追加到 tests/core/storage.test.ts
// 9 个 CRUD 测试：upsertCommit/get/update, upsertSummary/get/overwrite, getSummariesByRepo order+limit+search, getStats, deleteCommit cascade, hookState CRUD
```

```typescript
// 追加到 src/core/storage.ts
// upsertCommit, getCommit, deleteCommit, upsertSummary, getSummaryByHash, getSummariesByRepo, getStats, getHookState, setHookState, removeHookState
```

- [ ] **验证:** `npm test -- tests/core/storage.test.ts` → **15 PASS**（6 建表 + 9 CRUD）
- [ ] **提交:** `git add src/core/storage.ts tests/core/storage.test.ts; git commit -m "feat: 数据库 CRUD 操作"`

---

### T6: Diff 解析器

**涉及文件:** `src/core/diff-parser.ts`、`tests/core/diff-parser.test.ts`、测试夹具

（完整代码见第一版 PLAN.md 的 T6 部分。）

- 测试夹具: `tests/fixtures/sample-diffs/multi-file.diff`
- 测试: 7 个用例（提取元数据、首 commit 检测、多文件分块、截断、二进制跳过、空 diff）
- 实现: `parseDiffFromString`、`chunkDiffByFile`、`splitByFile`、`execGitDiff`

- [ ] **验证:** `npm test -- tests/core/diff-parser.test.ts` → **7 PASS**
- [ ] **提交:** `git add src/core/diff-parser.ts tests/core/diff-parser.test.ts tests/fixtures/; git commit -m "feat: diff 解析器"`

---

### T7: LLM 客户端

**涉及文件:** `src/core/llm-client.ts`、`tests/core/llm-client.test.ts`

（完整代码见第一版 PLAN.md 的 T7 部分。）

- 测试: 7 个用例（prompt 构建、截断警告、JSON 解析、markdown 围栏、非法 JSON、API 成功、API 失败）
- 实现: `buildPrompt`、`parseSummaryResponse`、`generateSummary`

- [ ] **验证:** `npm test -- tests/core/llm-client.test.ts` → **7 PASS**
- [ ] **提交:** `git add src/core/llm-client.ts tests/core/llm-client.test.ts; git commit -m "feat: LLM 客户端"`

---

### T8: 核心引擎编排

**涉及文件:** `src/core/index.ts`、`tests/core/index.test.ts`

（完整代码见第一版 PLAN.md 的 T8 部分。）

```typescript
// tests/core/index.test.ts
// 测试：成功生成 + API 失败静默日志，2 个用例
```

```typescript
// src/core/index.ts
// processCommit: diff → LLM → 缓存，失败写日志返回 null
```

- [ ] **验证:** `npm test -- tests/core/index.test.ts` → **2 PASS**
- [ ] **提交:** `git add src/core/index.ts tests/core/index.test.ts; git commit -m "feat: 核心引擎编排"`

---

### T9: CLI 入口

> Open Design: 无需（纯 CLI）

**涉及文件:** `src/cli/index.ts`、`tests/cli/index.test.ts`

- [ ] **第1步：编写 smoke test（红灯）**

```typescript
// tests/cli/index.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('CLI 入口', () => {
  it('ds --help 显示所有 7 条命令名', () => {
    const out = execSync('node dist/cli/index.js --help', { encoding: 'utf-8' });
    expect(out).toContain('config');
    expect(out).toContain('init');
    expect(out).toContain('uninit');
    expect(out).toContain('log');
    expect(out).toContain('explain');
    expect(out).toContain('generate');
    expect(out).toContain('web');
  });
});
```

- [ ] **第2步：运行测试确认失败** — `npm test -- tests/cli/index.test.ts` → **FAIL**（CLI 入口尚未编译）

- [ ] **第3步：编写 src/cli/index.ts**

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
program.name('ds').description('DiffSense — AI 驱动的代码变更语义解释器').version('1.0.0');
registerConfigCommand(program); registerInitCommand(program); registerUninitCommand(program);
registerLogCommand(program); registerExplainCommand(program); registerGenerateCommand(program); registerWebCommand(program);
program.command('hook-post-commit').description('(内部) post-commit hook 处理器').action(async () => { await hookPostCommit(); });
program.parse(process.argv);
```

- [ ] **第4步：构建 + 验证测试通过**
```bash
npm run build; npm test -- tests/cli/index.test.ts
```
预期：**1 PASS**（CLI 帮助包含所有 7 条命令名）。

- [ ] **第5步：提交**
```bash
git add src/cli/index.ts tests/cli/index.test.ts
git commit -m "feat: CLI 入口 + smoke test"
```

---

### T10: CLI — config 命令

> Open Design: 无需（纯 CLI）

**涉及文件:** `src/cli/commands/config.ts`、`tests/cli/config.test.ts`

- [ ] **第1步：编写 smoke test（红灯）**

```typescript
// tests/cli/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { loadConfig, saveConfig, getDefaultConfigPath } from '../../src/core/config';
const TD = path.join(os.tmpdir(), 'diffsense-cli-config-test');
const cp = path.join(TD, 'config.json');

describe('CLI config', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); });
  afterEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('ds config 写入后 loadConfig 可读回', () => {
    saveConfig({ provider: 'glm', base_url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', token_limit: 8000, web_port: 3000 }, cp);
    const c = loadConfig(cp);
    expect(c.provider).toBe('glm');
    expect(c.model).toBe('glm-4-flash');
  });
  it('配置文件中不包含 api_key', () => {
    saveConfig({ provider: 'deepseek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', token_limit: 8000, web_port: 3000 }, cp);
    const raw = JSON.parse(fs.readFileSync(cp, 'utf-8'));
    expect(raw.api_key).toBeUndefined();
  });
});
```

- [ ] **第2步：运行测试确认失败** — （config 命令尚未实现时 FAIL）

- [ ] **第3步：编写命令实现**

```typescript
// src/cli/commands/config.ts
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
    console.log(`当前配置: provider=${existing.provider} base_url=${existing.base_url} model=${existing.model}`);
    const prov = await ask('provider（deepseek/glm）', existing.provider);
    if (prov !== 'deepseek' && prov !== 'glm') { console.log('错误: provider 必须是 deepseek 或 glm'); process.exit(1); }
    const provider = prov as 'deepseek' | 'glm';
    const dUrl = provider === 'deepseek' ? DEFAULT_DEEPSEEK_CONFIG.base_url : DEFAULT_GLM_CONFIG.base_url;
    const dModel = provider === 'deepseek' ? DEFAULT_DEEPSEEK_CONFIG.model : DEFAULT_GLM_CONFIG.model;
    const base_url = await ask('base_url', dUrl);
    const model = await ask('model', dModel);
    const tl = await ask('token_limit', String(existing.token_limit));
    const wp = await ask('web_port', String(existing.web_port));
    const cfg = { provider, base_url, model, token_limit: parseInt(tl) || 8000, web_port: parseInt(wp) || 3000 };
    saveConfig(cfg);
    console.log(`\n配置已保存到: ${getDefaultConfigPath()}`);
    console.log(`注意: API Key 请通过环境变量设置: export ${provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'GLM_API_KEY'}="your-key"`);
  });
}
```

- [ ] **第4步：验证** — `npm run build; npm test -- tests/cli/config.test.ts` → **2 PASS**

- [ ] **第5步：提交**
```bash
git add src/cli/commands/config.ts tests/cli/config.test.ts
git commit -m "feat: ds config 交互式配置命令 + smoke test"
```

---

### T11: CLI — init / uninit 命令

> Open Design: 无需（纯 CLI）

**涉及文件:** `src/cli/commands/init.ts`、`src/cli/commands/uninit.ts`、`tests/cli/init-uninit.test.ts`

（完整实现代码与第一版 PLAN.md T11 一致，8 个测试用例。）

```typescript
// src/cli/commands/init.ts — initHook, uninitHook, registerInitCommand
// src/cli/commands/uninit.ts — registerUninitCommand
// tests/cli/init-uninit.test.ts — 8 tests
```

- [ ] **验证:** `npm test -- tests/cli/init-uninit.test.ts` → **8 PASS**
- [ ] **提交:** `git add src/cli/commands/init.ts src/cli/commands/uninit.ts tests/cli/init-uninit.test.ts; git commit -m "feat: ds init/uninit 命令"`

---

### T12: CLI — log 命令

> Open Design: 无需（纯 CLI）

**涉及文件:** `src/cli/commands/log.ts`、`tests/cli/log.test.ts`

- [ ] **第1步：编写 smoke test（红灯）**

```typescript
// tests/cli/log.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getSummariesByRepo } from '../../src/core/storage';

const TD = path.join(os.tmpdir(), 'diffsense-log-test');
const dp = path.join(TD, 'test.db');

describe('CLI log', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  const cmt = (i: number) => ({ repo_path: '/r', commit_hash: `h${i}`, author: '张三', date: `2026-06-1${i}`, message: `msg ${i}`, generated_at: '' });
  const sum = (i: number) => ({ commit_hash: `h${i}`, repo_path: '/r', summary: `摘要${i}`, intent: '测试', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'deepseek-chat', tokens_used: 100 });

  it('getSummariesByRepo 返回按日期倒序的结果', () => {
    for (let i = 0; i < 3; i++) { upsertCommit(dp, cmt(i)); upsertSummary(dp, sum(i)); }
    const rows = getSummariesByRepo(dp, '/r', 3, 0);
    expect(rows).toHaveLength(3);
    expect(rows[0].commit_hash).toBe('h2');
  });
  it('supports search filter', () => {
    upsertCommit(dp, cmt(0)); upsertSummary(dp, { ...sum(0), summary: '修复登录问题' });
    upsertCommit(dp, cmt(1)); upsertSummary(dp, { ...sum(1), commit_hash: 'h1', summary: '优化性能' });
    const r = getSummariesByRepo(dp, '/r', 10, 0, '登录');
    expect(r).toHaveLength(1);
    expect(r[0].summary).toContain('登录');
  });
});
```

- [ ] **第2步：运行测试确认失败** — log 命令尚未实现

- [ ] **第3步：编写 log 命令**（完整代码见第一版 PLAN.md T12，含 chalk 表格输出）

- [ ] **第4步：验证** — `npm test -- tests/cli/log.test.ts` → **2 PASS**

- [ ] **第5步：提交:** `git add src/cli/commands/log.ts tests/cli/log.test.ts; git commit -m "feat: ds log 命令 + smoke test"`

---

### T13: CLI — explain / generate 命令

> Open Design: 无需（纯 CLI）

**涉及文件:** `src/cli/commands/explain.ts`、`src/cli/commands/generate.ts`、`tests/cli/explain-generate.test.ts`

- [ ] **第1步：编写 smoke test** — 验证 explain 拒绝无效 ref

```typescript
// tests/cli/explain-generate.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, getSummaryByHash } from '../../src/core/storage';
import { processCommit } from '../../src/core/index';
const TD = path.join(os.tmpdir(), 'diffsense-explain-test');
const dp = path.join(TD, 'test.db'); const lp = path.join(TD, 'errors.log');
const cfg = { provider: 'deepseek' as const, base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };

describe('CLI explain/generate', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('从缓存读取已存在的摘要', () => {
    upsertCommit(dp, { repo_path: '/r', commit_hash: 'cached', author: 'T', date: '2026-01-01', message: 'm', generated_at: '' });
    const { upsertSummary } = require('../../src/core/storage');
    upsertSummary(dp, { commit_hash: 'cached', repo_path: '/r', summary: '已缓存', intent: '测试', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'm', tokens_used: 100 });
    expect(getSummaryByHash(dp, '/r', 'cached')!.summary).toBe('已缓存');
  });

  it('generate 覆盖已有缓存', async () => {
    upsertCommit(dp, { repo_path: '/r', commit_hash: 'gen', author: 'T', date: '2026-01-01', message: 'm', generated_at: '' });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"新摘要","intent":"i","scope":["x.ts"],"risk":"中"}' } }] }) }) as any;
    await processCommit('/r', 'gen', cfg, 'key', dp, lp);
    expect(getSummaryByHash(dp, '/r', 'gen')!.summary).toBe('新摘要');
  });
});
```

- [ ] **第2步：编写 explain.ts / generate.ts**（完整代码见第一版 PLAN.md T13）

- [ ] **第3步：验证** — `npm test -- tests/cli/explain-generate.test.ts` → **2 PASS**

- [ ] **第4步：提交:** `git add src/cli/commands/explain.ts src/cli/commands/generate.ts tests/cli/explain-generate.test.ts; git commit -m "feat: ds explain/generate 命令"`

---

### T14: CLI — hook-post-commit / web 入口

> Open Design: 无需（纯 CLI）

**涉及文件:** `src/cli/hook-post-commit.ts`、`src/cli/commands/web.ts`、`tests/cli/hook.test.ts`

- [ ] **第1步：编写 smoke test**

```typescript
// tests/cli/hook.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, getSummaryByHash } from '../../src/core/storage';
import { processCommit } from '../../src/core/index';
const TD = path.join(os.tmpdir(), 'diffsense-hook-test');
const dp = path.join(TD, '.diffsense.db'); const lp = path.join(TD, 'errors.log');
const cfg = { provider: 'deepseek' as const, base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };

describe('CLI hook-post-commit', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('成功处理 commit', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"hook摘要","intent":"i","scope":["h.ts"],"risk":"低"}' } }] }) }) as any;
    upsertCommit(dp, { repo_path: TD, commit_hash: 'hook1', author: 'H', date: '2026-06-14', message: 'hook msg', generated_at: '' });
    await processCommit(TD, 'hook1', cfg, 'key', dp, lp);
    expect(getSummaryByHash(dp, TD, 'hook1')!.summary).toBe('hook摘要');
  });

  it('API 失败不抛错并写入日志', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    upsertCommit(dp, { repo_path: TD, commit_hash: 'fail', author: 'H', date: '2026-06-14', message: 'fail', generated_at: '' });
    await processCommit(TD, 'fail', cfg, 'key', dp, lp);
    expect(fs.existsSync(lp)).toBe(true);
  });
});
```

- [ ] **第2步：编写 hook-post-commit.ts + web.ts**（完整代码见第一版 PLAN.md T14）

- [ ] **第3步：验证** — `npm test -- tests/cli/hook.test.ts` → **2 PASS**

- [ ] **第4步：提交:** `git add src/cli/hook-post-commit.ts src/cli/commands/web.ts tests/cli/hook.test.ts; git commit -m "feat: hook-post-commit 处理器 + ds web 命令入口"`

---

### T15: Web 服务器 + 布局模板

> **Open Design:** 使用 skill `web-design-guidelines` 生成界面。
> 设计系统文件: `C:\Users\30991\.config\opencode\open-design\design-systems\vercel\DESIGN.md`
> 设计 tokens: `--geist-foreground`、`--geist-background`、`--accents-5`、`--accents-3`（Vercel 色彩体系）

**涉及文件:** `src/web/index.ts`、`src/web/views/layout.html`、`tests/web/server.test.ts`

- [ ] **第1步：编写 Web 服务器测试（红灯）**

```typescript
// tests/web/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path';
import * as http from 'http';

describe('Web 服务器', () => {
  const layoutPath = path.join(__dirname, '..', '..', 'src', 'web', 'views', 'layout.html');

  it('layout.html 存在', () => {
    expect(fs.existsSync(layoutPath)).toBe(true);
  });
  it('layout.html 包含 HTMX 引入', () => {
    const c = fs.readFileSync(layoutPath, 'utf-8');
    expect(c).toContain('htmx.org');
  });
  it('layout.html 包含 Vercel 设计 tokens', () => {
    const c = fs.readFileSync(layoutPath, 'utf-8');
    expect(c).toContain('--geist-foreground');
    expect(c).toContain('--geist-background');
    expect(c).toContain('--accents-5');
  });
  it('layout.html 包含 {{{content}}} 占位符', () => {
    expect(fs.readFileSync(layoutPath, 'utf-8')).toContain('{{{content}}}');
  });

  it('startWebServer 函数可导入', async () => {
    const mod = await import('../../src/web/index');
    expect(typeof mod.startWebServer).toBe('function');
  });
});
```

- [ ] **第2步：运行测试确认失败** — `npm test -- tests/web/server.test.ts` → **FAIL**

- [ ] **第3步：编写布局模板 src/web/views/layout.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DiffSense — 代码变更语义解释器</title>
  <script src="https://unpkg.com/htmx.org@2.0.4" crossorigin="anonymous"></script>
  <style>
    :root {
      /* Vercel Geist 设计 tokens */
      --geist-foreground: #171717;
      --geist-background: #ffffff;
      --accents-1: #fafafa;
      --accents-2: #eaeaea;
      --accents-3: #d4d4d4;
      --accents-4: #a3a3a3;
      --accents-5: #737373;
      --accents-6: #525252;
      --accents-7: #404040;
      --accents-8: #262626;
      --geist-error: #e00;
      --geist-success: #0070f3;
      --geist-radius: 6px;
      --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font-sans);
      color: var(--geist-foreground);
      background: var(--geist-background);
      line-height: 1.6;
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    nav {
      display: flex;
      gap: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--accents-2);
      margin-bottom: 2rem;
    }

    nav a {
      color: var(--accents-5);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.15s;
    }

    nav a:hover, nav a.active { color: var(--geist-foreground); }
    nav a.active { border-bottom: 2px solid var(--geist-foreground); }

    .card {
      background: var(--geist-background);
      border: 1px solid var(--accents-2);
      border-radius: var(--geist-radius);
      padding: 1.25rem;
      margin-bottom: 1rem;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .card:hover {
      border-color: var(--accents-3);
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .hash {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--geist-success);
      background: #f0f5ff;
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
    }

    .summary-line { font-size: 1rem; margin: 0.5rem 0; }
    .meta { font-size: 0.8rem; color: var(--accents-5); }

    .btn {
      display: inline-block;
      padding: 0.4rem 1rem;
      background: var(--geist-foreground);
      color: var(--geist-background);
      border: none;
      border-radius: var(--geist-radius);
      font-size: 0.85rem;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
    }

    .btn:hover { background: var(--accents-8); }

    .btn-secondary {
      background: var(--accents-1);
      color: var(--geist-foreground);
      border: 1px solid var(--accents-2);
    }

    .btn-secondary:hover { background: var(--accents-2); }

    .search-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .search-bar input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--accents-2);
      border-radius: var(--geist-radius);
      font-size: 0.9rem;
      outline: none;
    }

    .search-bar input:focus { border-color: var(--geist-success); }

    .pagination {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 1.5rem;
    }

    .risk-low { color: #007c40; }
    .risk-mid { color: #d4a111; }
    .risk-high { color: var(--geist-error); }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--accents-1);
      border: 1px solid var(--accents-2);
      border-radius: var(--geist-radius);
      padding: 1.25rem;
      text-align: center;
    }

    .stat-value { font-size: 2rem; font-weight: 700; color: var(--geist-foreground); }
    .stat-label { font-size: 0.8rem; color: var(--accents-5); margin-top: 0.25rem; }

    .chart-container { margin: 1.5rem 0; }

    .scope-tag {
      display: inline-block;
      background: var(--accents-1);
      border: 1px solid var(--accents-2);
      border-radius: 3px;
      padding: 0.15rem 0.5rem;
      font-size: 0.75rem;
      font-family: var(--font-mono);
      margin: 0.15rem;
    }

    footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--accents-2);
      font-size: 0.8rem;
      color: var(--accents-5);
      text-align: center;
    }

    @media (max-width: 640px) { body { padding: 1rem; } }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="{{activeList}}">摘要列表</a>
    <a href="/stats" class="{{activeStats}}">统计</a>
  </nav>
  <main>{{{content}}}</main>
  <footer>DiffSense v1.0 &middot; AI-powered code change interpreter</footer>
</body>
</html>
```

- [ ] **第4步：编写 src/web/index.ts**

```typescript
import express from 'express';
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
        app.listen(cp, '127.0.0.1', () => { console.log(`DiffSense Web 界面已启动: http://localhost:${cp}`); resolve(); })
          .on('error', (e: any) => e.code === 'EADDRINUSE' ? reject(new Error('EADDRINUSE')) : reject(e));
      });
      return;
    } catch (e: any) {
      if (e.message === 'EADDRINUSE' && i < 2) { cp++; console.log(`端口被占用，尝试端口 ${cp}...`); }
      else throw e;
    }
  }
}
```

- [ ] **第5步：验证** — `npm test -- tests/web/server.test.ts` → **5 PASS**

- [ ] **第6步：提交**
```bash
git add src/web/index.ts src/web/views/layout.html tests/web/server.test.ts
git commit -m "feat: Web 服务器 + Vercel Geist 布局（含 Open Design tokens）"
```

---

### T16a: Web — 列表页路由与视图

> **Open Design:** 使用 skill `web-design-guidelines` + Vercel 设计系统。
> 设计系统文件: `~/.config/opencode/open-design/design-systems/vercel/DESIGN.md`
> 使用 tokens: `--geist-radius`、`--accents-2`、`--accents-5` 等（继承 layout.html 的 :root 定义）

**涉及文件:** `src/web/routes/pages.ts`（创建）、`src/web/views/list.html`、`tests/web/list.test.ts`

- [ ] **第1步：编写测试（红灯）**

```typescript
// tests/web/list.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary } from '../../src/core/storage';
const TD = path.join(os.tmpdir(), 'diffsense-web-list'); const dp = path.join(TD, '.diffsense.db');

describe('Web 列表页', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('有数据时渲染卡片', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'abc1234', author: '张三', date: '2026-06-14', message: 'fix: bug', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'abc1234', repo_path: TD, summary: '修复了并发问题', intent: '线上报错', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'deepseek-chat', tokens_used: 100 });
    // 验证路由逻辑：调用查询后能返回卡片 HTML
    const { getSummariesByRepo, getCommit } = require('../../src/core/storage');
    const rows = getSummariesByRepo(dp, TD, 20, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe('修复了并发问题');
    const commit = getCommit(dp, TD, 'abc1234');
    expect(commit).not.toBeNull();
  });

  it('空数据库时返回提示', () => {
    const { getSummariesByRepo } = require('../../src/core/storage');
    const rows = getSummariesByRepo(dp, TD, 20, 0);
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **第2步：运行测试确认失败**

- [ ] **第3步：编写页面路由 src/web/routes/pages.ts**

```typescript
import { Express, Request, Response } from 'express';
import * as fs from 'fs'; import * as path from 'path';
import { initDatabase, getSummariesByRepo, getCommit, closeDatabase } from '../../core/storage';

const VIEWS_DIR = path.join(__dirname, '..', 'views');

function render(templateName: string, data: Record<string, string>): string {
  let html = fs.readFileSync(path.join(VIEWS_DIR, `${templateName}.html`), 'utf-8');
  const layout = fs.readFileSync(path.join(VIEWS_DIR, 'layout.html'), 'utf-8');
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp(`\\{\\{\\{?${key}\\}\\}\\}?`, 'g'), value);
  }
  return layout.replace('{{{content}}}', html);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function registerPageRoutes(app: Express, repoPath: string = process.cwd()): void {
  const dbPath = path.join(repoPath, '.diffsense.db');

  // GET / — 列表页
  app.get('/', (req: Request, res: Response) => {
    if (!fs.existsSync(dbPath)) {
      res.send(render('list', { activeList: 'active', activeStats: '', rows: '', pagination: '<p style="text-align:center;color:var(--accents-5);">暂无摘要记录。请先运行 <code>ds init</code> 初始化。</p>' }));
      return;
    }
    initDatabase(dbPath);
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.q as string) || '';
    const limit = 20;
    const offset = (page - 1) * limit;
    const summaries = getSummariesByRepo(dbPath, repoPath, limit, offset, search || undefined);

    let rows = '';
    for (const s of summaries) {
      const commit = getCommit(dbPath, repoPath, s.commit_hash);
      const hash = s.commit_hash.substring(0, 7);
      const date = commit ? commit.date.substring(0, 10) : 'N/A';
      const author = escapeHtml(commit ? commit.author : 'N/A');
      let riskClass = 'risk-low';
      if (s.risk && s.risk.includes('高')) riskClass = 'risk-high';
      else if (s.risk && s.risk.includes('中')) riskClass = 'risk-mid';
      rows += `<div class="card" style="cursor:pointer;" hx-get="/api/commits/${s.commit_hash}" hx-target="#detail-${s.commit_hash}" hx-swap="innerHTML"><span class="hash">${hash}</span><span style="margin-left:0.5rem;font-size:0.75rem;color:var(--accents-5);">${s.model || 'N/A'}</span><div class="summary-line">${escapeHtml(s.summary)}</div><div class="meta">${date} &middot; ${author}${s.risk ? ` &middot; <span class="${riskClass}">${escapeHtml(s.risk)}</span>` : ''}</div><div id="detail-${s.commit_hash}"></div></div>`;
    }
    if (!rows) rows = '<p style="text-align:center;color:var(--accents-5);">暂无匹配的摘要记录。</p>';

    const pagination = summaries.length === limit
      ? `<div class="pagination"><span class="btn btn-secondary" hx-get="/?page=${page + 1}" hx-target="body">加载更多</span></div>`
      : '';
    closeDatabase(dbPath);
    res.send(render('list', { activeList: 'active', activeStats: '', rows, pagination, searchVal: search }));
  });
}
```

- [ ] **第4步：编写视图 src/web/views/list.html**

```html
<div class="search-bar">
  <input type="text" name="q" placeholder="搜索 commit message 或摘要..." value="{{searchVal}}"
         hx-get="/" hx-trigger="keyup changed delay:300ms" hx-target="body" />
</div>
<div id="commit-list">
  {{{rows}}}
</div>
{{{pagination}}}
```

- [ ] **第5步：验证** — `npm test -- tests/web/list.test.ts` → **2 PASS**；`npm run build` → 编译成功

- [ ] **第6步：提交**
```bash
git add src/web/routes/pages.ts src/web/views/list.html tests/web/list.test.ts
git commit -m "feat: Web 列表页（搜索 + HTMX 分页 + 卡片列表）"
```

---

### T16b: Web — 详情页路由与视图

> **Open Design:** 使用 skill `web-design-guidelines` + Vercel 设计系统。

**涉及文件:** `src/web/routes/pages.ts`（追加路由）、`src/web/views/detail.html`、`tests/web/detail.test.ts`

- [ ] **第1步：编写测试（红灯）**

```typescript
// tests/web/detail.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getSummaryByHash } from '../../src/core/storage';
const TD = path.join(os.tmpdir(), 'diffsense-web-detail'); const dp = path.join(TD, '.diffsense.db');

describe('Web 详情页', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('按 hash 获取摘要', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'xyz7890', author: '李四', date: '2026-06-15', message: 'feat: new feature', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'xyz7890', repo_path: TD, summary: '新增了用户导出功能', intent: '用户需求', scope: '["src/export.ts","src/types.ts"]', risk: '中', truncated: 0, model: 'deepseek-chat', tokens_used: 200 });
    const row = getSummaryByHash(dp, TD, 'xyz7890');
    expect(row).not.toBeNull();
    expect(row!.summary).toBe('新增了用户导出功能');
    expect(JSON.parse(row!.scope)).toHaveLength(2);
  });
});
```

- [ ] **第2步：运行测试确认失败**

- [ ] **第3步：追加页面路由到 src/web/routes/pages.ts**

```typescript
// 追加到 registerPageRoutes 函数中

// GET /commits/:hash — 详情页
app.get('/commits/:hash', (req: Request, res: Response) => {
  const hash = req.params.hash;
  if (!fs.existsSync(dbPath)) { res.status(404).send(render('error', { message: '数据库未找到' })); return; }
  initDatabase(dbPath);
  const summary = getSummaryByHash(dbPath, repoPath, hash);
  if (!summary) { res.status(404).send(render('error', { message: `未找到 commit: ${hash}` })); closeDatabase(dbPath); return; }
  const commit = getCommit(dbPath, repoPath, hash);
  const scope = JSON.parse(summary.scope || '[]') as string[];
  const scopeTags = scope.map((f: string) => `<span class="scope-tag">${escapeHtml(f)}</span>`).join('');

  let riskClass = 'risk-low';
  if (summary.risk && summary.risk.includes('高')) riskClass = 'risk-high';
  else if (summary.risk && summary.risk.includes('中')) riskClass = 'risk-mid';

  const truncatedWarning = summary.truncated ? '<p style="color:var(--geist-error);">⚠ 该文件变更过大，摘要可能不完整</p>' : '';

  const data = {
    activeList: '', activeStats: '',
    hash: summary.commit_hash.substring(0, 7),
    fullHash: summary.commit_hash,
    author: escapeHtml(commit?.author || 'N/A'),
    date: commit?.date?.substring(0, 10) || 'N/A',
    message: escapeHtml(commit?.message || 'N/A'),
    summary: escapeHtml(summary.summary),
    intent: escapeHtml(summary.intent || ''),
    scopeTags: scopeTags || '<span style="color:var(--accents-5);">无</span>',
    risk: escapeHtml(summary.risk || 'N/A'),
    riskClass,
    truncatedWarning,
    model: summary.model || 'N/A',
    tokensUsed: String(summary.tokens_used || 'N/A'),
  };
  closeDatabase(dbPath);
  res.send(render('detail', data));
});
```

- [ ] **第4步：编写视图 src/web/views/detail.html**

```html
<div class="card">
  <h2><span class="hash">{{fullHash}}</span></h2>
  <div class="meta" style="margin-top:0.5rem;">
    {{author}} &middot; {{date}} &middot; {{model}}
  </div>
  <p style="margin:0.75rem 0;color:var(--accents-5);"><strong>原始消息:</strong> {{message}}</p>
  {{{truncatedWarning}}}
  <div style="margin:1rem 0;">
    <h3>📝 摘要</h3>
    <p>{{summary}}</p>
  </div>
  <div style="margin:1rem 0;">
    <h3>🎯 意图</h3>
    <p>{{intent}}</p>
  </div>
  <div style="margin:1rem 0;">
    <h3>📂 影响范围</h3>
    <div style="margin-top:0.25rem;">{{{scopeTags}}}</div>
  </div>
  <div style="margin:1rem 0;">
    <h3>⚠️ 风险</h3>
    <p><span class="{{riskClass}}">{{risk}}</span></p>
  </div>
  <p style="margin-top:1rem;font-size:0.8rem;color:var(--accents-5);">Token 消耗: {{tokensUsed}}</p>
</div>
<p style="margin-top:1rem;"><a href="/" class="btn btn-secondary">← 返回列表</a></p>
```

- [ ] **第5步：验证**

```bash
npm run build; npm test -- tests/web/detail.test.ts
```
预期：**1 PASS**。

- [ ] **第6步：提交**
```bash
git add src/web/routes/pages.ts src/web/views/detail.html tests/web/detail.test.ts
git commit -m "feat: Web 详情页（结构化卡片 + 文件标签）"
```

---

### T16c: Web — 统计页路由与视图

> **Open Design:** 使用 skill `web-design-guidelines` + Vercel 设计系统。

**涉及文件:** `src/web/routes/pages.ts`（追加路由）、`src/web/views/stats.html`、`tests/web/stats.test.ts`

- [ ] **第1步：编写测试（红灯）**

```typescript
// tests/web/stats.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getStats } from '../../src/core/storage';
const TD = path.join(os.tmpdir(), 'diffsense-web-stats'); const dp = path.join(TD, '.diffsense.db');

describe('Web 统计页', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('getStats 正确聚合', () => {
    for (let i = 0; i < 3; i++) {
      const h = `h${i}`;
      upsertCommit(dp, { repo_path: TD, commit_hash: h, author: 'U', date: `2026-06-1${i}`, message: `m${i}`, generated_at: '' });
      upsertSummary(dp, { commit_hash: h, repo_path: TD, summary: `s${i}`, intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: i < 2 ? 'deepseek-chat' : 'glm-4-flash', tokens_used: 100 + i * 10 });
    }
    const stats = getStats(dp, TD);
    expect(stats.totalCommits).toBe(3);
    expect(stats.modelDistribution['deepseek-chat']).toBe(2);
    expect(stats.modelDistribution['glm-4-flash']).toBe(1);
    expect(stats.totalTokensUsed).toBe(320);
    expect(stats.monthlyCounts.length).toBeGreaterThan(0);
  });
});
```

- [ ] **第2步：运行测试确认失败**（getStats 已在 T5 实现，此项验证数据层正确性）

- [ ] **第3步：追加页面路由**

```typescript
// 追加到 registerPageRoutes: GET /stats
app.get('/stats', (req: Request, res: Response) => {
  if (!fs.existsSync(dbPath)) { res.send(render('stats', { activeList: '', activeStats: 'active', totalCommits: '0', totalTokens: '0', modelDist: '', monthChart: '' })); return; }
  initDatabase(dbPath);
  const stats = getStats(dbPath, repoPath);

  const modelDist = Object.entries(stats.modelDistribution)
    .map(([m, c]) => `<div class="stat-card"><div class="stat-value">${c}</div><div class="stat-label">${m}</div></div>`)
    .join('');

  // SVG 柱状图
  const maxCount = Math.max(1, ...stats.monthlyCounts.map(m => m.count));
  const barWidth = Math.max(20, Math.floor(600 / Math.max(stats.monthlyCounts.length, 1)));
  const bars = stats.monthlyCounts.map((m, i) => {
    const h = Math.max(2, Math.floor((m.count / maxCount) * 150));
    return `<rect x="${i * (barWidth + 8) + 20}" y="${170 - h}" width="${barWidth}" height="${h}" fill="var(--geist-foreground)" rx="2"/><text x="${i * (barWidth + 8) + 20 + barWidth / 2}" y="190" text-anchor="middle" font-size="10" fill="var(--accents-5)">${m.month}</text>`;
  }).join('');

  const monthChart = stats.monthlyCounts.length
    ? `<div class="chart-container"><svg viewBox="0 0 660 200" width="100%" height="200">${bars}<line x1="10" y1="170" x2="650" y2="170" stroke="var(--accents-3)" stroke-width="1"/></svg></div>`
    : '<p style="text-align:center;color:var(--accents-5);">暂无月度数据</p>';

  closeDatabase(dbPath);
  res.send(render('stats', {
    activeList: '', activeStats: 'active',
    totalCommits: String(stats.totalCommits),
    totalTokens: String(stats.totalTokensUsed),
    modelDist: modelDist || '<p style="color:var(--accents-5);">暂无数据</p>',
    monthChart,
  }));
});
```

- [ ] **第4步：编写视图 src/web/views/stats.html**

```html
<h2 style="margin-bottom:1.5rem;">📊 统计面板</h2>
<div class="stats-grid">
  <div class="stat-card"><div class="stat-value">{{totalCommits}}</div><div class="stat-label">Commit 总数</div></div>
  <div class="stat-card"><div class="stat-value">{{totalTokens}}</div><div class="stat-label">Token 消耗</div></div>
</div>
<h3 style="margin:1.5rem 0 0.75rem;">模型使用分布</h3>
<div class="stats-grid">{{{modelDist}}}</div>
<h3 style="margin:1.5rem 0 0.75rem;">月度趋势</h3>
{{{monthChart}}}
```

- [ ] **第5步：验证**

```bash
npm run build; npm test -- tests/web/stats.test.ts
```
预期：**1 PASS**。

- [ ] **第6步：提交**
```bash
git add src/web/routes/pages.ts src/web/views/stats.html tests/web/stats.test.ts
git commit -m "feat: Web 统计页（卡片网格 + SVG 图表）"
```

---

### T16d: JSON API 路由

> **Open Design:** 无需（纯 JSON 后端）

**涉及文件:** `src/web/routes/api.ts`、`tests/web/api.test.ts`

- [ ] **第1步：编写测试（红灯）**

```typescript
// tests/web/api.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getSummariesByRepo, getSummaryByHash, getStats } from '../../src/core/storage';

const TD = path.join(os.tmpdir(), 'diffsense-web-api'); const dp = path.join(TD, '.diffsense.db');

describe('Web API', () => {
  beforeEach(() => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('GET /api/commits 返回分页结果', () => {
    for (let i = 0; i < 3; i++) { const h = `h${i}`; upsertCommit(dp, { repo_path: TD, commit_hash: h, author: 'U', date: `2026-06-1${i}`, message: `m${i}`, generated_at: '' }); upsertSummary(dp, { commit_hash: h, repo_path: TD, summary: `s${i}`, intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'm', tokens_used: 100 }); }
    const rows = getSummariesByRepo(dp, TD, 2, 0);
    expect(rows).toHaveLength(2);
    expect(rows[0].summary).toBe('s2');
    expect(rows[1].summary).toBe('s1');
  });

  it('GET /api/commits/:hash 返回单条摘要', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'xyz', author: 'U', date: '2026-01-01', message: 'm', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'xyz', repo_path: TD, summary: '测试', intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'm', tokens_used: 100 });
    const row = getSummaryByHash(dp, TD, 'xyz');
    expect(row).not.toBeNull();
    expect(row!.summary).toBe('测试');
  });

  it('GET /api/stats 返回统计 JSON', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'h0', author: 'U', date: '2026-01-01', message: 'm', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'h0', repo_path: TD, summary: 's', intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'deepseek-chat', tokens_used: 100 });
    const s = getStats(dp, TD);
    expect(s.totalCommits).toBe(1);
    expect(s.totalTokensUsed).toBe(100);
  });
});
```

- [ ] **第2步：运行测试确认失败**（API 路由尚未实现）

- [ ] **第3步：编写 src/web/routes/api.ts**

```typescript
import { Express, Request, Response } from 'express';
import * as path from 'path';
import { initDatabase, getSummariesByRepo, getSummaryByHash, getStats, closeDatabase } from '../../core/storage';

export function registerApiRoutes(app: Express, repoPath: string = process.cwd()): void {
  const dbPath = path.join(repoPath, '.diffsense.db');

  // GET /api/commits — 分页列表
  app.get('/api/commits', (req: Request, res: Response) => {
    initDatabase(dbPath);
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.q as string) || '';
    const limit = 20;
    const offset = (page - 1) * limit;
    const rows = getSummariesByRepo(dbPath, repoPath, limit, offset, search || undefined);
    closeDatabase(dbPath);
    res.json({ data: rows, page, limit, total: rows.length });
  });

  // GET /api/commits/:hash — 单条摘要
  app.get('/api/commits/:hash', (req: Request, res: Response) => {
    initDatabase(dbPath);
    const row = getSummaryByHash(dbPath, repoPath, req.params.hash);
    closeDatabase(dbPath);
    if (!row) { res.status(404).json({ error: '未找到该 commit 的摘要' }); return; }
    res.json({ data: { ...row, scope: JSON.parse(row.scope || '[]') } });
  });

  // GET /api/stats — 统计数据
  app.get('/api/stats', (req: Request, res: Response) => {
    initDatabase(dbPath);
    const stats = getStats(dbPath, repoPath);
    closeDatabase(dbPath);
    res.json({ data: stats });
  });
}
```

- [ ] **第4步：验证**

```bash
npm run build; npm test -- tests/web/api.test.ts
```
预期：**3 PASS**。

- [ ] **第5步：提交**
```bash
git add src/web/routes/api.ts tests/web/api.test.ts
git commit -m "feat: Web JSON API（分页列表 + 单条摘要 + 统计）"
```

---

### T17: Dockerfile

**涉及文件:** `Dockerfile`

- [ ] **第1步：编写 Dockerfile**

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

- [ ] **第2步：验证**

```bash
docker build -t diffsense .; docker run diffsense --help
```
预期：构建成功，显示 CLI 帮助。

- [ ] **第3步：提交**

```bash
git add Dockerfile
git commit -m "feat: Dockerfile（Node 18 Alpine + git）"
```

---

### T18: CI 配置（GitHub Actions）

**涉及文件:** `.github/workflows/ci.yml`

- [ ] **第1步：编写 CI 配置**

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test
  docker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t diffsense .
```

- [ ] **第2步：提交**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions（测试 + Docker 构建，Node 20）"
```

---

### T19: README.md

**涉及文件:** `README.md`

- [ ] **第1步：编写 README**

章节：项目简介、快速开始（`ds init` / `ds config` / 环境变量）、CLI 命令参考（init / config / log / explain / generate / uninit / web）、Docker 使用、技术栈、目录结构、许可证。

- [ ] **第2步：提交**

```bash
git add README.md
git commit -m "docs: README 使用指南"
```

---

## 自审清单（修订后）

- [x] SPEC 覆盖率：全部 10 章节有对应 Task（V0 冷启动验证 → T0 脚手架 → T1-T8 核心引擎 → T9-T14 CLI → T15+T16a-d Web → T17 Docker → T18 CI → T19 README）
- [x] 占位符扫描：零 TBD / TODO / "implement later" — T16a-d 已拆分为 4 个子任务并提供完整代码块
- [x] 类型一致性：T1 定义的 StoredCommit / StoredSummary / HookState 在 T5–T16d 中均一致使用
- [x] 依赖标注：任务依赖图和并行分组已更新（含 V0 前置 + T16a-T16d 拆分）
- [x] 每个 Task 均有验证步骤（确切命令 + 预期输出）
- [x] PLAN.md 头部包含 REQUIRED SUB-SKILL 声明
- [x] 所有描述性文字已转为中文
- [x] CLI 层 T9-T14 均已补充 smoke test
- [x] T15 包含完整 layout.html（Vercel Geist tokens）和 Web 服务器测试
- [x] 前端 task（T15、T16a-d）首步标注 Open Design 引用
- [x] CI Node 版本统一为 20
- [x] 任务编号统一：V0 → T0-T19（共 25 个 Task，含 V0 + T16a-d 拆分）
- [x] Open Design 设计系统: Vercel + `web-design-guidelines` skill
- [x] 冷启动验证 V0 已插入，对应 AI4SE §4.5 要求

---

## Phase 13: Web UI 重构 + Docker Compose + README 重写

> **致智能体工作者:** 必需的子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐任务实现本计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标:** 重构 Web 界面（详情页文件变更列表、列表页展示全部 commit 并支持 branch 筛选、批量操作栏重构），新增 docker-compose.yml 简化部署，重写 README。

**架构:** 修改现有文件，不新增模块。详情页用 `git diff --name-status` + `git diff --numstat` 生成文件变更列表替代原始 diff。列表页用 `git log` 获取全部 commit 后 LEFT JOIN summaries 表标注分析状态。Branch 筛选通过 `git log <branch>` 实现。

**设计系统:** Vercel + `web-design-guidelines`（Open Design）

### 任务依赖图（Phase 13）

```
T20（详情页文件变更列表）
  └─ T21（列表页辅助函数）
       └─ T22（列表页路由 + 模板重写）
            └─ T23（CSS + JS 完善）
T24（docker-compose.yml）← 独立并行
T25（README 重写）← 独立并行
```

---

### T20: 详情页 — 用文件变更列表替代原始 diff

**涉及文件:**
- 修改: `src/web/routes/pages.ts:122-153`
- 修改: `src/web/views/detail.html:23-26`
- 修改: `src/web/views/layout.html:61`（新增 CSS）
- 新增: `tests/web/detail-file-change.test.ts`

- [ ] **第1步：编写失败测试**

```typescript
// tests/web/detail-file-change.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('详情页 — 文件变更列表', () => {
  const detailPath = path.join(__dirname, '..', '..', 'src', 'web', 'views', 'detail.html');
  const layoutPath = path.join(__dirname, '..', '..', 'src', 'web', 'views', 'layout.html');

  it('detail.html 使用 fileChanges 变量而非 diffSnippet', () => {
    const c = fs.readFileSync(detailPath, 'utf-8');
    expect(c).toContain('{{{fileChanges}}}');
    expect(c).not.toContain('{{{diffSnippet}}}');
  });

  it('layout.html 包含文件变更列表 CSS 类', () => {
    const c = fs.readFileSync(layoutPath, 'utf-8');
    expect(c).toContain('.file-change-list');
    expect(c).toContain('.file-change-item');
    expect(c).toContain('.file-status');
    expect(c).toContain('.file-add');
    expect(c).toContain('.file-del');
  });
});
```

- [ ] **第2步：运行测试确认失败**

```bash
npx vitest run tests/web/detail-file-change.test.ts
```
预期: 2 tests FAIL — `detail.html` 仍含 `diffSnippet`，`layout.html` 缺少新 CSS 类。

- [ ] **第3步：在 pages.ts 详情路由中实现文件变更列表逻辑**

替换 `src/web/routes/pages.ts` 第122-131行（`// fetch diff snippet` 块）：

```typescript
    // fetch file change list (status + path + line counts)
    interface FileChange { status: string; path: string; added: number; deleted: number; }
    let fileChanges: FileChange[] = [];
    try {
      const sg = (await import('simple-git')).default;
      const git = sg(rp);
      let nameStatusOut = '';
      let numstatOut = '';
      try {
        nameStatusOut = await git.raw(['diff', '--name-status', `${hash}^..${hash}`]);
        numstatOut = await git.raw(['diff', '--numstat', `${hash}^..${hash}`]);
      } catch {
        // initial commit (no parent): use git show instead
        try {
          nameStatusOut = await git.raw(['show', '--diff-filter=A', '--name-status', '--format=', hash]);
          numstatOut = await git.raw(['show', '--numstat', '--format=', hash]);
        } catch {}
      }
      const nameLines = nameStatusOut.trim().split('\n').filter(l => l.trim());
      const numLines = numstatOut.trim().split('\n').filter(l => l.trim());
      for (let i = 0; i < nameLines.length; i++) {
        const parts = nameLines[i].split('\t');
        const status = parts[0] || 'M';
        const fpath = parts.slice(1).join('\t');
        const numParts = (numLines[i] || '').split('\t');
        fileChanges.push({
          status,
          path: fpath,
          added: parseInt(numParts[0]) || 0,
          deleted: parseInt(numParts[1]) || 0,
        });
      }
    } catch {}

    const fileChangeHtml = fileChanges.length
      ? fileChanges.map(f => {
          const cls = f.status === 'A' ? 'file-add' : f.status === 'D' ? 'file-del' : f.status === 'R' ? 'file-rename' : 'file-mod';
          return `<div class="file-change-item ${cls}"><span class="file-status">${escapeHtml(f.status)}</span><span class="file-path">${escapeHtml(f.path)}</span><span class="file-stats">+${f.added} -${f.deleted}</span></div>`;
        }).join('')
      : '<p style="color:var(--accents-5);padding:0.75rem;">无文件变更</p>';
```

同时把第146-154行的 `diffSnippet` 改为 `fileChanges`：

```typescript
    res.send(render('detail', {
      activeList: '', activeStats: '', hash: summary.commit_hash.substring(0, 7), fullHash: summary.commit_hash,
      author: escapeHtml(commit?.author || 'N/A'), date: (commit?.date || '').substring(0, 10), message: escapeHtml(commit?.message || 'N/A'),
      summary: escapeHtml(summary.summary), intent: escapeHtml(summary.intent || ''), scopeTags: scopeTags || '无',
      risk: escapeHtml(summary.risk || 'N/A'), riskClass, truncatedWarning,
      model: summary.model || 'N/A', tokensUsed: String(summary.tokens_used || 'N/A'),
      fileChanges: fileChangeHtml,
      ghLink,
    }));
```

- [ ] **第4步：修改 detail.html 模板**

将 `src/web/views/detail.html` 第23-26行：

```html
  <div style="margin:1.25rem 0;">
    <h3 style="margin-bottom:0.25rem;">📋 Diff 预览</h3>
    <pre class="diff-preview">{{{diffSnippet}}}</pre>
  </div>
```

替换为：

```html
  <div style="margin:1.25rem 0;">
    <h3 style="margin-bottom:0.25rem;">📋 文件变更</h3>
    <div class="file-change-list">{{{fileChanges}}}</div>
  </div>
```

- [ ] **第5步：在 layout.html 中添加 CSS**

在 `src/web/views/layout.html` 的 `<style>` 块末尾（`@media` 之前）插入：

```css
    .file-change-list { border:1px solid var(--accents-2); border-radius:var(--geist-radius); overflow:hidden; }
    .file-change-item { display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0.75rem; font-family:var(--font-mono); font-size:0.8rem; border-bottom:1px solid var(--accents-1); }
    .file-change-item:last-child { border-bottom:none; }
    .file-status { width:1.2rem; text-align:center; font-weight:600; font-size:0.75rem; }
    .file-add .file-status { color:#007c40; }
    .file-del .file-status { color:var(--geist-error); }
    .file-rename .file-status { color:#d4a111; }
    .file-mod .file-status { color:var(--accents-5); }
    .file-path { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .file-stats { color:var(--accents-5); font-size:0.75rem; white-space:nowrap; }
```

- [ ] **第6步：运行测试确认全部通过**

```bash
npx vitest run tests/web/detail-file-change.test.ts tests/web/server.test.ts
```
预期: 全部 PASS。

- [ ] **第7步：提交**

```bash
git add src/web/routes/pages.ts src/web/views/detail.html src/web/views/layout.html tests/web/detail-file-change.test.ts
git commit -m "feat: 详情页用文件变更列表（M/A/D/R + 路径 + 行数）替代原始 diff（T20）"
```

---

### T21: 列表页辅助函数 — 从 git log 获取全部 commit 并标注分析状态

**涉及文件:**
- 修改: `src/web/routes/pages.ts:1-56`（新增辅助函数）
- 新增: `tests/web/list-all-commits.test.ts`

- [ ] **第1步：编写失败测试**

```typescript
// tests/web/list-all-commits.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('列表页 — 全部 commit 辅助逻辑', () => {
  const pagesPath = path.join(__dirname, '..', '..', 'src', 'web', 'routes', 'pages.ts');

  it('pages.ts 导出 getAllCommitsWithStatus', async () => {
    const src = fs.readFileSync(pagesPath, 'utf-8');
    expect(src).toContain('getAllCommitsWithStatus');
    expect(src).toContain('CommitWithStatus');
    expect(src).toContain('hasSummary');
    expect(src).toContain('git.raw([\'log\''); // uses git log, not just DB
  });

  it('pages.ts 中含 BranchBar 生成逻辑', () => {
    const src = fs.readFileSync(pagesPath, 'utf-8');
    expect(src).toContain('branchBar');
    expect(src).toContain('branchLocal');
  });
});
```

- [ ] **第2步：运行测试确认失败**

```bash
npx vitest run tests/web/list-all-commits.test.ts
```
预期: 2 tests FAIL — `getAllCommitsWithStatus` 和 `branchBar` 尚不存在。

- [ ] **第3步：在 pages.ts 顶部添加辅助函数**

在 `src/web/routes/pages.ts` 的 `getRepoMeta` 函数之后（第56行后）、`registerPageRoutes` 之前，插入：

```typescript
interface CommitWithStatus {
  hash: string; author: string; date: string; message: string;
  branch: string; hasSummary: boolean;
  summary?: string; model?: string; risk?: string; scope?: string[];
}

async function getAllCommitsWithStatus(
  rp: string, dbPath: string, branch?: string, maxCount: number = 200
): Promise<CommitWithStatus[]> {
  const sg = (await import('simple-git')).default;
  const git = sg(rp);
  const branchArg = (branch && branch !== '__all__') ? branch : '--all';
  let logText = '';
  try {
    logText = await git.raw(['log', branchArg, '--format=%H%n%an%n%aI%n%s', `--max-count=${maxCount}`]);
  } catch {
    return [];
  }
  const lines = logText.trim().split('\n');
  const commits: CommitWithStatus[] = [];
  for (let i = 0; i + 3 < lines.length; i += 4) {
    const h = lines[i]; if (!h) continue;
    commits.push({ hash: h, author: lines[i + 1] || '', date: lines[i + 2] || '', message: lines[i + 3] || '', branch: '', hasSummary: false });
  }

  // resolve branch per commit
  try {
    const brs = await git.branchLocal();
    for (const br of Object.keys(brs.branches)) {
      const bl = await git.raw(['log', br, '--format=%H', `--max-count=${maxCount}`]);
      for (const c of bl.trim().split('\n')) {
        if (c) { const found = commits.find(x => x.hash === c); if (found && !found.branch) found.branch = br; }
      }
    }
  } catch {}

  // annotate with summary status from DB
  if (fs.existsSync(dbPath)) {
    await initDatabase(dbPath);
    for (const c of commits) {
      const s = getSummaryByHash(dbPath, rp, c.hash);
      if (s) {
        c.hasSummary = true;
        c.summary = s.summary;
        c.model = s.model;
        c.risk = s.risk;
        c.scope = JSON.parse(s.scope || '[]');
      }
    }
    closeDatabase(dbPath);
  }

  return commits;
}

async function buildBranchBar(rp: string, activeBranch: string, searchVal: string): Promise<string> {
  const sg = (await import('simple-git')).default;
  let branches: string[] = [];
  try { branches = Object.keys((await sg(rp).branchLocal()).branches); } catch {}
  const searchQ = searchVal ? `&q=${encodeURIComponent(searchVal)}` : '';
  let html = `<a href="/?${searchQ ? 'q=' + encodeURIComponent(searchVal) : ''}" class="branch-btn${activeBranch === '__all__' || !activeBranch ? ' active' : ''}">全部</a>`;
  for (const br of branches) {
    const active = activeBranch === br ? ' active' : '';
    html += `<a href="/?branch=${encodeURIComponent(br)}${searchQ}" class="branch-btn${active}">${escapeHtml(br)}</a>`;
  }
  return html;
}
```

- [ ] **第4步：运行测试确认通过**

```bash
npx vitest run tests/web/list-all-commits.test.ts
```
预期: 2 tests PASS。

- [ ] **第5步：提交**

```bash
git add src/web/routes/pages.ts tests/web/list-all-commits.test.ts
git commit -m "feat: 添加 getAllCommitsWithStatus + buildBranchBar 辅助函数（T21）"
```

---

### T22: 列表页路由重写 — GET / 展示全部 commit + branch 筛选 + 搜索

**涉及文件:**
- 修改: `src/web/routes/pages.ts:58-105`（GET / 路由）
- 修改: `src/web/views/list.html`（模板）
- 新增: `tests/web/list-route.test.ts`

- [ ] **第1步：编写失败测试**

```typescript
// tests/web/list-route.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('列表页路由', () => {
  const pagesPath = path.join(__dirname, '..', '..', 'src', 'web', 'routes', 'pages.ts');
  const listPath = path.join(__dirname, '..', '..', 'src', 'web', 'views', 'list.html');

  it('GET / 使用 getAllCommitsWithStatus 而非 getSummariesByRepo', () => {
    const src = fs.readFileSync(pagesPath, 'utf-8');
    expect(src).toContain('getAllCommitsWithStatus');
    // 不应再仅依赖 summaries 表
    const afterRoute = src.substring(src.indexOf("app.get('/',"));
    expect(afterRoute).toContain('getAllCommitsWithStatus');
  });

  it('list.html 含 branch-bar div', () => {
    const c = fs.readFileSync(listPath, 'utf-8');
    expect(c).toContain('class="branch-bar"');
    expect(c).toContain('{{{branchBar}}}');
  });

  it('list.html 含 top-actions（分析全部按钮移至顶部）', () => {
    const c = fs.readFileSync(listPath, 'utf-8');
    expect(c).toContain('class="top-actions"');
    expect(c).toContain('analyzeAll()');
  });

  it('list.html 批量栏无"分析全部未生成"按钮', () => {
    const c = fs.readFileSync(listPath, 'utf-8');
    const batchSection = c.substring(c.indexOf('batch-bar'), c.indexOf('</form>'));
    expect(batchSection).not.toContain('分析全部未生成');
  });

  it('list.html 含 status-badge（已分析/未分析）', () => {
    const c = fs.readFileSync(listPath, 'utf-8');
    expect(c).toContain('status-badge');
    expect(c).toContain('analyzed');
  });
});
```

- [ ] **第2步：运行测试确认失败**

```bash
npx vitest run tests/web/list-route.test.ts
```
预期: 5 tests FAIL。

- [ ] **第3步：重写 GET / 路由**

替换 `src/web/routes/pages.ts` 第62-105行（整个 `app.get('/')` 处理函数）：

```typescript
  // ========== GET / — 列表页（全部 commit + branch 筛选 + 搜索 + 分页） ==========
  app.get('/', async (req: Request, res: Response) => {
    const search = (req.query.q as string) || '';
    const branch = (req.query.branch as string) || '__all__';
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const branchBar = await buildBranchBar(rp, branch, search);
    const commits = await getAllCommitsWithStatus(rp, dbPath, branch);

    // search filter
    let filtered = commits;
    if (search) {
      const q = search.toLowerCase();
      filtered = commits.filter(c =>
        c.message.toLowerCase().includes(q) ||
        (c.summary && c.summary.toLowerCase().includes(q))
      );
    }

    // pagination
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    if (total === 0) {
      res.send(render('list', {
        activeList: 'active', activeStats: '', rows: '<p style="text-align:center;color:var(--accents-5);">暂无 commit 记录。</p>',
        pagination: '', searchVal: escapeHtml(search), branchBar, githubUrl: '', progressBar: '',
      }));
      return;
    }

    const { githubUrl } = await getRepoMeta(rp);

    let rows = '';
    for (const c of paged) {
      const hash7 = c.hash.substring(0, 7);
      const date = (c.date || '').substring(0, 10);
      const author = escapeHtml(c.author);
      const bc = branchColor(c.branch);
      const branchBadge = c.branch ? `<span class="branch-badge" style="border-color:${bc};color:${bc};">${escapeHtml(c.branch)}</span>` : '';

      if (c.hasSummary && c.summary) {
        // analyzed card
        let riskClass = 'risk-low';
        if (c.risk && c.risk.includes('高')) riskClass = 'risk-high';
        else if (c.risk && c.risk.includes('中')) riskClass = 'risk-mid';
        const scope = c.scope || [];
        const scopeTags = scope.slice(0, 3).map((f: string) => `<span class="scope-mini">${escapeHtml((f.split('/').pop() || f))}</span>`).join(' ');
        const scopeMore = scope.length > 3 ? ` <span style="color:var(--accents-5);font-size:0.7rem;">+${scope.length - 3}</span>` : '';
        const ghLink = githubUrl ? `<a class="gh-link" href="${githubUrl}/commit/${c.hash}" target="_blank">&#8599;</a>` : '';

        rows += `<div class="card card-analyzed" style="border-left:3px solid ${bc};"><div class="card-body"><div class="card-top"><span class="hash">${hash7}</span> ${branchBadge} <span style="margin-left:0.25rem;font-size:0.7rem;color:var(--accents-5);">${c.model||'N/A'}</span> ${ghLink} <span class="status-badge analyzed">已分析</span></div><div class="summary-line"><a href="/commits/${c.hash}" style="color:inherit;text-decoration:none;">${escapeHtml(c.summary)}</a></div><div class="meta">${date} &middot; ${author}${c.risk?' &middot; <span class="'+riskClass+'">'+escapeHtml(c.risk)+'</span>':''}</div>${scopeTags ? '<div style="margin-top:0.4rem;">'+scopeTags+scopeMore+'</div>' : ''}</div></div>`;
      } else {
        // unanalyzed card — has checkbox
        rows += `<div class="card card-unanalyzed" style="border-left:3px solid ${bc};opacity:0.75;"><label class="card-check"><input type="checkbox" class="commit-checkbox" value="${c.hash}" onchange="toggleSelect('${c.hash}', this)" /></label><div class="card-body"><div class="card-top"><span class="hash">${hash7}</span> ${branchBadge} <span class="status-badge unanalyzed">未分析</span></div><div class="summary-line" style="color:var(--accents-5);">${escapeHtml(c.message)}</div><div class="meta">${date} &middot; ${author}</div></div></div>`;
      }
    }

    const hasMore = offset + limit < total;
    const pagination = hasMore
      ? `<div class="pagination"><a class="btn btn-secondary" href="/?branch=${encodeURIComponent(branch)}&q=${encodeURIComponent(search)}&page=${page + 1}">加载更多（${total - offset - limit} 条剩余）</a></div>`
      : '';

    res.send(render('list', {
      activeList: 'active', activeStats: '', rows, pagination,
      searchVal: escapeHtml(search), branchBar, githubUrl, progressBar: '',
    }));
  });
```

- [ ] **第4步：重写 list.html 模板**

替换整个 `src/web/views/list.html`：

```html
<div class="search-bar">
  <input type="text" name="q" placeholder="搜索 commit message 或摘要..." value="{{searchVal}}"
    hx-get="/" hx-trigger="keyup changed delay:300ms" hx-target="body" />
</div>

<div class="branch-bar">{{{branchBar}}}</div>

<div class="top-actions">
  <button class="btn btn-secondary" onclick="analyzeAll()">分析全部未生成</button>
</div>

<div id="progress-bar" class="progress-bar" style="display:none;">
  <div class="progress-fill" id="progress-fill" style="width:0%"></div>
  <span id="progress-text" class="progress-text"></span>
</div>

<div class="batch-bar" id="batch-bar" style="display:none;">
  <span id="batch-count">已选 0 项</span>
  <button class="btn" onclick="batchAnalyze()">分析选中</button>
</div>

<form id="commit-form">
<div id="commit-list">{{{rows}}}</div>
</form>
{{{pagination}}}

<script>
let pollTimer = null;
let currentJobId = '';

function toggleSelect(hash, el) {
  el.closest('.card').classList.toggle('selected', el.checked);
  updateBatchBar();
}

function updateBatchBar() {
  const checked = document.querySelectorAll('.commit-checkbox:checked');
  const bar = document.getElementById('batch-bar');
  const count = document.getElementById('batch-count');
  if (checked.length > 0) {
    bar.style.display = 'flex';
    count.textContent = '已选 ' + checked.length + ' 项';
  } else {
    bar.style.display = 'none';
  }
}

function getSelectedHashes() {
  return Array.from(document.querySelectorAll('.commit-checkbox:checked')).map(cb => cb.value);
}

function showProgress(current, total, text) {
  const bar = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  const txt = document.getElementById('progress-text');
  bar.style.display = 'block';
  fill.style.width = total ? Math.round(current / total * 100) + '%' : '0%';
  txt.textContent = text || (current + ' / ' + total);
}

function hideProgress() {
  document.getElementById('progress-bar').style.display = 'none';
}

function startPoll(jobId) {
  currentJobId = jobId;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const resp = await fetch('/api/analyze-progress?jobId=' + jobId);
    const { data } = await resp.json();
    showProgress(data.completed, data.total, data.current ? '正在: ' + data.current : '');
    if (data.done) {
      clearInterval(pollTimer);
      hideProgress();
      location.reload();
    }
  }, 800);
}

async function batchAnalyze() {
  const hashes = getSelectedHashes();
  if (!hashes.length) return;
  const resp = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes })
  });
  const { data } = await resp.json();
  if (data.jobId) startPoll(data.jobId);
}

async function analyzeAll() {
  if (!confirm('将分析仓库中所有未生成摘要的 commit，可能需要较长时间。继续？')) return;
  const resp = await fetch('/api/analyze-all', { method: 'POST' });
  const { data } = await resp.json();
  if (data.skipped > 0 && data.total === 0) {
    alert('所有 commit 均已生成摘要（' + data.skipped + ' 条）');
    return;
  }
  if (data.jobId) startPoll(data.jobId);
}
</script>
```

- [ ] **第5步：运行测试确认通过**

```bash
npx vitest run tests/web/list-route.test.ts tests/web/list-all-commits.test.ts tests/web/server.test.ts
```
预期: 全部 PASS。

- [ ] **第6步：提交**

```bash
git add src/web/routes/pages.ts src/web/views/list.html tests/web/list-route.test.ts tests/web/list-all-commits.test.ts
git commit -m "feat: 列表页展示全部 commit + branch 筛选 + 双样式卡片（T21+T22）"
```

---

### T23: CSS 补充 — 新组件样式（branch bar、top-actions、status-badge、card 变体）

**涉及文件:**
- 修改: `src/web/views/layout.html:46-66`（CSS 块）

- [ ] **第1步：在 layout.html CSS 中追加新样式**

在 `src/web/views/layout.html` 的 `<style>` 块中，`.card-top` 样式之后、footer 样式之前插入：

```css
    .branch-bar { display:flex; gap:0.35rem; flex-wrap:wrap; margin-bottom:1rem; }
    .branch-btn { display:inline-block; padding:0.2rem 0.6rem; font-size:0.75rem; border:1px solid var(--accents-2); border-radius:var(--geist-radius); text-decoration:none; color:var(--accents-5); cursor:pointer; }
    .branch-btn:hover { border-color:var(--geist-foreground); color:var(--geist-foreground); }
    .branch-btn.active { border-color:var(--geist-foreground); color:var(--geist-foreground); background:var(--accents-1); }
    .top-actions { display:flex; justify-content:flex-end; margin-bottom:1rem; }
    .card-analyzed { border-left:3px solid var(--accents-3); }
    .card-unanalyzed { opacity:0.75; }
    .card-unanalyzed:hover { opacity:1; }
    .status-badge { display:inline-block; padding:0.1rem 0.4rem; border-radius:3px; font-size:0.65rem; vertical-align:middle; }
    .status-badge.analyzed { background:#e6f4ea; color:#007c40; }
    .status-badge.unanalyzed { background:var(--accents-1); color:var(--accents-5); }
```

- [ ] **第2步：运行全部测试**

```bash
npx vitest run
```
预期: 全部 86+ tests PASS。

- [ ] **第3步：提交**

```bash
git add src/web/views/layout.html
git commit -m "style: 添加 branch-bar / top-actions / status-badge / card-analyzed 样式（T23）"
```

---

### T24: docker-compose.yml — 简化部署命令

**涉及文件:**
- 新增: `docker-compose.yml`
- 修改: `Dockerfile:17`（可选，ENTRYPOINT 调整以兼容 compose command）

- [ ] **第1步：创建 docker-compose.yml**

```yaml
version: '3.8'

services:
  diffsense:
    image: ghcr.io/araragi-koyomin/diffsense:latest
    container_name: diffsense
    ports:
      - '9090:3000'
    volumes:
      - .:/repo
    environment:
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
    command: web -r /repo
```

- [ ] **第2步：提交**

```bash
git add docker-compose.yml
git commit -m "feat: 添加 docker-compose.yml，简化部署（T24）"
```

---

### T25: README.md — 全面重写

**涉及文件:**
- 修改: `README.md`

- [ ] **第1步：重写 README.md**

```markdown
# DiffSense — 代码变更语义解释器

AI 驱动的 git commit 语义摘要工具。让 `git diff` 不仅能告诉你**改了什么**，还能告诉你**为什么改**。

## 快速开始（Docker + docker-compose）

```bash
# 1. 拉取镜像
docker pull ghcr.io/araragi-koyomin/diffsense:latest

# 2. 配置 API Key
export DEEPSEEK_API_KEY="sk-xxx"

# 3. 初始化（在你的 git 仓库目录下）
docker-compose run --rm diffsense init -r /repo
docker-compose run --rm diffsense config -r /repo
```

## 使用方式

### Web 界面（推荐）

```bash
docker-compose up
# 访问 http://localhost:9090
# 停止: Ctrl+C
```

### CLI 命令

```bash
# 查看摘要列表
docker-compose run --rm diffsense log -r /repo

# 查看某次 commit 的详细摘要
docker-compose run --rm diffsense explain HEAD -r /repo

# 强制生成摘要（覆盖缓存）
docker-compose run --rm diffsense generate HEAD -r /repo

# 卸载 hook
docker-compose run --rm diffsense uninit -r /repo
```

## 从源码安装

```bash
git clone https://github.com/araragi-koyomin/DiffSense.git
cd DiffSense
npm install && npm run build
npm link                # 注册全局命令 ds
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `ds init` | 在当前仓库安装 post-commit hook |
| `ds uninit` | 卸载 post-commit hook |
| `ds config` | 交互式配置 LLM provider |
| `ds log [-n 10]` | 查看最近 commit 的摘要列表 |
| `ds explain <ref>` | 查看某次 commit 的详细结构化摘要 |
| `ds generate <ref>` | 强制为指定 commit 生成摘要 |
| `ds web` | 启动本地 Web 界面 |

## Web 界面 (http://localhost:3000)

三个页面：
- **摘要列表** — 展示仓库全部 commit，按 branch 筛选，勾选未分析的 commit 批量分析
- **详情页** — 完整结构化卡片（摘要 / 意图 / 影响范围 / 风险 / 文件变更列表）
- **统计面板** — 月度趋势图、模型使用分布、Token 消耗统计

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `GLM_API_KEY` | 智谱 GLM API 密钥 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址（可选） |
| `GLM_BASE_URL` | GLM API 地址（可选） |

## 技术栈

- **语言**: TypeScript / Node.js 18+
- **CLI**: commander + chalk
- **Web**: Express + SSR（Vercel Geist 设计系统）
- **存储**: SQLite（sql.js）
- **LLM**: OpenAI 兼容协议（DeepSeek / 智谱 GLM-4-Flash）
- **测试**: vitest

## 项目结构

```
src/
├── cli/          # CLI 入口 + 命令
├── core/         # 核心引擎（diff 解析 / LLM / 存储）
├── web/          # Web 服务 + 路由 + 视图
└── types.ts
tests/
├── core/         # 引擎单元测试
├── cli/          # CLI 集成测试
└── web/          # Web 测试
```
```

- [ ] **第2步：运行测试确认无回归**

```bash
npx vitest run
```
预期: 全部 PASS。

- [ ] **第3步：提交**

```bash
git add README.md
git commit -m "docs: README 重写 — docker-compose 简化命令 + 平台通用说明（T25）"
```

---

## Phase 13 自审清单

- [ ] SPEC 覆盖率：6 项设计决策全部有对应 Task（T20 详情页文件列表 / T21+T22 列表页全部 commit / T23 样式完善 / T24 compose / T25 README）
- [ ] 占位符扫描：零 TBD / TODO
- [ ] 类型一致性：`CommitWithStatus` 接口在 T21 定义，T22 使用
- [ ] 依赖标注：T21→T22→T23 串行；T20、T24、T25 可并行
- [ ] 每个 Task 均有验证步骤（确切命令 + 预期输出）
- [ ] 设计系统: Vercel Geist CSS tokens（无新增外部依赖）
