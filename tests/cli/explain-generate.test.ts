import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, getSummaryByHash, upsertSummary } from '../../src/core/storage';
import { processCommit } from '../../src/core/index';

const TD = path.join(os.tmpdir(), 'diffsense-explain');
const dp = path.join(TD, 'test.db');
const lp = path.join(TD, 'errors.log');
const cfg = { provider: 'deepseek' as const, base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };

describe('CLI explain/generate', () => {
  beforeEach(async () => {
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
    fs.mkdirSync(TD, { recursive: true });
    await initDatabase(dp);
  });

  afterEach(() => {
    closeDatabase(dp);
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
  });

  it('缓存读取已有摘要', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'cached', author: 'T', date: '2026-01-01', message: 'm', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'cached', repo_path: TD, summary: '已缓存', intent: '测试', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'm', tokens_used: 100 });
    expect(getSummaryByHash(dp, TD, 'cached')!.summary).toBe('已缓存');
  });

  it('generate 覆盖已有缓存', async () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'gen', author: 'T', date: '2026-01-01', message: 'm', generated_at: '' });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"新","intent":"i","scope":["x.ts"],"risk":"中"}' } }] }) }) as any;
    await processCommit(TD, 'gen', cfg, 'key', dp, lp);
    expect(getSummaryByHash(dp, TD, 'gen')!.summary).toBe('新');
  });

  it('registerExplainCommand 可导出', async () => {
    const m = await import('../../src/cli/commands/explain');
    expect(typeof m.registerExplainCommand).toBe('function');
  });

  it('registerGenerateCommand 可导出', async () => {
    const m = await import('../../src/cli/commands/generate');
    expect(typeof m.registerGenerateCommand).toBe('function');
  });
});
