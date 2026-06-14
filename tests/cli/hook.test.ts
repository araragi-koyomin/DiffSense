import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, getSummaryByHash } from '../../src/core/storage';
import { processCommit } from '../../src/core/index';

const TD = path.join(os.tmpdir(), 'diffsense-hook');
const dp = path.join(TD, '.diffsense.db');
const lp = path.join(TD, 'errors.log');
const cfg = { provider: 'deepseek' as const, base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };

describe('hook-post-commit', () => {
  beforeEach(async () => {
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
    fs.mkdirSync(TD, { recursive: true });
    await initDatabase(dp);
  });
  afterEach(() => {
    closeDatabase(dp);
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
  });

  it('成功处理 commit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"summary":"hook摘要","intent":"i","scope":["h.ts"],"risk":"低"}' } }] }),
    }) as any;
    upsertCommit(dp, { repo_path: TD, commit_hash: 'hook1', author: 'H', date: '2026-06-14', message: 'hook msg', generated_at: '' });
    await processCommit(TD, 'hook1', cfg, 'key', dp, lp);
    expect(getSummaryByHash(dp, TD, 'hook1')!.summary).toBe('hook摘要');
  });

  it('API 失败不抛错并写入日志', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    upsertCommit(dp, { repo_path: TD, commit_hash: 'fail', author: 'H', date: '2026-06-14', message: 'm', generated_at: '' });
    await processCommit(TD, 'fail', cfg, 'key', dp, lp);
    expect(fs.existsSync(lp)).toBe(true);
  });
});
