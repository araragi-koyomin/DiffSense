import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('列表页 — 全部 commit 辅助逻辑', () => {
  const pagesPath = path.join(__dirname, '..', '..', 'src', 'web', 'routes', 'pages.ts');

  it('pages.ts 导出 getAllCommitsWithStatus', async () => {
    const src = fs.readFileSync(pagesPath, 'utf-8');
    expect(src).toContain('getAllCommitsWithStatus');
    expect(src).toContain('CommitWithStatus');
    expect(src).toContain('hasSummary');
    expect(src).toContain("git.raw(['log'");
  });

  it('pages.ts 中含 branchBar 生成逻辑', () => {
    const src = fs.readFileSync(pagesPath, 'utf-8');
    expect(src).toContain('buildBranchBar');
    expect(src).toContain('branchLocal');
  });
});
