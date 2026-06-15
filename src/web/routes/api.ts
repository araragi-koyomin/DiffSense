import { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initDatabase, getSummariesByRepo, getSummaryByHash, getStats, closeDatabase, upsertCommit, updateBranch } from '../../core/storage';
import { processCommit } from '../../core/index';
import { loadConfig, getApiKey } from '../../core/config';
import { getSession } from '../session';
import * as cryptoKeys from '../crypto-keys';

// in-memory job tracker
const jobs = new Map<string, { total: number; completed: number; current: string; done: boolean }>();

const JOB_EXPIRY_MS = 10 * 60 * 1000;
function cleanOldJobs() {
  const now = Date.now();
  for (const [k, j] of jobs) {
    const created = parseInt(k.split('-')[1]);
    if (now - created > JOB_EXPIRY_MS) jobs.delete(k);
  }
}

async function getGitHubUrl(rp: string): Promise<string> {
  try {
    const sg = (await import('simple-git')).default;
    const remotes = await sg(rp).remote(['get-url', 'origin']);
    const url = (remotes || '').trim();
    if (!url) return '';
    const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return m ? `https://github.com/${m[1]}` : '';
  } catch { return ''; }
}

export function registerApiRoutes(app: Express, repoPath?: string): void {
  const rp = repoPath || process.cwd();
  const dbPath = path.join(rp, '.diffsense.db');

  function getEffectiveRepo(req: Request): { rp: string; dbPath: string; apiKey: string } | null {
    const token = req.cookies?.['ds_session'];
    if (token) {
      const s = getSession(token);
      if (s) {
        const keyFile = path.join(s.repoPath, '.apikey');
        let apiKey = '';
        if (fs.existsSync(keyFile)) {
          try { apiKey = cryptoKeys.decryptApiKey(fs.readFileSync(keyFile, 'utf-8')); } catch {}
        }
        return { rp: s.repoPath, dbPath: path.join(s.repoPath, '.diffsense.db'), apiKey };
      }
    }
    // Backward compat: use startup repoPath
    if (repoPath) {
      return { rp: repoPath, dbPath: path.join(repoPath, '.diffsense.db'), apiKey: '' };
    }
    return null;
  }

  // GET /api/commits — 分页列表
  app.get('/api/commits', async (req: Request, res: Response) => {
    const er = getEffectiveRepo(req);
    if (!er) { res.status(401).json({ error: '请先添加仓库' }); return; }
    await initDatabase(er.dbPath);
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.q as string) || '';
    const limit = 20;
    const offset = (page - 1) * limit;
    const rows = getSummariesByRepo(er.dbPath, er.rp, limit, offset, search || undefined);
    closeDatabase(er.dbPath);
    res.json({ data: rows, page, limit, total: rows.length });
  });

  // GET /api/commits/:hash — 单条摘要
  app.get('/api/commits/:hash', async (req: Request, res: Response) => {
    const er = getEffectiveRepo(req);
    if (!er) { res.status(401).json({ error: '请先添加仓库' }); return; }
    await initDatabase(er.dbPath);
    const row = getSummaryByHash(er.dbPath, er.rp, req.params.hash);
    closeDatabase(er.dbPath);
    if (!row) { res.status(404).json({ error: '未找到该 commit 的摘要' }); return; }
    res.json({ data: { ...row, scope: JSON.parse(row.scope || '[]') } });
  });

  // GET /api/commits/:hash/diff — commit 的原始 diff
  app.get('/api/commits/:hash/diff', async (req: Request, res: Response) => {
    const er = getEffectiveRepo(req);
    if (!er) { res.status(401).json({ error: '请先添加仓库' }); return; }
    try {
      const sg = (await import('simple-git')).default;
      const git = sg(er.rp);
      let diffText = '';
      try {
        diffText = await git.raw(['diff', `${req.params.hash}^..${req.params.hash}`]);
      } catch {
        diffText = await git.raw(['show', req.params.hash]);
      }
      res.json({ data: { hash: req.params.hash, diff: diffText } });
    } catch {
      res.status(404).json({ error: '无法获取 diff' });
    }
  });

  // GET /api/repo-info — 仓库元信息（GitHub URL、分支列表）
  app.get('/api/repo-info', async (req: Request, res: Response) => {
    const er = getEffectiveRepo(req);
    if (!er) { res.status(401).json({ error: '请先添加仓库' }); return; }
    let ghUrl = '';
    let branches: string[] = [];
    try {
      ghUrl = await getGitHubUrl(er.rp);
      const sg = (await import('simple-git')).default;
      const branchOut = await sg(er.rp).branchLocal();
      branches = Object.keys(branchOut.branches);
    } catch {}
    res.json({ data: { githubUrl: ghUrl, branches } });
  });

  // GET /api/stats — 统计数据
  app.get('/api/stats', async (req: Request, res: Response) => {
    const er = getEffectiveRepo(req);
    if (!er) { res.status(401).json({ error: '请先添加仓库' }); return; }
    await initDatabase(er.dbPath);
    const stats = getStats(er.dbPath, er.rp);
    closeDatabase(er.dbPath);
    res.json({ data: stats });
  });

  // GET /api/analyze-progress — 查询批量分析进度
  app.get('/api/analyze-progress', (req: Request, res: Response) => {
    cleanOldJobs();
    const jobId = req.query.jobId as string;
    const job = jobs.get(jobId);
    if (!job) { res.json({ data: { done: true, total: 0, completed: 0, current: '' } }); return; }
    res.json({ data: job });
  });

  // POST /api/analyze — 批量分析指定 commit
  app.post('/api/analyze', async (req: Request, res: Response) => {
    const er = getEffectiveRepo(req);
    if (!er) { res.status(401).json({ error: '请先添加仓库' }); return; }
    const { hashes } = req.body as { hashes: string[] };
    if (!hashes || !Array.isArray(hashes) || !hashes.length) {
      res.status(400).json({ error: '请提供要分析的 commit hash 列表' });
      return;
    }
    const jobId = 'job-' + Date.now();
    jobs.set(jobId, { total: hashes.length, completed: 0, current: '', done: false });

    const cfg = loadConfig();
    await initDatabase(er.dbPath);
    const sg = (await import('simple-git')).default;
    const git = sg(er.rp);

    // process in background via setImmediate to return response first
    res.json({ data: { jobId, total: hashes.length } });
    closeDatabase(er.dbPath);

    setImmediate(async () => {
      await initDatabase(er.dbPath);
      for (let i = 0; i < hashes.length; i++) {
        const hash = hashes[i];
        try {
          const logOut = await git.raw(['show', hash, '--format=%an%n%aI%n%s', '--no-patch']);
          const ml = logOut.trim().split('\n');
          upsertCommit(er.dbPath, { repo_path: er.rp, commit_hash: hash, author: ml[0] || 'Unknown', date: ml[1] || '', message: ml[2] || '', generated_at: '' });
          await processCommit(er.rp, hash, cfg, er.apiKey, er.dbPath, path.join(os.homedir(), '.diffsense', 'errors.log'));
        } catch {}
        const j = jobs.get(jobId); if (j) { j.completed = i + 1; j.current = hash.substring(0, 7); }
      }
      const j = jobs.get(jobId); if (j) j.done = true;
      closeDatabase(er.dbPath);
    });
  });

  // POST /api/analyze-all — 分析所有未生成摘要的 commit
  app.post('/api/analyze-all', async (req: Request, res: Response) => {
    const er = getEffectiveRepo(req);
    if (!er) { res.status(401).json({ error: '请先添加仓库' }); return; }
    const cfg = loadConfig();
    await initDatabase(er.dbPath);

    const sg = (await import('simple-git')).default;
    const git = sg(er.rp);
    const logOut = await git.raw(['log', '--format=%H%n%an%n%aI%n%s']);
    const lines = logOut.trim().split('\n');
    type Pending = { hash: string; author: string; date: string; message: string };
    const pending: Pending[] = [];
    for (let i = 0; i < lines.length; i += 4) {
      const hash = lines[i]; if (!hash) continue;
      if (!getSummaryByHash(er.dbPath, er.rp, hash)) {
        pending.push({ hash, author: lines[i + 1], date: lines[i + 2], message: lines[i + 3] || '' });
      }
    }

    if (!pending.length) { closeDatabase(er.dbPath); res.json({ data: { jobId: '', total: 0, skipped: lines.length / 4 } }); return; }

    const jobId = 'job-' + Date.now();
    jobs.set(jobId, { total: pending.length, completed: 0, current: '', done: false });
    res.json({ data: { jobId, total: pending.length, skipped: (lines.length / 4) - pending.length } });
    closeDatabase(er.dbPath);

    setImmediate(async () => {
      await initDatabase(er.dbPath);
      for (let i = 0; i < pending.length; i++) {
        const c = pending[i];
        try {
          // get branch info
          let branch = '';
          try {
            const branchOut = await git.raw(['branch', '--contains', c.hash]);
            const bm = branchOut.match(/\*\s+(\S+)/);
            if (bm) branch = bm[1];
          } catch {}
          upsertCommit(er.dbPath, { repo_path: er.rp, commit_hash: c.hash, author: c.author, date: c.date, message: c.message, generated_at: '', branch });
          await processCommit(er.rp, c.hash, cfg, er.apiKey, er.dbPath, path.join(os.homedir(), '.diffsense', 'errors.log'));
        } catch {}
        const j = jobs.get(jobId); if (j) { j.completed = i + 1; j.current = c.hash.substring(0, 7); }
      }
      const j = jobs.get(jobId); if (j) j.done = true;
      closeDatabase(er.dbPath);
    });
  });
}