import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import initSqlJs from 'sql.js';
import { initDatabase, closeDatabase, getDatabase, upsertCommit, getCommit, deleteCommit, upsertSummary, getSummaryByHash, getSummariesByRepo, getStats, getHookState, setHookState, removeHookState } from '../../src/core/storage';

const TEST_DIR = path.join(os.tmpdir(), 'diffsense-storage');
const dbPath = path.join(TEST_DIR, 'test.db');

describe('数据库建表与初始化', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });
  afterEach(() => {
    closeDatabase(dbPath);
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('initDatabase 创建数据库文件', async () => {
    await initDatabase(dbPath);
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('创建三张表', async () => {
    await initDatabase(dbPath);
    const db = getDatabase(dbPath);
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const names: string[] = [];
    while (stmt.step()) names.push(stmt.getAsObject().name as string);
    stmt.free();
    expect(names).toContain('commits');
    expect(names).toContain('summaries');
    expect(names).toContain('hook_state');
  });

  it('创建索引', async () => {
    await initDatabase(dbPath);
    const db = getDatabase(dbPath);
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name");
    const names: string[] = [];
    while (stmt.step()) names.push(stmt.getAsObject().name as string);
    stmt.free();
    expect(names).toContain('idx_summaries_repo_date');
    expect(names).toContain('idx_commits_repo_date');
  });

  it('幂等初始化', async () => {
    await initDatabase(dbPath);
    await initDatabase(dbPath);
  });

  it('closeDatabase 关闭连接后可重新打开', async () => {
    await initDatabase(dbPath);
    closeDatabase(dbPath);
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(dbPath);
    new SQL.Database(buf);
  });

  it('getDatabase 同一路径返回相同实例', async () => {
    await initDatabase(dbPath);
    expect(getDatabase(dbPath)).toBe(getDatabase(dbPath));
  });
});

describe('数据 CRUD', () => {
  const crudDb = path.join(TEST_DIR, 'crud.db');
  beforeEach(async () => { if (fs.existsSync(crudDb)) fs.unlinkSync(crudDb); await initDatabase(crudDb); });
  afterEach(() => { closeDatabase(crudDb); if (fs.existsSync(crudDb)) fs.unlinkSync(crudDb); });

  const cmt = { repo_path: '/r', commit_hash: 'abc', author: '张三', date: '2026-06-14', message: 'fix: bug', generated_at: '2026-06-14' };
  const sum = { commit_hash: 'abc', repo_path: '/r', summary: '修复了并发问题', intent: '线上报错', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'deepseek-chat', tokens_used: 100 };

  it('upsertCommit 插入后可获取', () => { upsertCommit(crudDb, cmt); expect(getCommit(crudDb, '/r', 'abc')!.author).toBe('张三'); });
  it('upsertCommit 重复调用为更新', () => { upsertCommit(crudDb, cmt); upsertCommit(crudDb, { ...cmt, author: '李四' }); expect(getCommit(crudDb, '/r', 'abc')!.author).toBe('李四'); });
  it('getCommit 不存在时返回 null', () => { expect(getCommit(crudDb, '/r', 'nope')).toBeNull(); });
  it('upsertSummary 写入后可读取', () => { upsertCommit(crudDb, cmt); upsertSummary(crudDb, sum); expect(getSummaryByHash(crudDb, '/r', 'abc')!.summary).toBe('修复了并发问题'); });
  it('upsertSummary 覆盖已有', () => { upsertCommit(crudDb, cmt); upsertSummary(crudDb, sum); upsertSummary(crudDb, { ...sum, summary: '更新' }); expect(getSummaryByHash(crudDb, '/r', 'abc')!.summary).toBe('更新'); });
  it('getSummariesByRepo 按日期倒序', () => {
    for (let i = 0; i < 3; i++) { const h = 'h' + i; upsertCommit(crudDb, { ...cmt, commit_hash: h, date: '2026-06-1' + i }); upsertSummary(crudDb, { ...sum, commit_hash: h }); }
    const rows = getSummariesByRepo(crudDb, '/r', 3, 0);
    expect(rows).toHaveLength(3); expect(rows[0].commit_hash).toBe('h2');
  });
  it('getSummariesByRepo 支持搜索', () => {
    upsertCommit(crudDb, cmt); upsertSummary(crudDb, { ...sum, summary: '登录修复' });
    const rows = getSummariesByRepo(crudDb, '/r', 10, 0, '登录');
    expect(rows).toHaveLength(1);
  });
  it('getStats 统计数据', () => {
    upsertCommit(crudDb, cmt); upsertSummary(crudDb, sum);
    const s = getStats(crudDb, '/r');
    expect(s.totalCommits).toBe(1); expect(s.totalTokensUsed).toBe(100);
  });
  it('deleteCommit 级联删除', () => { upsertCommit(crudDb, cmt); upsertSummary(crudDb, sum); deleteCommit(crudDb, '/r', 'abc'); expect(getCommit(crudDb, '/r', 'abc')).toBeNull(); expect(getSummaryByHash(crudDb, '/r', 'abc')).toBeNull(); });
  it('hookState 增删查', () => { setHookState(crudDb, { repo_path: '/r', installed_at: '2026-06-14', backup_path: null }); expect(getHookState(crudDb, '/r')!.installed_at).toBe('2026-06-14'); removeHookState(crudDb, '/r'); expect(getHookState(crudDb, '/r')).toBeNull(); });
});
