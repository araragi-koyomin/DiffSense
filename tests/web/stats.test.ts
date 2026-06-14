import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getStats } from '../../src/core/storage';

const TD = path.join(os.tmpdir(), 'diffsense-web-stats');
const dp = path.join(TD, '.diffsense.db');

describe('Web 统计页', () => {
  beforeEach(async () => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); await initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('getStats 聚合正确', () => {
    for (let i = 0; i < 3; i++) {
      const h = 'h' + i;
      upsertCommit(dp, { repo_path: TD, commit_hash: h, author: 'U', date: '2026-06-1' + i, message: 'm' + i, generated_at: '' });
      upsertSummary(dp, { commit_hash: h, repo_path: TD, summary: 's' + i, intent: 'i', scope: '["a.ts"]', risk: '低', truncated: 0, model: i < 2 ? 'deepseek-chat' : 'glm-4-flash', tokens_used: 100 + i * 10 });
    }
    const s = getStats(dp, TD);
    expect(s.totalCommits).toBe(3);
    expect(s.modelDistribution['deepseek-chat']).toBe(2);
    expect(s.totalTokensUsed).toBe(330);
  });

  it('stats.html 模板存在', () => {
    expect(fs.existsSync(path.join(__dirname, '..', '..', 'src', 'web', 'views', 'stats.html'))).toBe(true);
  });

  it('stats.html 包含统计占位符', () => {
    const c = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'web', 'views', 'stats.html'), 'utf-8');
    expect(c).toContain('totalCommits');
    expect(c).toContain('totalTokens');
    expect(c).toContain('modelDist');
    expect(c).toContain('monthChart');
  });
});
