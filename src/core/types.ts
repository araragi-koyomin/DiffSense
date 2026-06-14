export interface DiffSenseConfig {
  provider: 'deepseek' | 'glm';
  base_url: string;
  model: string;
  token_limit: number;
  web_port: number;
}

export interface FileChunk {
  filename: string;
  diffContent: string;
  tokenEstimate: number;
  truncated: boolean;
}

export interface CommitInfo {
  repoPath: string;
  commitHash: string;
  author: string;
  date: string;
  message: string;
}

export interface SummaryCard {
  summary: string;
  intent: string;
  scope: string[];
  risk: string;
}

export interface StoredCommit {
  repo_path: string;
  commit_hash: string;
  author: string;
  date: string;
  message: string;
  generated_at: string;
}

export interface StoredSummary {
  id: number;
  commit_hash: string;
  repo_path: string;
  summary: string;
  intent: string;
  scope: string;
  risk: string;
  truncated: number;
  model: string;
  tokens_used: number;
  created_at: string;
}

export interface HookState {
  repo_path: string;
  installed_at: string;
  backup_path: string | null;
}

export interface LogEntry {
  timestamp: string;
  commit_hash: string;
  error_type: string;
  error_message: string;
}
