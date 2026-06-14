import { Express, Request, Response } from 'express';
import * as path from 'path';
import { initDatabase, getSummariesByRepo, getSummaryByHash, getStats, closeDatabase } from '../../core/storage';

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
}
