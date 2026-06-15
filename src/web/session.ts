import * as path from 'path';
import * as fs from 'fs';

export interface Session {
  token: string;
  repoPath: string;
  createdAt: number;
  lastAccess: number;
}

const SESSIONS = new Map<string, Session>();
const TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const REPOS_DIR = path.join(process.cwd(), 'repos');

let cleanupTimer: NodeJS.Timeout | null = null;

function generateToken(): string {
  return Buffer.from(Math.random().toString() + Date.now().toString())
    .toString('base64url').substring(0, 24);
}

export function createSession(gitUrl: string): Session {
  const m = gitUrl.match(/github\.com[:/]([^/]+)\/([^/\s.]+?)(?:\.git)?$/);
  if (!m) throw new Error('无效的 GitHub 仓库 URL');
  const dirName = `${m[1]}-${m[2]}`;
  const token = generateToken();
  const repoPath = path.join(REPOS_DIR, token, dirName);
  if (!fs.existsSync(path.dirname(repoPath))) {
    fs.mkdirSync(path.dirname(repoPath), { recursive: true });
  }
  const session: Session = { token, repoPath, createdAt: Date.now(), lastAccess: Date.now() };
  SESSIONS.set(token, session);
  return session;
}

export function getSession(token: string): Session | null {
  const s = SESSIONS.get(token);
  if (!s) return null;
  if (Date.now() - s.lastAccess > TTL_MS) {
    destroySession(token);
    return null;
  }
  s.lastAccess = Date.now();
  return s;
}

export function destroySession(token: string): void {
  const s = SESSIONS.get(token);
  if (s) {
    try { fs.rmSync(s.repoPath, { recursive: true, force: true }); } catch {}
    SESSIONS.delete(token);
  }
}

export function startCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [token, s] of SESSIONS) {
      if (now - s.lastAccess > TTL_MS) {
        destroySession(token);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export function getReposDir(): string {
  return REPOS_DIR;
}
