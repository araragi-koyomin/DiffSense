import { describe, it, expect } from 'vitest';
import * as fs from 'fs'; import * as path from 'path';

describe('Web 服务器', () => {
  const layoutPath = path.join(__dirname, '..', '..', 'src', 'web', 'views', 'layout.html');

  it('layout.html 存在', () => {
    expect(fs.existsSync(layoutPath)).toBe(true);
  });
  it('layout.html 包含 HTMX', () => {
    expect(fs.readFileSync(layoutPath, 'utf-8')).toContain('htmx.org');
  });
  it('layout.html 包含 Vercel Geist tokens', () => {
    const c = fs.readFileSync(layoutPath, 'utf-8');
    expect(c).toContain('--geist-foreground');
    expect(c).toContain('--geist-background');
    expect(c).toContain('--accents-5');
  });
  it('layout.html 包含 {{{content}}}', () => {
    expect(fs.readFileSync(layoutPath, 'utf-8')).toContain('{{{content}}}');
  });
  it('startWebServer 可导入', async () => {
    const mod = await import('../../src/web/index');
    expect(typeof mod.startWebServer).toBe('function');
  });
});
