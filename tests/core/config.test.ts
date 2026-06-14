import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getApiKey, DEFAULT_DEEPSEEK_CONFIG } from '../../src/core/config';

const TEST_DIR = path.join(os.tmpdir(), 'diffsense-config');
const cfgPath = path.join(TEST_DIR, 'config.json');

describe('配置模块', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });
  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('配置文件不存在时返回默认值', () => {
    const c = loadConfig(cfgPath);
    expect(c.provider).toBe('deepseek');
    expect(c.token_limit).toBe(8000);
  });

  it('saveConfig + loadConfig 往返', () => {
    saveConfig({ provider: 'glm', base_url: 'https://o.bm.cn/api/v4', model: 'glm-4-flash', token_limit: 4000, web_port: 4000 }, cfgPath);
    expect(loadConfig(cfgPath).provider).toBe('glm');
  });

  it('saveConfig 自动创建父目录', () => {
    const nested = path.join(TEST_DIR, 'a', 'b', 'c.json');
    saveConfig(DEFAULT_DEEPSEEK_CONFIG, nested);
    expect(fs.existsSync(nested)).toBe(true);
  });

  it('getApiKey 从环境变量读取', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    expect(getApiKey('deepseek')).toBe('sk-test');
    delete process.env.DEEPSEEK_API_KEY;
  });

  it('环境变量未设置时 getApiKey 抛错', () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => getApiKey('deepseek')).toThrow('DEEPSEEK_API_KEY');
  });
});
