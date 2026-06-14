import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import initSqlJs from 'sql.js';
import { initDatabase, closeDatabase, getDatabase } from '../../src/core/storage';

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
