import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LogEntry } from './types';

const DEFAULT_LOG_PATH = path.join(os.homedir(), '.diffsense', 'errors.log');

export function logError(
  logPath: string | null,
  commitHash: string,
  errorType: string,
  errorMessage: string
): void {
  const fp = logPath || DEFAULT_LOG_PATH;
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    commit_hash: commitHash,
    error_type: errorType,
    error_message: errorMessage,
  };
  fs.appendFileSync(fp, JSON.stringify(entry) + '\n', 'utf-8');
}
