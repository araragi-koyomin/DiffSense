import { Express, Request, Response } from 'express';
import * as path from 'path';
import * as os from 'os';
import { initDatabase, getSummariesByRepo, getSummaryByHash, getStats, closeDatabase, upsertCommit } from '../../core/storage';
import { processCommit } from '../../core/index';
import { loadConfig, getApiKey } from '../../core/config';

export function registerApiRoutes(app: Express, repoPath?: string): void {
  const rp = repoPath || process.cwd();
  const dbPath = path.join(rp, '.diffsense.db');

  // GET /api/commits — 分页列表
  app.get('/api/commits', async (req: Request, res: Response) => {
    await initDatabase(dbPath);
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.q as string) || '';
    const limit = 20;
    const offset = (page - 1) * limit;
    const rows = getSummariesByRepo(dbPath, rp, limit, offset, search || undefined);
    closeDatabase(dbPath);
    res.json({ data: rows, page, limit, total: rows.length });
  });

  // GET /api/commits/:hash — 单条摘要
  app.get('/api/commits/:hash', async (req: Request, res: Response) => {
    await initDatabase(dbPath);
    const row = getSummaryByHash(dbPath, rp, req.params.hash);
    closeDatabase(dbPath);
    if (!row) { res.status(404).json({ error: '未找到该 commit 的摘要' }); return; }
    res.json({ data: { ...row, scope: JSON.parse(row.scope || '[]') } });
  });

  // GET /api/stats — 统计数据
  app.get('/api/stats', async (req: Request, res: Response) => {
    await initDatabase(dbPath);
    const stats = getStats(dbPath, rp);
    closeDatabase(dbPath);
    res.json({ data: stats });
  });

  // POST /api/analyze — 批量分析指定 commit
  app.post('/api/analyze', async (req: Request, res: Response) => {
    const { hashes } = req.body as { hashes: string[] };
    if (!hashes || !Array.isArray(hashes) || !hashes.length) {
      res.status(400).json({ error: '请提供要分析的 commit hash 列表' });
      return;
    }
    const cfg = loadConfig();
    const apiKey = getApiKey(cfg.provider);
    await initDatabase(dbPath);

    const sg = (await import('simple-git')).default;
    const git = sg(rp);
    const results: { hash: string; status: string; summary?: string }[] = [];

    for (const hash of hashes) {
      try {
        const logOut = await git.raw(['show', hash, '--format=%an%n%aI%n%s', '--no-patch']);
        const ml = logOut.trim().split('\n');
        upsertCommit(dbPath, { repo_path: rp, commit_hash: hash, author: ml[0] || 'Unknown', date: ml[1] || '', message: ml[2] || '', generated_at: '' });
        const r = await processCommit(rp, hash, cfg, apiKey, dbPath, path.join(os.homedir(), '.diffsense', 'errors.log'));
        results.push({ hash: hash.substring(0, 7), status: 'ok', summary: r?.summary });
      } catch (e) {
        results.push({ hash: hash.substring(0, 7), status: 'error' });
      }
    }

    closeDatabase(dbPath);
    res.json({ data: results });
  });

  // POST /api/analyze-all — 分析所有未生成摘要的 commit
  app.post('/api/analyze-all', async (req: Request, res: Response) => {
    const cfg = loadConfig();
    const apiKey = getApiKey(cfg.provider);
    await initDatabase(dbPath);

    const sg = (await import('simple-git')).default;
    const git = sg(rp);
    const logOut = await git.raw(['log', '--format=%H%n%an%n%aI%n%s']);
    const lines = logOut.trim().split('\n');
    const commits: { hash: string; author: string; date: string; message: string }[] = [];
    for (let i = 0; i < lines.length; i += 4) {
      commits.push({ hash: lines[i], author: lines[i + 1], date: lines[i + 2], message: lines[i + 3] || '' });
    }

    const results: { hash: string; status: string; summary?: string }[] = [];
    for (const c of commits) {
      const existing = getSummaryByHash(dbPath, rp, c.hash);
      if (existing) continue;
      try {
        upsertCommit(dbPath, { repo_path: rp, commit_hash: c.hash, author: c.author, date: c.date, message: c.message, generated_at: '' });
        const r = await processCommit(rp, c.hash, cfg, apiKey, dbPath, path.join(os.homedir(), '.diffsense', 'errors.log'));
        results.push({ hash: c.hash.substring(0, 7), status: 'ok', summary: r?.summary });
      } catch (e) {
        results.push({ hash: c.hash.substring(0, 7), status: 'error' });
      }
    }

    closeDatabase(dbPath);
    res.json({ data: results });
  });
}
