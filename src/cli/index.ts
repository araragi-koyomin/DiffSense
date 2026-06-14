#!/usr/bin/env node
import { Command } from 'commander';
import { registerConfigCommand } from './commands/config';
import { registerInitCommand } from './commands/init';
import { registerUninitCommand } from './commands/uninit';
import { registerLogCommand } from './commands/log';
import { registerExplainCommand } from './commands/explain';
import { registerGenerateCommand } from './commands/generate';
import { registerWebCommand } from './commands/web';
import { hookPostCommit } from './hook-post-commit';

const program = new Command();
program.name('ds').description('DiffSense — AI 驱动的代码变更语义解释器').version('1.0.0');

registerConfigCommand(program);
registerInitCommand(program);
registerUninitCommand(program);
registerLogCommand(program);
registerExplainCommand(program);
registerGenerateCommand(program);
registerWebCommand(program);

program.command('hook-post-commit').description('(内部)').action(async () => { await hookPostCommit(); });

program.parse(process.argv);
