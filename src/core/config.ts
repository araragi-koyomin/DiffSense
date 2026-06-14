import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DiffSenseConfig } from './types';

export const DEFAULT_DEEPSEEK_CONFIG: DiffSenseConfig = {
  provider: 'deepseek',
  base_url: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  token_limit: 8000,
  web_port: 3000,
};

export const DEFAULT_GLM_CONFIG: DiffSenseConfig = {
  provider: 'glm',
  base_url: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-4-flash',
  token_limit: 8000,
  web_port: 3000,
};

export function getDefaultConfigPath(): string {
  return path.join(os.homedir(), '.diffsense', 'config.json');
}

export function loadConfig(configPath?: string): DiffSenseConfig {
  const fp = configPath || getDefaultConfigPath();
  if (!fs.existsSync(fp)) return { ...DEFAULT_DEEPSEEK_CONFIG };
  return { ...DEFAULT_DEEPSEEK_CONFIG, ...JSON.parse(fs.readFileSync(fp, 'utf-8')) };
}

export function saveConfig(config: DiffSenseConfig, configPath?: string): void {
  const fp = configPath || getDefaultConfigPath();
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(config, null, 2), 'utf-8');
}

export function getApiKey(provider: 'deepseek' | 'glm'): string {
  const envVar = provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'GLM_API_KEY';
  const key = process.env[envVar];
  if (!key) throw new Error(`环境变量 ${envVar} 未设置。请设置后重试。`);
  return key;
}
