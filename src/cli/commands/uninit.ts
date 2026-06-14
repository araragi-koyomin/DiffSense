import { Command } from 'commander';
import { uninitHook } from './init';

export function registerUninitCommand(p: Command): void {
  p.command('uninit')
    .description('卸载 post-commit hook')
    .option('-r, --repo <path>', '仓库路径', process.cwd())
    .action((opts) => {
      const r = uninitHook(opts.repo);
      if (r.success) {
        console.log('DiffSense hook 已卸载');
      } else {
        console.log(r.error);
        process.exit(1);
      }
    });
}
