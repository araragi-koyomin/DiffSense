import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';

const HOOK = '#!/bin/sh\n# DiffSense post-commit hook\nds hook-post-commit\n';
const MARKER = 'ds hook-post-commit';

export interface HookResult { success: boolean; error?: string; backedUp?: boolean; }

export function initHook(repoPath: string): HookResult {
  const gitDir = path.join(repoPath, '.git');
  if (!fs.existsSync(gitDir)) return { success: false, error: '错误：当前目录不在 Git 仓库中' };
  const hp = path.join(gitDir, 'hooks', 'post-commit');
  if (fs.existsSync(hp)) {
    if (fs.readFileSync(hp, 'utf-8').includes(MARKER)) return { success: true };
    fs.writeFileSync(hp + '.bak', fs.readFileSync(hp, 'utf-8'), 'utf-8');
  }
  try {
    fs.writeFileSync(hp, HOOK, { mode: 0o755 });
    return { success: true, backedUp: fs.existsSync(hp + '.bak') };
  } catch (e) {
    return { success: false, error: `无法写入 hook: ${(e as Error).message}` };
  }
}

export function uninitHook(repoPath: string): HookResult {
  const hp = path.join(repoPath, '.git', 'hooks', 'post-commit');
  if (!fs.existsSync(hp)) return { success: false, error: 'DiffSense 未在此仓库中初始化' };
  let c = fs.readFileSync(hp, 'utf-8');
  if (!c.includes(MARKER)) return { success: false, error: 'DiffSense 未在此仓库中初始化' };
  c = c.split('\n').filter(l => !l.includes(MARKER) && l !== '# DiffSense post-commit hook' && !/^# DiffSense/.test(l)).join('\n').trim();
  const isEmpty = !c || c === '#!/bin/sh';
  const bp = hp + '.bak';
  if (isEmpty && fs.existsSync(bp)) {
    fs.writeFileSync(hp, fs.readFileSync(bp, 'utf-8'), { mode: 0o755 });
    fs.unlinkSync(bp);
  } else if (isEmpty) {
    fs.unlinkSync(hp);
  } else {
    fs.writeFileSync(hp, c, { mode: 0o755 });
  }
  return { success: true };
}

export function registerInitCommand(p: Command): void {
  p.command('init')
    .description('在当前 Git 仓库中安装 post-commit hook')
    .option('-r, --repo <path>', '仓库路径', process.cwd())
    .action((opts) => {
      const r = initHook(opts.repo);
      if (r.success) {
        console.log('DiffSense hook 已安装');
        if (r.backedUp) console.log('原有 hook 已备份为 post-commit.bak');
      } else {
        console.log(r.error);
        process.exit(1);
      }
    });
}
