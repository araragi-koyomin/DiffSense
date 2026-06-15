import { Command } from 'commander';
import { loadConfig } from '../../core/config';

export function registerWebCommand(program: Command): void {
  program.command('web')
    .description('启动本地 Web 界面')
    .option('-p, --port <number>', '端口号')
    .option('-r, --repo <path>', '仓库路径')
    .action(async (opts) => {
      const cfg = loadConfig();
      const port = opts.port ? parseInt(opts.port, 10) : cfg.web_port;
      const { startWebServer } = await import('../../web/index');
      await startWebServer(port, opts.repo);
    });
}
