import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, getApiKey } from '../../core/config';
import { initDatabase, getSummaryByHash, closeDatabase, upsertCommit } from '../../core/storage';
import { processCommit } from '../../core/index';
import chalk from 'chalk';

function printCard(hash: string, card: { summary: string; intent: string; scope: string[]; risk: string }, truncated = false) {
  console.log(chalk.bold('\n┌─────────────────────────────────────────┐'));
  console.log(`│ Commit: ${hash.substring(0, 7)}`.padEnd(43) + '│');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│ 📝 摘要: ${card.summary}`);
  console.log(`│ 🎯 意图: ${card.intent}`);
  console.log(`│ 📂 影响: ${card.scope.join(', ')}`);
  console.log(`│ ⚠️  风险: ${card.risk}`);
  if (truncated) console.log('│ ⚠  该文件变更过大，摘要可能不完整');
  console.log(chalk.bold('└─────────────────────────────────────────┘\n'));
}

export function registerExplainCommand(program: Command): void {
  program.command('explain <ref>')
    .description('查看某个 commit 的详细摘要')
    .option('-r, --repo <path>', '仓库路径', process.cwd())
    .action(async (ref: string, opts) => {
      const rp = opts.repo;
      const dp = path.join(rp, '.diffsense.db');
      const sg = (await import('simple-git')).default;
      const git = sg(rp);
      let hash: string;
      try {
        hash = (await git.raw(['rev-parse', ref])).trim();
      } catch {
        console.log(`错误: 无法解析引用: ${ref}`);
        process.exit(1);
      }
      const cfg = loadConfig();
      const key = getApiKey(cfg.provider);
      await initDatabase(dp);
      const cached = getSummaryByHash(dp, rp, hash);
      if (cached) {
        printCard(hash, { summary: cached.summary, intent: cached.intent, scope: JSON.parse(cached.scope || '[]'), risk: cached.risk }, cached.truncated === 1);
        closeDatabase(dp);
        return;
      }
      const log = await git.raw(['show', hash, '--format=%an%n%aI%n%s', '--no-patch']);
      const ml = log.trim().split('\n');
      upsertCommit(dp, { repo_path: rp, commit_hash: hash, author: ml[0] || 'Unknown', date: ml[1] || '', message: ml[2] || '', generated_at: '' });
      const r = await processCommit(rp, hash, cfg, key, dp, path.join(os.homedir(), '.diffsense', 'errors.log'));
      if (r) {
        printCard(hash, r);
      } else {
        console.log('摘要生成失败，请查看 ~/.diffsense/errors.log');
        process.exit(1);
      }
      closeDatabase(dp);
    });
}
