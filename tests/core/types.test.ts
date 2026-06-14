import { describe, it, expect } from 'vitest';

describe('核心类型（编译时验证）', () => {
  it('DiffSenseConfig 结构', () => {
    const c = { provider: 'deepseek' as const, base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', token_limit: 8000, web_port: 3000 };
    expect(c.provider).toBe('deepseek');
  });
  it('FileChunk 结构', () => {
    const c = { filename: 'a.ts', diffContent: '+x', tokenEstimate: 1, truncated: false };
    expect(c.truncated).toBe(false);
  });
  it('SummaryCard 结构', () => {
    const s = { summary: '测试', intent: '测试', scope: ['a.ts'], risk: '低' };
    expect(s.scope).toHaveLength(1);
  });
});
