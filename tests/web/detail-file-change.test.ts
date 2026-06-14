import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('详情页 — 文件变更列表', () => {
  const detailPath = path.join(__dirname, '..', '..', 'src', 'web', 'views', 'detail.html');
  const layoutPath = path.join(__dirname, '..', '..', 'src', 'web', 'views', 'layout.html');

  it('detail.html 使用 fileChanges 变量而非 diffSnippet', () => {
    const c = fs.readFileSync(detailPath, 'utf-8');
    expect(c).toContain('{{{fileChanges}}}');
    expect(c).not.toContain('{{{diffSnippet}}}');
  });

  it('layout.html 包含文件变更列表 CSS 类', () => {
    const c = fs.readFileSync(layoutPath, 'utf-8');
    expect(c).toContain('.file-change-list');
    expect(c).toContain('.file-change-item');
    expect(c).toContain('.file-status');
    expect(c).toContain('.file-add');
    expect(c).toContain('.file-del');
  });
});
