import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('CLI 入口', () => {
  it('CLI 入口文件存在', () => {
    const cliPath = path.join(__dirname, '..', '..', 'src', 'cli', 'index.ts');
    expect(fs.existsSync(cliPath)).toBe(true);
  });
  it('CLI 入口包含 commander 和 7 条命令占位', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'cli', 'index.ts'), 'utf-8');
    expect(content).toContain('commander');
    expect(content).toContain('config');    // T10
    expect(content).toContain('init');      // T11
    expect(content).toContain('uninit');    // T11
    expect(content).toContain('log');       // T12
    expect(content).toContain('explain');   // T13
    expect(content).toContain('generate');  // T13
    expect(content).toContain('web');       // T14
  });
});
