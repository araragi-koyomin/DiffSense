import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('列表页路由', () => {
  const pagesPath = path.join(__dirname, '..', '..', 'src', 'web', 'routes', 'pages.ts');
  const listPath = path.join(__dirname, '..', '..', 'src', 'web', 'views', 'list.html');

  it('GET / 使用 getAllCommitsWithStatus 而非 getSummariesByRepo', () => {
    const src = fs.readFileSync(pagesPath, 'utf-8');
    const afterRoute = src.substring(src.indexOf("app.get('/',"));
    expect(afterRoute).toContain('getAllCommitsWithStatus');
  });

  it('list.html 含 branch-bar div', () => {
    const c = fs.readFileSync(listPath, 'utf-8');
    expect(c).toContain('class="branch-bar"');
    expect(c).toContain('{{{branchBar}}}');
  });

  it('list.html 含 top-actions（分析全部按钮移至顶部）', () => {
    const c = fs.readFileSync(listPath, 'utf-8');
    expect(c).toContain('class="top-actions"');
    expect(c).toContain('analyzeAll()');
  });

  it('list.html 批量栏无"分析全部未生成"按钮', () => {
    const c = fs.readFileSync(listPath, 'utf-8');
    const batchIdx = c.indexOf('batch-bar');
    const formIdx = c.indexOf('</form>');
    const batchSection = c.substring(batchIdx, formIdx > batchIdx ? formIdx : c.length);
    expect(batchSection).not.toContain('分析全部未生成');
  });

  it('pages.ts 路由生成 status-badge（已分析/未分析）', () => {
    const src = fs.readFileSync(pagesPath, 'utf-8');
    expect(src).toContain('status-badge');
    expect(src).toContain('analyzed');
  });
});
