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

export function registerPageRoutes(app: Express, repoPath?: string): void {
  const rp = repoPath || process.cwd();
  const dbPath = path.join(rp, '.diffsense.db');

  // ========== GET / — 列表页 ==========
  app.get('/', async (req: Request, res: Response) => {
    if (!fs.existsSync(dbPath)) {
      res.send(render('list', { activeList: 'active', activeStats: '', rows: '', pagination: '<p style="text-align:center;color:var(--accents-5);">暂无摘要记录。请先运行 <code>ds init</code> 初始化。</p>', searchVal: '' }));
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
      let riskClass = 'risk-low';
      if (s.risk && s.risk.includes('高')) riskClass = 'risk-high';
      else if (s.risk && s.risk.includes('中')) riskClass = 'risk-mid';
      rows += `<div class="card"><label class="card-check"><input type="checkbox" class="commit-checkbox" value="${s.commit_hash}" onchange="toggleSelect('${s.commit_hash}', this)" /></label><div class="card-body"><span class="hash">${hash7}</span> <span style="margin-left:0.5rem;font-size:0.75rem;color:var(--accents-5);">${s.model||'N/A'}</span><div class="summary-line">${escapeHtml(s.summary)}</div><div class="meta">${date} &middot; ${author}${s.risk?' &middot; <span class="'+riskClass+'">'+escapeHtml(s.risk)+'</span>':''}</div></div></div>`;
    }
    if (!rows) rows = '<p style="text-align:center;color:var(--accents-5);">暂无匹配的摘要记录。</p>';

    const pagination = summaries.length === limit
      ? `<div class="pagination"><a class="btn btn-secondary" href="/?q=${encodeURIComponent(search)}&page=${page+1}">加载更多</a></div>`
      : '';
    closeDatabase(dbPath);
    res.send(render('list', { activeList: 'active', activeStats: '', rows, pagination, searchVal: escapeHtml(search) }));
  });

  // ========== GET /commits/:hash — 详情页 ==========
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

    closeDatabase(dbPath);
    res.send(render('detail', {
      activeList: '', activeStats: '', hash: summary.commit_hash.substring(0, 7), fullHash: summary.commit_hash,
      author: escapeHtml(commit?.author || 'N/A'), date: (commit?.date || '').substring(0, 10), message: escapeHtml(commit?.message || 'N/A'),
      summary: escapeHtml(summary.summary), intent: escapeHtml(summary.intent || ''), scopeTags: scopeTags || '无',
      risk: escapeHtml(summary.risk || 'N/A'), riskClass, truncatedWarning,
      model: summary.model || 'N/A', tokensUsed: String(summary.tokens_used || 'N/A'),
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
