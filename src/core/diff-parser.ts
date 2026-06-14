import { FileChunk } from './types';

export function parseDiffFromString(raw: string): { commitHash: string; author: string; message: string; isFirstCommit: boolean } {
  const lines = raw.split('\n');
  const commitHash = lines[0].split(' ')[0].trim();
  const authorLine = lines.find(l => l.startsWith('Author:')) || '';
  const author = authorLine.replace('Author:', '').trim();
  const di = lines.findIndex(l => l.startsWith('Date:'));
  const msgLine = lines.slice(di + 1).find(l => l.trim() && !l.startsWith('diff'));
  const message = (msgLine || '').trim();
  const hasDiff = lines.some(l => l.startsWith('diff --git'));
  return { commitHash, author, message, isFirstCommit: !hasDiff };
}

export function chunkDiffByFile(rawDiff: string, tokenLimit: number): FileChunk[] {
  if (!rawDiff.trim()) return [];
  const sections = splitByFile(rawDiff);
  return sections.map(({ filename, content }) => {
    if (content.includes('Binary files') && content.includes('differ')) return null;
    const est = Math.ceil(content.length / 2.5);
    let truncated = false, diffContent = content;
    if (est > tokenLimit) {
      truncated = true;
      diffContent = content.substring(0, Math.floor(tokenLimit * 2.5)) + '\n[...truncated, content exceeds token limit]';
    }
    return { filename, diffContent, tokenEstimate: Math.min(est, tokenLimit), truncated } as FileChunk;
  }).filter((c): c is FileChunk => c !== null);
}

function splitByFile(diff: string): { filename: string; content: string }[] {
  const sections: { filename: string; content: string }[] = [];
  const lines = diff.split('\n');
  let curFile = '', curContent: string[] = [];
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (curFile && curContent.length) sections.push({ filename: curFile, content: curContent.join('\n') });
      const m = line.match(/diff --git a\/(.*?) b\//);
      curFile = m ? m[1] : line; curContent = [line];
    } else if (curFile) { curContent.push(line); }
  }
  if (curFile && curContent.length) sections.push({ filename: curFile, content: curContent.join('\n') });
  return sections;
}
