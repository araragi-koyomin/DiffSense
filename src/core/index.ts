import { DiffSenseConfig, SummaryCard, FileChunk } from './types';
import { chunkDiffByFile } from './diff-parser';
import { generateSummary } from './llm-client';
import { upsertCommit, upsertSummary } from './storage';
import { logError } from './logger';

export async function processCommit(
  repoPath: string,
  commitHash: string,
  config: DiffSenseConfig,
  apiKey: string,
  dbPath: string,
  logPath: string
): Promise<SummaryCard | null> {
  try {
    let diffText = '';
    let author = 'Unknown';
    let date = '';
    let message = '';
    let isFirstCommit = false;

    try {
      const simpleGit = (await import('simple-git')).default;
      const git = simpleGit(repoPath);
      try {
        diffText = await git.raw(['diff', commitHash + '^..' + commitHash]);
      } catch {
        isFirstCommit = true;
        diffText = await git.raw(['show', commitHash]);
      }
      const logOut = await git.raw(['show', commitHash, '--format=%an%n%aI%n%s', '--no-patch']);
      const ml = logOut.trim().split('\n');
      author = ml[0] || 'Unknown';
      date = ml[1] || '';
      message = ml[2] || '';
    } catch {
      message = commitHash;
    }

    upsertCommit(dbPath, { repo_path: repoPath, commit_hash: commitHash, author, date, message, generated_at: new Date().toISOString() });

    let summary: SummaryCard;
    let truncated = false;

    if (!diffText.trim() || isFirstCommit) {
      summary = await generateSummary(config, apiKey, [
        { filename: '(初始提交)', diffContent: '初始提交: ' + message, tokenEstimate: 10, truncated: false },
      ], message);
    } else {
      const chunks = chunkDiffByFile(diffText, config.token_limit);
      if (!chunks.length) return null;
      truncated = chunks.some(c => c.truncated);
      summary = await generateSummary(config, apiKey, chunks, message);
    }

    upsertSummary(dbPath, {
      commit_hash: commitHash,
      repo_path: repoPath,
      summary: summary.summary,
      intent: summary.intent,
      scope: JSON.stringify(summary.scope),
      risk: summary.risk,
      truncated: truncated ? 1 : 0,
      model: config.model,
      tokens_used: 100,
    });

    return summary;
  } catch (err) {
    logError(logPath, commitHash, (err as Error).name || 'Error', (err as Error).message);
    return null;
  }
}
