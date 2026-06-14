import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs'; import * as path from 'path'; import * as os from 'os';
import { initDatabase, closeDatabase, upsertCommit, upsertSummary, getSummaryByHash } from '../../src/core/storage';

const TD = path.join(os.tmpdir(), 'diffsense-web-detail');
const dp = path.join(TD, '.diffsense.db');

describe('Web 详情页', () => {
  beforeEach(async () => { if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); fs.mkdirSync(TD, { recursive: true }); await initDatabase(dp); });
  afterEach(() => { closeDatabase(dp); if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true }); });

  it('按 hash 获取摘要', () => {
    upsertCommit(dp, { repo_path: TD, commit_hash: 'xyz7890', author: '李四', date: '2026-06-15', message: 'feat: new', generated_at: '' });
    upsertSummary(dp, { commit_hash: 'xyz7890', repo_path: TD, summary: '新增导出功能', intent: '需求', scope: '["src/export.ts","src/types.ts"]', risk: '中', truncated: 0, model: 'deepseek-chat', tokens_used: 200 });
    const row = getSummaryByHash(dp, TD, 'xyz7890');
    expect(row).not.toBeNull();
    expect(JSON.parse(row!.scope)).toHaveLength(2);
  });

  it('detail.html 模板文件存在', () => {
    expect(fs.existsSync(path.join(__dirname, '..', '..', 'src', 'web', 'views', 'detail.html'))).toBe(true);
  });

  it('detail.html 包含关键占位符', () => {
    const c = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'web', 'views', 'detail.html'), 'utf-8');
    expect(c).toContain('summary');
    expect(c).toContain('scopeTags');
    expect(c).toContain('intent');
  });
});
