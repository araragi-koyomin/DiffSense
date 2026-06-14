import { Command } from 'commander';
import * as readline from 'readline';
import { saveConfig, loadConfig, getDefaultConfigPath, DEFAULT_DEEPSEEK_CONFIG, DEFAULT_GLM_CONFIG } from '../../core/config';

function ask(q: string, d: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => { rl.question(`${q} [${d}]: `, a => { rl.close(); r(a.trim() || d); }); });
}

export function registerConfigCommand(program: Command): void {
  program.command('config').description('交互式配置 LLM provider').action(async () => {
    const existing = loadConfig();
    console.log(`当前配置: provider=${existing.provider} base_url=${existing.base_url} model=${existing.model}`);
    const prov = await ask('provider（deepseek/glm）', existing.provider);
    if (prov !== 'deepseek' && prov !== 'glm') { console.log('错误: provider 必须是 deepseek 或 glm'); process.exit(1); }
    const provider = prov as 'deepseek' | 'glm';
    const dUrl = provider === 'deepseek' ? DEFAULT_DEEPSEEK_CONFIG.base_url : DEFAULT_GLM_CONFIG.base_url;
    const dModel = provider === 'deepseek' ? DEFAULT_DEEPSEEK_CONFIG.model : DEFAULT_GLM_CONFIG.model;
    const base_url = await ask('base_url', dUrl);
    const model = await ask('model', dModel);
    const tl = await ask('token_limit', String(existing.token_limit));
    const wp = await ask('web_port', String(existing.web_port));
    const cfg = { provider, base_url, model, token_limit: parseInt(tl) || 8000, web_port: parseInt(wp) || 3000 };
    saveConfig(cfg);
    console.log(`\n配置已保存到: ${getDefaultConfigPath()}`);
    console.log(`注意: API Key 请通过环境变量设置: export ${provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'GLM_API_KEY'}="your-key"`);
  });
}
