import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, parseSummaryResponse, generateSummary } from '../../src/core/llm-client';
import { FileChunk, DiffSenseConfig } from '../../src/core/types';

describe('LLM 客户端', () => {
  describe('buildPrompt', () => {
    it('包含 commit message 和 diff', () => {
      const c: FileChunk[] = [{ filename: 'a.ts', diffContent: '+x', tokenEstimate: 1, truncated: false }];
      const p = buildPrompt(c, 'fix: bug', 1);
      expect(p).toContain('fix: bug'); expect(p).toContain('a.ts'); expect(p).toContain('+x');
    });
    it('截断文件有警告', () => {
      const c: FileChunk[] = [{ filename: 'b.ts', diffContent: '...', tokenEstimate: 100, truncated: true }];
      expect(buildPrompt(c, 'm', 1)).toContain('已截断');
    });
  });
  describe('parseSummaryResponse', () => {
    it('解析合法 JSON', () => { expect(parseSummaryResponse('{"summary":"s","intent":"i","scope":["a.ts"],"risk":"低"}').summary).toBe('s'); });
    it('去除 markdown 代码围栏', () => { expect(parseSummaryResponse('```json\n{"summary":"t","intent":"","scope":[],"risk":"低"}\n```').summary).toBe('t'); });
    it('非法 JSON 抛错', () => { expect(() => parseSummaryResponse('not json')).toThrow('LLMResponseParseError'); });
    it('缺字段抛错', () => { expect(() => parseSummaryResponse('{"summary":"x"}')).toThrow('LLMResponseParseError'); });
  });
  describe('generateSummary', () => {
    it('调用 API 并解析', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"s","intent":"i","scope":["a.ts"],"risk":"低"}' } }] }) }) as any;
      const cfg: DiffSenseConfig = { provider: 'deepseek', base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };
      const r = await generateSummary(cfg, 'key', [{ filename: 'a.ts', diffContent: '+x', tokenEstimate: 1, truncated: false }], 'msg');
      expect(r.summary).toBe('s');
    });
    it('非 200 抛 LLMAPIError', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 }) as any;
      const cfg: DiffSenseConfig = { provider: 'deepseek', base_url: 'https://x', model: 'm', token_limit: 8000, web_port: 3000 };
      await expect(generateSummary(cfg, 'k', [{ filename: 'a', diffContent: '', tokenEstimate: 0, truncated: false }], 'm')).rejects.toThrow('LLMAPIError');
    });
  });
});
