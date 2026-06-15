import { Express, Request, Response } from 'express';
import * as fs from 'fs'; import * as path from 'path';
import { initDatabase, getSummariesByRepo, getCommit, getSummaryByHash, getStats, closeDatabase } from '../../core/storage';
import { createSession, getSession } from '../session';
import { cloneRepo } from '../cloner';
import * as cryptoKeys from '../crypto-keys';

const VIEWS_DIR = path.join(__dirname, '..', 'views');

function render(templateName: string, data: Record<string, string>): string {
  let html = fs.readFileSync(path.join(VIEWS_DIR, templateName + '.html'), 'utf-8');
  const layout = fs.readFileSync(path.join(VIEWS_DIR, 'layout.html'), 'utf-8');
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp('\\{\\{\\{?' + key + '\\}\\}\\}?', 'g'), value);
  }
  return layout.replace('{{{content}}}', html);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// deterministic color from branch name
function branchColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 55%, 45%)`;
}

async function getRepoMeta(rp: string): Promise<{ githubUrl: string; branchMap: Map<string, string> }> {
  const branchMap = new Map<string, string>();
  let githubUrl = '';
  try {
    const sg = (await import('simple-git')).default;
    const git = sg(rp);
    try {
      const remotes = await git.raw(['remote', 'get-url', 'origin']);
      const url = (remotes || '').trim();
      const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
      if (m) githubUrl = 'https://github.com/' + m[1];
    } catch {}
    try {
      const branchOut = await git.branchLocal();
      const keys = Object.keys(branchOut.branches);
      if (keys.length === 1) {
        // single branch: assign to all
      } else {
        for (const br of keys) {
          const logOut = await git.raw(['log', br, '--format=%H', '--max-count=50']);
          for (const h of logOut.trim().split('\n')) {
            if (h && !branchMap.has(h)) branchMap.set(h, br);
          }
        }
      }
    } catch {}
  } catch {}
  return { githubUrl, branchMap };
}

interface CommitWithStatus {
  hash: string; author: string; date: string; message: string;
  branch: string; hasSummary: boolean;
  summary?: string; model?: string; risk?: string; scope?: string[];
}

async function getAllCommitsWithStatus(
  rp: string, dbPath: string, branch?: string, maxCount: number = 200
): Promise<CommitWithStatus[]> {
  const sg = (await import('simple-git')).default;
  const git = sg(rp);
  const branchArg = (branch && branch !== '__all__') ? branch : '--all';
  let logText = '';
  try {
    logText = await git.raw(['log', branchArg, '--format=%H%n%an%n%aI%n%s', `--max-count=${maxCount}`]);
  } catch {
    return [];
  }
  const lines = logText.trim().split('\n');
  const commits: CommitWithStatus[] = [];
  for (let i = 0; i + 3 < lines.length; i += 4) {
    const h = lines[i]; if (!h) continue;
    commits.push({ hash: h, author: lines[i + 1] || '', date: lines[i + 2] || '', message: lines[i + 3] || '', branch: '', hasSummary: false });
  }

  // resolve branch per commit
  try {
    const brs = await git.branchLocal();
    for (const br of Object.keys(brs.branches)) {
      const bl = await git.raw(['log', br, '--format=%H', `--max-count=${maxCount}`]);
      for (const c of bl.trim().split('\n')) {
        if (c) { const found = commits.find(x => x.hash === c); if (found && !found.branch) found.branch = br; }
      }
    }
  } catch {}

  // annotate with summary status from DB
  if (fs.existsSync(dbPath)) {
    await initDatabase(dbPath);
    for (const c of commits) {
      const s = getSummaryByHash(dbPath, rp, c.hash);
      if (s) {
        c.hasSummary = true;
        c.summary = s.summary;
        c.model = s.model;
        c.risk = s.risk;
        c.scope = JSON.parse(s.scope || '[]');
      }
    }
    closeDatabase(dbPath);
  }

  return commits;
}

async function buildBranchBar(rp: string, activeBranch: string, searchVal: string): Promise<string> {
  const sg = (await import('simple-git')).default;
  let branches: string[] = [];
  try { branches = Object.keys((await sg(rp).branchLocal()).branches); } catch {}
  const searchQ = searchVal ? `&q=${encodeURIComponent(searchVal)}` : '';
  let html = `<a href="/?${searchVal ? 'q=' + encodeURIComponent(searchVal) : ''}" class="branch-btn${activeBranch === '__all__' || !activeBranch ? ' active' : ''}">全部</a>`;
  for (const br of branches) {
    const active = activeBranch === br ? ' active' : '';
    html += `<a href="/?branch=${encodeURIComponent(br)}${searchQ}" class="branch-btn${active}">${escapeHtml(br)}</a>`;
  }
  return html;
}

function renderLanding(error: string): string {
  const layout = fs.readFileSync(path.join(VIEWS_DIR, 'layout.html'), 'utf-8');
  let html = fs.readFileSync(path.join(VIEWS_DIR, 'landing.html'), 'utf-8');
  html = html.replace('{{{error}}}', error ? `<p style="color:var(--geist-error);margin-bottom:1rem;">${escapeHtml(error)}</p>` : '');
  return layout.replace('{{{content}}}', html);
}

export function registerPageRoutes(app: Express, repoPath?: string): void {
  const rp = repoPath || process.cwd();
  const dbPath = path.join(rp, '.diffsense.db');

  const sessionRepo = (req: import('express').Request): string | null => {
    const token = req.cookies?.['ds_session'];
    if (!token) return null;
    const s = getSession(token);
    return s ? s.repoPath : null;
  };

  // ========== GET / — 列表页或 landing ==========
  app.get('/', async (req: Request, res: Response) => {
    const sr = sessionRepo(req);
    if (!sr && !repoPath) {
      res.send(renderLanding(''));
      return;
    }
    const effectiveRp = sr || rp;
    const effectiveDb = path.join(effectiveRp, '.diffsense.db');

    const search = (req.query.q as string) || '';
    const branch = (req.query.branch as string) || '__all__';
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const branchBar = await buildBranchBar(effectiveRp, branch, search);
    const commits = await getAllCommitsWithStatus(effectiveRp, effectiveDb, branch);

    let filtered = commits;
    if (search) {
      const q = search.toLowerCase();
      filtered = commits.filter(c =>
        c.message.toLowerCase().includes(q) ||
        (c.summary && c.summary.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    if (total === 0) {
      res.send(render('list', {
        activeList: 'active', activeStats: '', rows: '<p style="text-align:center;color:var(--accents-5);">暂无 commit 记录。</p>',
        pagination: '', searchVal: escapeHtml(search), branchBar, githubUrl: '', progressBar: '',
      }));
      return;
    }

    const { githubUrl } = await getRepoMeta(effectiveRp);

    let rows = '';
    for (const c of paged) {
      const hash7 = c.hash.substring(0, 7);
      const date = (c.date || '').substring(0, 10);
      const author = escapeHtml(c.author);
      const bc = branchColor(c.branch);
      const branchBadge = c.branch ? `<span class="branch-badge" style="border-color:${bc};color:${bc};">${escapeHtml(c.branch)}</span>` : '';

      if (c.hasSummary && c.summary) {
        let riskClass = 'risk-low';
        if (c.risk && c.risk.includes('高')) riskClass = 'risk-high';
        else if (c.risk && c.risk.includes('中')) riskClass = 'risk-mid';
        const scope = c.scope || [];
        const scopeTags = scope.slice(0, 3).map((f: string) => `<span class="scope-mini">${escapeHtml((f.split('/').pop() || f))}</span>`).join(' ');
        const scopeMore = scope.length > 3 ? ` <span style="color:var(--accents-5);font-size:0.7rem;">+${scope.length - 3}</span>` : '';
        const ghLink = githubUrl ? `<a class="gh-link" href="${githubUrl}/commit/${c.hash}" target="_blank">&#8599;</a>` : '';

        rows += `<div class="card card-analyzed" style="border-left:3px solid ${bc};"><div class="card-body"><div class="card-top"><span class="hash">${hash7}</span> ${branchBadge} <span style="margin-left:0.25rem;font-size:0.7rem;color:var(--accents-5);">${c.model||'N/A'}</span> ${ghLink} <span class="status-badge analyzed">已分析</span></div><div class="summary-line"><a href="/commits/${c.hash}" style="color:inherit;text-decoration:none;">${escapeHtml(c.summary)}</a></div><div class="meta">${date} &middot; ${author}${c.risk?' &middot; <span class="'+riskClass+'">'+escapeHtml(c.risk)+'</span>':''}</div>${scopeTags ? '<div style="margin-top:0.4rem;">'+scopeTags+scopeMore+'</div>' : ''}</div></div>`;
      } else {
        rows += `<div class="card card-unanalyzed" style="border-left:3px solid ${bc};opacity:0.75;"><label class="card-check"><input type="checkbox" class="commit-checkbox" value="${c.hash}" onchange="toggleSelect('${c.hash}', this)" /></label><div class="card-body"><div class="card-top"><span class="hash">${hash7}</span> ${branchBadge} <span class="status-badge unanalyzed">未分析</span></div><div class="summary-line" style="color:var(--accents-5);">${escapeHtml(c.message)}</div><div class="meta">${date} &middot; ${author}</div></div></div>`;
      }
    }

    const hasMore = offset + limit < total;
    const pagination = hasMore
      ? `<div class="pagination"><a class="btn btn-secondary" href="/?branch=${encodeURIComponent(branch)}&q=${encodeURIComponent(search)}&page=${page + 1}">加载更多（${total - offset - limit} 条剩余）</a></div>`
      : '';

    res.send(render('list', {
      activeList: 'active', activeStats: '', rows, pagination,
      searchVal: escapeHtml(search), branchBar, githubUrl, progressBar: '',
    }));
  });

  // ========== POST /add-repo — 添加新仓库 ==========
  app.post('/add-repo', async (req: Request, res: Response) => {
    const { url, apiKey } = req.body as { url: string; apiKey: string };
    if (!url || !apiKey) {
      res.send(renderLanding('请填写仓库 URL 和 API Key'));
      return;
    }
    const m = url.match(/github\.com[:/]([^/]+)\/([^/\s.]+?)(?:\.git)?$/);
    if (!m) {
      res.send(renderLanding('无效的 GitHub 仓库 URL'));
      return;
    }

    let session;
    try { session = createSession(url); } catch (e: any) {
      res.send(renderLanding(e.message));
      return;
    }

    const result = await cloneRepo(url, session.repoPath);
    if (!result.success) {
      res.send(renderLanding(result.error || 'clone 失败'));
      return;
    }

    const encrypted = cryptoKeys.encryptApiKey(apiKey);
    const keyFile = path.join(session.repoPath, '.apikey');
    fs.writeFileSync(keyFile, encrypted, 'utf-8');

    res.cookie('ds_session', session.token, {
      httpOnly: true,
      maxAge: 30 * 60 * 1000,
      path: '/',
    });
    res.redirect('/');
  });

  // ========== GET /commits/:hash — 详情页（含 diff 和 GitHub 链接） ==========
  app.get('/commits/:hash', async (req: Request, res: Response) => {
    const hash = req.params.hash;
    if (!fs.existsSync(dbPath)) { res.status(404).send('数据库未找到'); return; }
    await initDatabase(dbPath);
    const summary = getSummaryByHash(dbPath, rp, hash);
    if (!summary) { res.status(404).send('未找到 commit ' + hash); closeDatabase(dbPath); return; }
    const commit = getCommit(dbPath, rp, hash);
    const scope = JSON.parse(summary.scope || '[]') as string[];
    const scopeTags = scope.map((f: string) => `<span class="scope-tag">${escapeHtml(f)}</span>`).join('');
    let riskClass = 'risk-low';
    if (summary.risk && summary.risk.includes('高')) riskClass = 'risk-high';
    else if (summary.risk && summary.risk.includes('中')) riskClass = 'risk-mid';
    const truncatedWarning = summary.truncated ? '<p style="color:var(--geist-error);">⚠ 该文件变更过大，摘要可能不完整</p>' : '';

    // fetch file change list (status + path + line counts)
    interface FileChange { status: string; path: string; added: number; deleted: number; }
    let fileChanges: FileChange[] = [];
    try {
      const sg = (await import('simple-git')).default;
      const git = sg(rp);
      let nameStatusOut = '';
      let numstatOut = '';
      try {
        nameStatusOut = await git.raw(['diff', '--name-status', `${hash}^..${hash}`]);
        numstatOut = await git.raw(['diff', '--numstat', `${hash}^..${hash}`]);
      } catch {
        // initial commit (no parent): use git show instead
        try {
          nameStatusOut = await git.raw(['show', '--diff-filter=A', '--name-status', '--format=', hash]);
          numstatOut = await git.raw(['show', '--numstat', '--format=', hash]);
        } catch {}
      }
      const nameLines = nameStatusOut.trim().split('\n').filter(l => l.trim());
      const numLines = numstatOut.trim().split('\n').filter(l => l.trim());
      for (let i = 0; i < nameLines.length; i++) {
        const parts = nameLines[i].split('\t');
        const status = parts[0] || 'M';
        const fpath = parts.slice(1).join('\t');
        const numParts = (numLines[i] || '').split('\t');
        fileChanges.push({
          status,
          path: fpath,
          added: parseInt(numParts[0]) || 0,
          deleted: parseInt(numParts[1]) || 0,
        });
      }
    } catch {}

    const fileChangeHtml = fileChanges.length
      ? fileChanges.map(f => {
          const cls = f.status === 'A' ? 'file-add' : f.status === 'D' ? 'file-del' : f.status === 'R' ? 'file-rename' : 'file-mod';
          return `<div class="file-change-item ${cls}"><span class="file-status">${escapeHtml(f.status)}</span><span class="file-path">${escapeHtml(f.path)}</span><span class="file-stats">+${f.added} -${f.deleted}</span></div>`;
        }).join('')
      : '<p style="color:var(--accents-5);padding:0.75rem;">无文件变更</p>';

    let githubUrl = '';
    try {
      githubUrl = await (async () => {
        const sg = (await import('simple-git')).default;
        const remotes = await sg(rp).raw(['remote', 'get-url', 'origin']);
        const m = (remotes || '').trim().match(/github\.com[:/](.+?)(?:\.git)?$/);
        return m ? `https://github.com/${m[1]}` : '';
      })();
    } catch {}

    const ghLink = githubUrl ? `<p style="margin:1rem 0;"><a class="btn btn-secondary" href="${githubUrl}/commit/${hash}" target="_blank">查看 GitHub commit &#8599;</a></p>` : '';

    closeDatabase(dbPath);
    res.send(render('detail', {
      activeList: '', activeStats: '', hash: summary.commit_hash.substring(0, 7), fullHash: summary.commit_hash,
      author: escapeHtml(commit?.author || 'N/A'), date: (commit?.date || '').substring(0, 10), message: escapeHtml(commit?.message || 'N/A'),
      summary: escapeHtml(summary.summary), intent: escapeHtml(summary.intent || ''), scopeTags: scopeTags || '无',
      risk: escapeHtml(summary.risk || 'N/A'), riskClass, truncatedWarning,
      model: summary.model || 'N/A', tokensUsed: String(summary.tokens_used || 'N/A'),
      fileChanges: fileChangeHtml,
      ghLink,
    }));
  });

  // ========== GET /stats — 统计页 ==========
  app.get('/stats', async (req: Request, res: Response) => {
    if (!fs.existsSync(dbPath)) {
      res.send(render('stats', { activeList: '', activeStats: 'active', totalCommits: '0', totalTokens: '0', modelDist: '<p style="color:var(--accents-5);">暂无数据</p>', monthChart: '<p style="color:var(--accents-5);">暂无月度数据</p>' }));
      return;
    }
    await initDatabase(dbPath);
    const stats = getStats(dbPath, rp);
    const modelDist = Object.entries(stats.modelDistribution)
      .map(([m, c]) => `<div class="stat-card"><div class="stat-value">${c}</div><div class="stat-label">${m}</div></div>`)
      .join('') || '<p style="color:var(--accents-5);">暂无数据</p>';

    const maxCount = Math.max(1, ...stats.monthlyCounts.map(m => m.count));
    const bw = Math.max(20, Math.floor(600 / Math.max(stats.monthlyCounts.length, 1)));
    const bars = stats.monthlyCounts.map((m, i) => {
      const h = Math.max(2, Math.floor((m.count / maxCount) * 150));
      return `<rect x="${i*(bw+8)+20}" y="${170-h}" width="${bw}" height="${h}" fill="var(--geist-foreground)" rx="2"/><text x="${i*(bw+8)+20+bw/2}" y="190" text-anchor="middle" font-size="10" fill="var(--accents-5)">${m.month}</text>`;
    }).join('');
    const monthChart = stats.monthlyCounts.length
      ? `<div class="chart-container"><svg viewBox="0 0 660 200" width="100%" height="200">${bars}<line x1="10" y1="170" x2="650" y2="170" stroke="var(--accents-3)" stroke-width="1"/></svg></div>`
      : '<p style="text-align:center;color:var(--accents-5);">暂无月度数据</p>';

    closeDatabase(dbPath);
    res.send(render('stats', { activeList: '', activeStats: 'active', totalCommits: String(stats.totalCommits), totalTokens: String(stats.totalTokensUsed), modelDist, monthChart }));
  });
}