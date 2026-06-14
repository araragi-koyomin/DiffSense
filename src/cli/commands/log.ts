import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { initDatabase, getSummariesByRepo, closeDatabase, getCommit } from '../../core/storage';
import chalk from 'chalk';

export function registerLogCommand(program: Command): void {
  program.command('log').description('查看最近 commit 摘要列表')
    .option('-n, --number <n>', '显示数量（1-50）', '10')
    .option('-r, --repo <path>', '仓库路径', process.cwd())
    .action(async (opts) => {
      const n = Math.min(Math.max(parseInt(opts.number) || 10, 1), 50);
      const rp = opts.repo; const dp = path.join(rp, '.diffsense.db');
      if (!fs.existsSync(dp)) { console.log('暂无摘要记录。请先运行 ds init 初始化。'); process.exit(0); }
      await initDatabase(dp);
      const rows = getSummariesByRepo(dp, rp, n, 0);
      if (!rows.length) { console.log('暂无摘要记录，请先进行 commit 或运行 ds generate'); closeDatabase(dp); process.exit(0); }
      console.log(chalk.bold('Hash     │ 摘要                                          │ 日期       │ 作者'));
      console.log('─────────┼───────────────────────────────────────────────┼────────────┼──────────');
      for (const s of rows) {
        const h = s.commit_hash.substring(0, 7);
        const sum = s.summary.length > 45 ? s.summary.substring(0, 42) + '...' : s.summary.padEnd(45);
        const d = s.created_at ? s.created_at.substring(0, 10) : 'N/A';
        const c = getCommit(dp, rp, s.commit_hash);
        const a = c ? (c.author.length > 8 ? c.author.substring(0, 7) + '…' : c.author.padEnd(8)) : 'N/A'.padEnd(8);
        console.log(`${chalk.yellow(h)}  │ ${sum} │ ${d}   │ ${a}`);
      }
      console.log(`\n显示 ${rows.length} 条记录`);
      closeDatabase(dp);
    });
}
