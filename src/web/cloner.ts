import { simpleGit } from 'simple-git';

export interface CloneResult {
  success: boolean;
  path?: string;
  error?: string;
}

export async function cloneRepo(gitUrl: string, targetPath: string): Promise<CloneResult> {
  const timeout = 30_000;
  try {
    const git = simpleGit();
    await Promise.race([
      git.clone(gitUrl, targetPath, ['--depth=50']),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('clone 超时')), timeout)),
    ]);
    return { success: true, path: targetPath };
  } catch (e: any) {
    const msg = e.message || String(e);
    if (msg.includes('could not read Username') || msg.includes('Authentication failed')
        || msg.includes('Permission denied') || msg.includes('not found')
        || msg.includes('Repository not found') || msg.includes('clone 超时')) {
      return { success: false, error: '无法访问该仓库，请确认是公开仓库且 URL 正确' };
    }
    return { success: false, error: 'clone 失败: ' + msg };
  }
}
