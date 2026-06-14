import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getSummariesByRepo, getCommit } from '../../src/core/storage';

const TD = path.join(os.tmpdir(), 'diffsense-log');
const dp = path.join(TD, 'test.db');

describe('CLI log', () => {
  beforeEach(async () => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); await initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  const cmt = (i: number) => ({ repo_path: '/r', commit_hash: 'h' + i, author: '张三', date: '2026-06-1' + i, message: 'msg ' + i, generated_at: '' });
  const sum = (i: number) => ({ commit_hash: 'h' + i, repo_path: '/r', summary: '摘要' + i, intent: '测试', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'deepseek-chat', tokens_used: 100 });

  it('getSummariesByRepo 按日期倒序', () => {
    for (let i = 0; i < 3; i++) { upsertCommit(dp, cmt(i)); upsertSummary(dp, sum(i)); }
    const rows = getSummariesByRepo(dp, '/r', 3, 0);
    expect(rows).toHaveLength(3);
    expect(rows[0].commit_hash).toBe('h2');
  });
  it('搜索过滤', () => {
    upsertCommit(dp, cmt(0)); upsertSummary(dp, { ...sum(0), summary: '修复登录问题' });
    upsertCommit(dp, cmt(1)); upsertSummary(dp, { ...sum(1), commit_hash: 'h1', summary: '优化性能' });
    const r = getSummariesByRepo(dp, '/r', 10, 0, '登录');
    expect(r).toHaveLength(1);
  });
  it('registerLogCommand 函数可导出', async () => {
    const mod = await import('../../src/cli/commands/log');
    expect(typeof mod.registerLogCommand).toBe('function');
  });
});
