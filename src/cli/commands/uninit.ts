import { Command } from 'commander';
import { uninitHook } from './init';

export function registerUninitCommand(p: Command): void {
  p.command('uninit')
    .description('卸载 post-commit hook')
    .action(() => {
      const r = uninitHook(process.cwd());
      if (r.success) {
        console.log('DiffSense hook 已卸载');
      } else {
        console.log(r.error);
        process.exit(1);
      }
    });
}
