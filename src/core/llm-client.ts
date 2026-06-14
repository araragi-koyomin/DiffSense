import { FileChunk, DiffSenseConfig, SummaryCard } from './types';

export function buildPrompt(chunks: FileChunk[], commitMessage: string, fileCount: number): string {
  const diffContent = chunks.map(c => {
    let h = '### ' + c.filename;
    if (c.truncated) h += ' [注意：该文件变更过大，已截断部分内容]';
    return h + '\n```diff\n' + c.diffContent + '\n```';
  }).join('\n\n');
  return `你是一个代码变更分析助手。请分析以下 git diff，用中文输出结构化摘要。严格按 JSON 格式返回，不要输出其他内容。\n\n原始 Commit Message: ${commitMessage}\n变更文件数: ${fileCount}\n\n--- DIFF ---\n${diffContent}\n\n请返回 JSON:\n{\n  "summary": "一句话摘要（不超过80字）",\n  "intent": "变更意图",\n  "scope": ["文件路径1"],\n  "risk": "风险提示（低/中/高）"\n}`;
}

export function parseSummaryResponse(raw: string): SummaryCard {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) jsonStr = fence[1].trim();
  let parsed: any;
  try { parsed = JSON.parse(jsonStr); } catch { throw new Error('LLMResponseParseError: 无法解析 JSON'); }
  if (parsed.summary == null || parsed.intent == null || !Array.isArray(parsed.scope) || parsed.risk == null)
    throw new Error('LLMResponseParseError: 缺少必要字段');
  return { summary: parsed.summary, intent: parsed.intent, scope: parsed.scope, risk: parsed.risk };
}

export async function generateSummary(config: DiffSenseConfig, apiKey: string, chunks: FileChunk[], commitMessage: string): Promise<SummaryCard> {
  const prompt = buildPrompt(chunks, commitMessage, chunks.length);
  const resp = await fetch(config.base_url + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: '你是一个代码变更分析助手。请用中文输出结构化摘要。严格按 JSON 格式返回。' }, { role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1000 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error('LLMAPIError: API 返回状态码 ' + resp.status);
  const data = await resp.json() as any;
  return parseSummaryResponse(data.choices?.[0]?.message?.content || '');
}
