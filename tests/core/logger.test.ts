import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logError } from '../../src/core/logger';

const TEST_DIR = path.join(os.tmpdir(), 'diffsense-logger');

describe('日志模块', () => {
  const logPath = path.join(TEST_DIR, 'errors.log');
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });
  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('写入一条 JSON 行日志', () => {
    logError(logPath, 'abc', 'TestErr', '消息');
    const entry = JSON.parse(fs.readFileSync(logPath, 'utf-8').trim());
    expect(entry.commit_hash).toBe('abc');
    expect(entry.error_type).toBe('TestErr');
  });

  it('追加写入已有日志文件', () => {
    logError(logPath, 'a', 'E', '1');
    logError(logPath, 'b', 'E', '2');
    expect(fs.readFileSync(logPath, 'utf-8').trim().split('\n')).toHaveLength(2);
  });

  it('自动创建父目录', () => {
    const nested = path.join(TEST_DIR, 'deep', 'e.log');
    logError(nested, 'x', 'E', 'm');
    expect(fs.existsSync(nested)).toBe(true);
  });
});
