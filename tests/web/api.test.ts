import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getSummariesByRepo, getSummaryByHash, getStats } from '../../src/core/storage';

const TD = path.join(os.tmpdir(), 'diffsense-web-api');
const dp = path.join(TD, '.diffsense.db');

describe('Web API', () => {
  beforeEach(async () => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); await initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('API 分页查询', () => {
    for (let i = 0; i < 3; i++) { const h = 'h' + i; upsertCommit(dp, { repo_path: TD, commit_hash: h, author: 'U', date: '2026-06-1' + i, message: 'm' + i, generated_at: '' }); upsertSummary(dp, { commit_hash: h, repo_path: TD, summary: 's' + i, intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'm', tokens_used: 100 }); }
    const rows = getSummariesByRepo(dp, TD, 2, 0);
    expect(rows).toHaveLength(2);
  });

  it('API 单条查询', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'xyz', author: 'U', date: '2026-01-01', message: 'm', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'xyz', repo_path: TD, summary: '测试', intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'm', tokens_used: 100 });
    expect(getSummaryByHash(dp, TD, 'xyz')!.summary).toBe('测试');
  });

  it('API 统计', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'h0', author: 'U', date: '2026-01-01', message: 'm', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'h0', repo_path: TD, summary: 's', intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'deepseek-chat', tokens_used: 100 });
    expect(getStats(dp, TD).totalCommits).toBe(1);
  });

  it('registerApiRoutes 可导出', async () => {
    const mod = await import('../../src/web/routes/api');
    expect(typeof mod.registerApiRoutes).toBe('function');
  });
});
