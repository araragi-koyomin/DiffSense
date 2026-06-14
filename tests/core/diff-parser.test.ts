import { describe, it, expect } from 'vitest';
import * as fs from 'fs'; import * as path from 'path';
import { parseDiffFromString, chunkDiffByFile } from '../../src/core/diff-parser';

const FX = path.join(__dirname, '..', 'fixtures', 'sample-diffs');

describe('Diff 解析器', () => {
  describe('parseDiffFromString', () => {
    it('提取 git show 元数据', () => {
      const out = 'abc123 (HEAD)\nAuthor: Test <t@e.com>\nDate:   Mon Jun 14 2026\n\n    fix: bug\n\ndiff --git a/x b/x\n...';
      const r = parseDiffFromString(out);
      expect(r.commitHash).toBe('abc123');
      expect(r.author).toBe('Test <t@e.com>');
      expect(r.message).toBe('fix: bug');
    });
    it('检测首个 commit', () => {
      expect(parseDiffFromString('abc\nAuthor: T\nDate: Mon\n\n    init\n').isFirstCommit).toBe(true);
    });
  });
  describe('chunkDiffByFile', () => {
    it('按文件分块', () => {
      const diff = fs.readFileSync(path.join(FX, 'multi-file.diff'), 'utf-8');
      const chunks = chunkDiffByFile(diff, 8000);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].filename).toContain('login.ts');
      expect(chunks[1].filename).toContain('token.ts');
    });
    it('超限时截断', () => {
      const diff = fs.readFileSync(path.join(FX, 'multi-file.diff'), 'utf-8');
      const chunks = chunkDiffByFile(diff, 5);
      expect(chunks[0].truncated).toBe(true);
      expect(chunks[0].diffContent).toContain('truncated');
    });
    it('跳过二进制', () => { expect(chunkDiffByFile('diff --git a/x.png b/x.png\nBinary files differ\n', 8000)).toHaveLength(0); });
    it('空 diff', () => { expect(chunkDiffByFile('', 8000)).toHaveLength(0); });
  });
});
