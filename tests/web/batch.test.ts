import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getSummaryByHash, getSummariesByRepo } from '../../src/core/storage';

const TD = path.join(os.tmpdir(), 'diffsense-web-batch'); const dp = path.join(TD, '.diffsense.db');

describe('Web 批量分析', () => {
  beforeEach(async () => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); await initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('getSummariesByRepo 返回所有已有摘要的 commit', () => {
    for (let i = 0; i < 5; i++) {
      const h = 'abc' + i;
      upsertCommit(dp, { repo_path: TD, commit_hash: h, author: 'U', date: '2026-06-14', message: 'm' + i, generated_at: '' });
      upsertSummary(dp, { commit_hash: h, repo_path: TD, summary: 's' + i, intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'm', tokens_used: 100 });
    }
    const rows = getSummariesByRepo(dp, TD, 50, 0);
    expect(rows).toHaveLength(5);
  });

  it('未生成摘要的 commit 不在 summaries 中', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'xyz', author: 'U', date: '2026-01-01', message: 'm', generated_at: '' });
    expect(getSummaryByHash(dp, TD, 'xyz')).toBeNull();
  });

  it('已生成摘要的 commit 可查询', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'def', author: 'U', date: '2026-01-01', message: 'm', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'def', repo_path: TD, summary: '测试', intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: 'm', tokens_used: 100 });
    expect(getSummaryByHash(dp, TD, 'def')).not.toBeNull();
  });
});
