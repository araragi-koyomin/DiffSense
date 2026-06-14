import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { processCommit } from '../../src/core/index';
import { initDatabase, closeDatabase, getSummaryByHash, upsertCommit } from '../../src/core/storage';
import { DiffSenseConfig } from '../../src/core/types';

const TD = path.join(os.tmpdir(), 'diffsense-engine');
const db = path.join(TD, 'test.db');
const lp = path.join(TD, 'errors.log');
const cfg: DiffSenseConfig = { provider: 'deepseek', base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };

describe('processCommit', () => {
  beforeEach(async () => {
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
    fs.mkdirSync(TD, { recursive: true });
    await initDatabase(db);
  });

  afterEach(() => {
    closeDatabase(db);
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
  });

  it('成功生成摘要并写入数据库', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"summary":"成功","intent":"测试","scope":["a.ts"],"risk":"低"}' } }] }),
    }) as any;

    upsertCommit(db, { repo_path: TD, commit_hash: 'abc', author: 'T', date: '2026-01-01', message: 'test', generated_at: '' });
    await processCommit(TD, 'abc', cfg, 'key', db, lp);
    expect(getSummaryByHash(db, TD, 'abc')!.summary).toBe('成功');
  });

  it('API 失败时记录日志并返回 null', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;

    upsertCommit(db, { repo_path: TD, commit_hash: 'fail', author: 'T', date: '2026-01-01', message: 'm', generated_at: '' });
    const r = await processCommit(TD, 'fail', cfg, 'key', db, lp);
    expect(r).toBeNull();
    expect(fs.existsSync(lp)).toBe(true);
  });
});
