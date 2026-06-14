import { Express, Request, Response } from 'express';
import * as fs from 'fs'; import * as path from 'path';
import { initDatabase, getSummariesByRepo, getCommit, getSummaryByHash, getStats, closeDatabase } from '../../core/storage';

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

export function registerPageRoutes(app: Express, repoPath?: string): void {
  const rp = repoPath || process.cwd();
  const dbPath = path.join(rp, '.diffsense.db');

  // ========== GET / — 列表页 ==========
  app.get('/', async (req: Request, res: Response) => {
    const { githubUrl, branchMap } = await getRepoMeta(rp);

    if (!fs.existsSync(dbPath)) {
      res.send(render('list', { activeList: 'active', activeStats: '', rows: '', pagination: '<p style="text-align:center;color:var(--accents-5);">暂无摘要记录。</p>', searchVal: '', jobId: '', githubUrl, progressBar: '' }));
      return;
    }
    await initDatabase(dbPath);
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.q as string) || '';
    const limit = 20;
    const offset = (page - 1) * limit;
    const summaries = getSummariesByRepo(dbPath, rp, limit, offset, search || undefined);

    let rows = '';
    for (const s of summaries) {
      const commit = getCommit(dbPath, rp, s.commit_hash);
      const hash7 = s.commit_hash.substring(0, 7);
      const date = commit ? commit.date.substring(0, 10) : 'N/A';
      const author = escapeHtml(commit ? commit.author : 'N/A');
      const branch = (commit?.branch) || branchMap.get(s.commit_hash) || '';
      const branchBadge = branch ? `<span class="branch-badge" style="border-color:${branchColor(branch)};color:${branchColor(branch)};">${escapeHtml(branch)}</span>` : '';
      let riskClass = 'risk-low';
      if (s.risk && s.risk.includes('高')) riskClass = 'risk-high';
      else if (s.risk && s.risk.includes('中')) riskClass = 'risk-mid';
      const scope = JSON.parse(s.scope || '[]') as string[];
      const scopeTags = scope.slice(0, 3).map((f: string) => `<span class="scope-mini">${escapeHtml(f.split('/').pop() || f)}</span>`).join(' ');
      const scopeMore = scope.length > 3 ? ` <span style="color:var(--accents-5);font-size:0.7rem;">+${scope.length - 3}</span>` : '';
      const ghLink = githubUrl ? `<a class="gh-link" href="${githubUrl}/commit/${s.commit_hash}" target="_blank" title="查看 GitHub">&#8599;</a>` : '';

      rows += `<div class="card"><label class="card-check"><input type="checkbox" class="commit-checkbox" value="${s.commit_hash}" onchange="toggleSelect('${s.commit_hash}', this)" /></label><div class="card-body"><div class="card-top"><span class="hash">${hash7}</span> ${branchBadge} <span style="margin-left:0.25rem;font-size:0.7rem;color:var(--accents-5);">${s.model||'N/A'}</span> ${ghLink}</div><div class="summary-line"><a href="/commits/${s.commit_hash}" style="color:inherit;text-decoration:none;">${escapeHtml(s.summary)}</a></div><div class="meta">${date} &middot; ${author}${s.risk?' &middot; <span class="'+riskClass+'">'+escapeHtml(s.risk)+'</span>':''}</div>${scopeTags ? '<div style="margin-top:0.4rem;">'+scopeTags+scopeMore+'</div>' : ''}</div></div>`;
    }
    if (!rows) rows = '<p style="text-align:center;color:var(--accents-5);">暂无匹配的摘要记录。</p>';

    const pagination = summaries.length === limit
      ? `<div class="pagination"><a class="btn btn-secondary" href="/?q=${encodeURIComponent(search)}&page=${page+1}">加载更多</a></div>`
      : '';
    closeDatabase(dbPath);
    res.send(render('list', {
      activeList: 'active', activeStats: '', rows, pagination,
      searchVal: escapeHtml(search), jobId: '', githubUrl, progressBar: '',
    }));
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

    // fetch diff snippet
    let diffSnippet = '';
    try {
      const sg = (await import('simple-git')).default;
      let diffText = '';
      try { diffText = await sg(rp).raw(['diff', `${hash}^..${hash}`]); }
      catch { diffText = await sg(rp).raw(['show', hash]); }
      diffSnippet = diffText.split('\n').slice(0, 30).map(s => escapeHtml(s)).join('<br>');
      if (diffText.split('\n').length > 30) diffSnippet += '<br><span style="color:var(--accents-5);">... 更多内容已截断</span>';
    } catch {}

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
      diffSnippet: diffSnippet || '<p style="color:var(--accents-5);">无法获取 diff</p>',
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