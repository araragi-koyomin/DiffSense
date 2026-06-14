#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program.name('ds').description('DiffSense — AI 驱动的代码变更语义解释器').version('1.0.0');

// T10 — 将在 T10 中取消注释
// import { registerConfigCommand } from './commands/config';
// registerConfigCommand(program);

// T11 — 将在 T11 中取消注释
// import { registerInitCommand } from './commands/init';
// import { registerUninitCommand } from './commands/uninit';
// registerInitCommand(program);
// registerUninitCommand(program);

// T12 — 将在 T12 中取消注释
// import { registerLogCommand } from './commands/log';
// registerLogCommand(program);

// T13 — 将在 T13 中取消注释
// import { registerExplainCommand } from './commands/explain';
// import { registerGenerateCommand } from './commands/generate';
// registerExplainCommand(program);
// registerGenerateCommand(program);

// T14 — 将在 T14 中取消注释
// import { registerWebCommand } from './commands/web';
// import { hookPostCommit } from './hook-post-commit';
// registerWebCommand(program);
// program.command('hook-post-commit').description('(内部)').action(async () => { await hookPostCommit(); });

program.parse(process.argv);
