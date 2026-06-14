import * as path from 'path';
import * as os from 'os';
import { loadConfig, getApiKey } from '../core/config';
import { initDatabase, closeDatabase, upsertCommit } from '../core/storage';
import { processCommit } from '../core/index';
import simpleGit from 'simple-git';

export async function hookPostCommit(): Promise<void> {
  const rp = process.cwd();
  const dp = path.join(rp, '.diffsense.db');
  const lp = path.join(os.homedir(), '.diffsense', 'errors.log');
  try {
    const cfg = loadConfig();
    const key = getApiKey(cfg.provider);
    const git = simpleGit(rp);
    const hash = (await git.raw(['rev-parse', 'HEAD'])).trim();
    const log = await git.raw(['show', 'HEAD', '--format=%an%n%aI%n%s', '--no-patch']);
    const ml = log.trim().split('\n');
    await initDatabase(dp);
    upsertCommit(dp, { repo_path: rp, commit_hash: hash, author: ml[0] || 'Unknown', date: ml[1] || '', message: ml[2] || '', generated_at: new Date().toISOString() });
    await processCommit(rp, hash, cfg, key, dp, lp);
    closeDatabase(dp);
  } catch { /* 静默失败 */ }
}
