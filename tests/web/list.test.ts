import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getSummariesByRepo } from '../../src/core/storage';

const TD = path.join(os.tmpdir(), 'diffsense-web-list');
const dp = path.join(TD, '.diffsense.db');

describe('Web 列表页', () => {
  beforeEach(async () => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); await initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('有数据时查询返回卡片数据', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'abc1234', author: '张三', date: '2026-06-14', message: 'fix: bug', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'abc1234', repo_path: TD, summary: '修复了并发问题', intent: '线上报错', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'deepseek-chat', tokens_used: 100 });
    const rows = getSummariesByRepo(dp, TD, 20, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe('修复了并发问题');
  });

  it('空数据库返回空列表', () => {
    expect(getSummariesByRepo(dp, TD, 20, 0)).toHaveLength(0);
  });

  it('pages.ts 导出 registerPageRoutes', async () => {
    const mod = await import('../../src/web/routes/pages');
    expect(typeof mod.registerPageRoutes).toBe('function');
  });
});
