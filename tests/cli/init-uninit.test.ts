import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initHook, uninitHook } from '../../src/cli/commands/init';

const TD = path.join(os.tmpdir(), 'diffsense-init');

describe('init / uninit', () => {
  let repo: string, hp: string;
  beforeEach(() => {
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
    repo = path.join(TD, 'r');
    hp = path.join(repo, '.git', 'hooks', 'post-commit');
    fs.mkdirSync(path.dirname(hp), { recursive: true });
  });
  afterEach(() => {
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
  });

  it('init 创建 post-commit hook', () => {
    initHook(repo);
    expect(fs.readFileSync(hp, 'utf-8')).toContain('ds hook-post-commit');
  });
  it('init 备份已有 hook', () => {
    fs.writeFileSync(hp, 'echo old', 'utf-8');
    initHook(repo);
    expect(fs.existsSync(hp + '.bak')).toBe(true);
  });
  it('init 幂等（不重复添加）', () => {
    initHook(repo);
    initHook(repo);
    expect((fs.readFileSync(hp, 'utf-8').match(/ds hook-post-commit/g) || []).length).toBe(1);
  });
  it('非 git 目录报错', () => {
    expect(initHook(TD).success).toBe(false);
  });
  it('uninit 移除 DiffSense 调用', () => {
    initHook(repo);
    const r = uninitHook(repo);
    expect(r.success).toBe(true);
    expect(fs.existsSync(hp)).toBe(false);
  });
  it('uninit 后空文件删除', () => {
    initHook(repo);
    uninitHook(repo);
    expect(fs.existsSync(hp)).toBe(false);
  });
  it('uninit 恢复备份', () => {
    fs.writeFileSync(hp, 'echo old', 'utf-8');
    initHook(repo);
    uninitHook(repo);
    expect(fs.readFileSync(hp, 'utf-8')).toContain('old');
  });
  it('未 init 时报错', () => {
    expect(uninitHook(repo).success).toBe(false);
  });
});
