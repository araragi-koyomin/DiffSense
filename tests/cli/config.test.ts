import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig } from '../../src/core/config';

const TD = path.join(os.tmpdir(), 'diffsense-cli-config');
const cp = path.join(TD, 'config.json');

describe('CLI config', () => {
  beforeEach(() => {
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
    fs.mkdirSync(TD, { recursive: true });
  });
  afterEach(() => {
    if (fs.existsSync(TD)) fs.rmSync(TD, { recursive: true });
  });

  it('saveConfig + loadConfig 往返', () => {
    saveConfig({ provider: 'glm', base_url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', token_limit: 8000, web_port: 3000 }, cp);
    const c = loadConfig(cp);
    expect(c.provider).toBe('glm');
    expect(c.model).toBe('glm-4-flash');
  });

  it('配置不包含 api_key', () => {
    saveConfig({ provider: 'deepseek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', token_limit: 8000, web_port: 3000 }, cp);
    const raw = JSON.parse(fs.readFileSync(cp, 'utf-8'));
    expect(raw.api_key).toBeUndefined();
  });

  it('registerConfigCommand 函数可导出', async () => {
    const mod = await import('../../src/cli/commands/config');
    expect(typeof mod.registerConfigCommand).toBe('function');
  });
});
