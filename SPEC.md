# DiffSense — 代码变更语义解释器 规格说明书

> **版本**: v1.0  
> **状态**: 已确认（经 brainstorming 全部模块签字）  
> **生成方式**: Superpowers `brainstorming` 技能驱动，逐模块确认

---

## 1. 问题陈述

### 1.1 要解决的问题

`git diff` 和 `git log` 能精确告诉你**改了什么**，但无法回答**为什么改**。开发者回顾自己或团队的 commit 历史时，面对 "fix: update handler" + 200 行 diff，需要逐行阅读才能理解这段修改的真实意图。

### 1.2 目标用户

**个人开发者**——在日常工作中使用 git 进行版本控制的软件工程师。典型场景：一周后回看自己上周的 commit、接手同事离职后留下的代码库、或在某个 bug 复现时快速定位哪次提交引入了问题。

### 1.3 为什么值得做

- **信息密度提升**：AI 摘要将 200 行 diff 压缩为 3 行人类可读的意图说明，节省代码审查和回溯的时间。
- **降低认知负担**：开发者不需要在脑海中重建"当时的上下文"才能理解旧变更。
- **post-commit 自动化**：摘要随 commit 自动生成并缓存，不改变现有工作流。

---

## 2. 用户故事

| # | 用户故事 | 验收标准 |
|---|---------|---------|
| **US1** | 作为开发者，我希望每次 `git commit` 后自动生成一份中文语义摘要，这样我无需额外操作就能积累可读的变更记录。 | post-commit hook 触发后，新 commit 的摘要持久化到 SQLite，不阻塞 commit 流程；失败时静默记录日志。 |
| **US2** | 作为开发者，我希望用 `ds log` 查看最近 N 次 commit 的摘要列表，快速了解近期代码库的变化脉络。 | `ds log --n 10` 以表格形式输出：commit hash 短号、一句话摘要、日期、作者。 |
| **US3** | 作为开发者，我希望用 `ds explain <ref>` 查看某次 commit 的完整结构化摘要（意图、影响范围、风险提示），以便深入理解复杂变更。 | 输出包含意图、影响范围（文件列表）、风险提示的结构化卡片。 |
| **US4** | 作为开发者，我希望启动 `ds web` 后在浏览器中浏览 commit 历史、展开详情、查看统计面板，获得比 CLI 更丰富的可视化体验。 | Web 界面包含列表页、详情页、统计页，使用 Vercel 设计系统风格。 |
| **US5** | 作为开发者，我希望用 `ds init` 一键在 repo 中安装 post-commit hook，`ds uninit` 一键卸载，不留下残留。 | `ds init` 在 `.git/hooks/post-commit` 写入轻量调用脚本；`ds uninit` 恢复原状。 |
| **US6** | 作为开发者，我希望 API key 通过环境变量注入而不写入配置文件，保护我的密钥安全。 | 配置文件仅存 `base_url` 和 `model`；`api_key` 从 `DEEPSEEK_API_KEY` 或 `GLM_API_KEY` 环境变量读取。 |

---

## 3. 功能规约

### 3.1 模块总览

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  CLI 入口     │    │  Web 入口     │    │  Hook 入口    │
│  (bin/ds)     │    │  (ds web)     │    │  (post-commit)│
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Core Engine │
                    │  (src/core/) │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐    ┌──────┴──────┐    ┌─────┴─────┐
    │ Diff    │    │  LLM        │    │  Storage  │
    │ Parser  │    │  Client     │    │  (SQLite) │
    └─────────┘    └─────────────┘    └───────────┘
```

### 3.2 CLI 命令详细规约

#### `ds init`
- **输入**: 当前目录（须为 git repo 根目录或子目录）
- **行为**: 检测 `.git/hooks/post-commit` 是否已存在；若存在且非 DiffSense 写入，备份为 `post-commit.bak` 后追加调用；若不存在，写入新 hook 脚本（内容：`ds hook-post-commit` 内部命令）
- **输出**: 成功提示；若不在 git repo 中则报错退出
- **边界**: 已在其他 worktree 中 init 过时幂等；Windows 下 hook 脚本用 `.sh`（Git Bash 兼容）
- **错误**: 非 git 目录 → "错误：当前目录不在 Git 仓库中"；无写入权限 → 明确提示

#### `ds uninit`
- **行为**: 从 `.git/hooks/post-commit` 中移除 DiffSense 调用行；若移除后文件为空则删除文件；若有 `.bak` 文件则询问是否恢复
- **输出**: 卸载成功提示
- **错误**: 未 init 过 → "DiffSense 未在此仓库中初始化"

#### `ds config`
- **行为**: 交互式提示输入 `provider`（`deepseek` / `glm`）、`base_url`（提供默认值）、`model`（提供默认值）。不提示 API key（走环境变量）。
- **输出**: 写入 `~/.diffsense/config.json`
- **默认值**:
  - DeepSeek: `base_url=https://api.deepseek.com/v1`, `model=deepseek-chat`
  - GLM: `base_url=https://open.bigmodel.cn/api/paas/v4`, `model=glm-4-flash`
- **边界**: 已有配置时展示当前值，允许逐项跳过

#### `ds log [--n <number>] [--repo <path>]`
- **输入**: `--n` 默认 10，最大 50
- **行为**: 从 SQLite 查询当前 repo（或指定 repo）最近 N 条摘要，按 commit 时间倒序
- **输出**: 表格形式，列：`HASH(7)` | `一句话摘要` | `日期` | `作者`
- **边界**: 无摘要时输出 "暂无摘要记录，请先进行 commit 或运行 ds generate"
- **错误**: 数据库不存在 → 提示先 `ds init`

#### `ds explain <ref> [--repo <path>]`
- **输入**: git ref（`HEAD`、`HEAD~1`、`abc1234`、`main~3` 等）
- **行为**: 解析 ref → commit hash → 查 SQLite，若有缓存直接输出结构化卡片，若无缓存则调 LLM 现场生成并缓存
- **输出结构**:
  ```
  ┌─────────────────────────────────────────┐
  │ Commit: abc1234                         │
  │ Author: 张三 <zhang@example.com>         │
  │ Date:   2026-06-14 15:30:00             │
  │ Message: fix: 修复登录接口并发竞争       │
  ├─────────────────────────────────────────┤
  │ 📝 摘要: 修复了登录接口在高并发场景下    │
  │   因 token 校验未加锁导致的数据竞争问题   │
  │                                         │
  │ 🎯 意图: 线上偶发登录失败，根因定位到    │
  │   token 刷新与验证之间存在竞态窗口       │
  │                                         │
  │ 📂 影响: src/auth/login.ts,              │
  │   src/auth/token.ts,                     │
  │   tests/auth/login.test.ts               │
  │                                         │
  │ ⚠️ 风险: 低 — 仅影响并发登录路径，       │
  │   已补充集成测试覆盖                      │
  │ ⚠ 该文件变更过大，摘要可能不完整         │  (如有截断)
  └─────────────────────────────────────────┘
  ```
- **错误**: ref 无效 → "无法解析引用: <ref>"

#### `ds generate <ref> [--repo <path>]`
- **行为**: 强制为指定 ref 生成摘要（忽略已有缓存），覆盖旧记录
- **输出**: 与 `ds explain` 相同的结构化卡片
- **用途**: 手动补全缺失的摘要、或在摘要质量不满意时重新生成

#### `ds web [--port <number>]`
- **行为**: 启动本地 Web 服务器（默认端口 3000），打开浏览器显示 Web 界面
- **输出**: 终端打印 `DiffSense Web 界面已启动: http://localhost:3000`
- **边界**: 端口被占用时自动尝试 3001/3002

#### `ds hook-post-commit`（内部命令，用户不可见）
- **触发**: 被 post-commit hook 调用
- **行为**: 获取最新 commit hash → 调 Core Engine 生成摘要并缓存 → 静默处理失败
- **输出**: 成功/失败均无终端输出（零干扰）

### 3.3 Core Engine 模块规约

#### 3.3.1 Diff Parser
- **输入**: repo 路径 + commit hash
- **行为**: 执行 `git diff <hash>^..<hash>`（首个 commit 时用 `git show <hash>`）获取 diff 文本 → 按文件边界拆分为文件块（每个文件一个块）→ 对每个块计算近似 token 数（字符数 / 2.5）
- **输出**: `FileChunk[]`，每项包含 `{ filename, diffContent, tokenEstimate, truncated }`
- **截断规则**: 单文件 diff 超过 8000 token 估计值时截断，末尾追加 `[...truncated, X lines omitted]`，标记 `truncated=true`
- **边界**: 首个 commit（无 parent）用 `git show`；二进制文件跳过；仅删除的文件生成特殊标记
- **错误**: git 命令失败 → 抛出 `DiffParseError`

#### 3.3.2 LLM Client
- **输入**: provider 配置（base_url, model, api_key）+ 文件块列表 + commit 元信息
- **行为**: 构建 prompt（system prompt: "你是代码审查助手，请用中文输出结构化摘要" + user prompt: diff 内容 + 输出格式约束），调用 OpenAI 兼容 `/chat/completions` API
- **Prompt 模板**:
  ```
  System: 你是一个代码变更分析助手。请分析以下 git diff，用中文输出结构化摘要。严格按 JSON 格式返回，不要输出其他内容。

  User: 
  原始 Commit Message: {message}
  变更文件数: {fileCount}

  --- DIFF ---
  {diffContent}

  请返回 JSON:
  {
    "summary": "一句话摘要（不超过80字）",
    "intent": "变更意图，说明为什么做这个改动",
    "scope": ["文件路径1", "文件路径2"],
    "risk": "风险提示（低/中/高，附简要说明）"
  }
  ```
- **输出**: 解析 LLM 返回的 JSON → `SummaryCard` 结构
- **错误处理**: 网络超时（30s）→ 抛出 `LLMTimeoutError`；API 返回非 200 → 抛出 `LLMAPIError`（含 status code）；JSON 解析失败 → 抛出 `LLMResponseParseError`（入原始响应）
- **无重试**: 单次调用，失败由调用方处理

#### 3.3.3 Storage (SQLite)
- **数据库位置**: `<repo_git_dir>/../.diffsense.db`（即 repo 根目录下）
- **表结构**: 见 §6 数据模型
- **核心操作**:
  - `upsertCommit(commit)` — 插入或更新 commit 记录
  - `upsertSummary(summary)` — 插入或更新摘要（同一 commit 可覆盖）
  - `getSummariesByRepo(repoPath, limit, offset)` — 按时间倒序查询
  - `getSummaryByHash(repoPath, hash)` — 单条查询
  - `getStats(repoPath)` — 统计查询：commit 总数、模型使用分布、每月数量
- **初始化**: 首次使用时自动建表（DDL 内嵌代码）

### 3.4 Web 界面规约

采用 **Vercel 设计系统**（`web-design-guidelines` skill），服务端渲染 + HTMX 实现无刷新交互。

#### 页面 1: 列表页（`/`）
- **内容**: commit 摘要时间线，每条卡片展示：hash(7)、一句话摘要、日期、模型标识
- **交互**: 搜索框（commit message 关键词模糊搜索）、筛选（日期范围）、点击卡片展开简要信息
- **分页**: 每页 20 条，底部加载更多

#### 页面 2: 详情页（`/commits/:hash`）
- **内容**: 完整结构化卡片（摘要、意图、影响范围、风险提示）+ 原始 commit message
- **交互**: 文件列表可点击展开 diff（截断版本）

#### 页面 3: 统计页（`/stats`）
- **内容**: 月度 commit 趋势图、模型使用分布饼图、token 消耗统计
- **实现**: 简单 SVG 图表（不依赖第三方图表库）

#### 路由设计
| 路径 | 方法 | 描述 |
|------|------|------|
| `/` | GET | 列表页 |
| `/api/commits` | GET | 分页查询 API（`?q=&page=&date_from=&date_to=`） |
| `/commits/:hash` | GET | 详情页 |
| `/api/commits/:hash` | GET | 单条摘要 API |
| `/stats` | GET | 统计页 |
| `/api/stats` | GET | 统计数据 API |

---

## 4. 非功能性需求

### 4.1 性能
- CLI 命令（`ds log`）启动到输出完成 < 500ms（不含 LLM 调用）
- LLM 摘要生成 < 30s（受 API 响应时间约束）
- Web 页面首次加载 < 1s

### 4.2 安全
- API key **严格禁止**写入配置文件或数据库，仅从环境变量读取
- post-commit hook 脚本权限 `chmod 755`
- Web 服务仅绑定 `127.0.0.1`（localhost），不对外暴露

### 4.3 可用性
- 所有中文输出
- CLI 输出宽度自适应终端（默认 80 列，宽终端利用更多列）
- 错误信息明确、可操作（包含建议的修复步骤）

### 4.4 可观测性
- LLM 调用失败写入 `~/.diffsense/errors.log`（JSON 格式，每行一条记录）
- 日志记录：时间戳、commit hash、错误类型、错误消息

### 4.5 代码规模
- 有效代码量（不含测试）: 4000–5000 行 TypeScript
- 测试代码量: 约 1500–2500 行

### 4.6 部署
- Docker 单容器，`docker build -t diffsense . && docker run diffsense <command>`
- 镜像大小目标 < 300MB

---

## 5. 系统架构

### 5.1 组件图

```
                         ┌──────────────────────────┐
                         │       User Terminal       │
                         └──────────┬───────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
              │ ds init   │  │ ds log    │  │ds explain │
              │ ds uninit │  │ ds config │  │ds generate│
              │ ds web    │  │           │  │           │
              └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │    CLI Router      │
                          │  (src/cli/index.ts) │
                          └─────────┬─────────┘
                                    │
                          ┌─────────┴─────────┐
                          │    Core Engine     │
                          │  (src/core/)       │
                          │                    │
                          │  ┌──────────────┐  │
                          │  │ DiffParser   │  │
                          │  │ git diff     │  │
                          │  │ file chunking │  │
                          │  └──────┬───────┘  │
                          │         │          │
                          │  ┌──────┴───────┐  │
                          │  │ LLMClient    │  │
                          │  │ OpenAI compat│  │
                          │  │ prompt build │  │
                          │  │ response parse│  │
                          │  └──────┬───────┘  │
                          │         │          │
                          │  ┌──────┴───────┐  │
                          │  │ Storage      │  │
                          │  │ SQLite CRUD  │  │
                          │  └──────┬───────┘  │
                          └─────────┼─────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
              │ .diffsense │  │ ~/.diffsense│  │ .git/hooks  │
              │ .db        │  │ config.json │  │ post-commit │
              └───────────┘  └────────────┘  └────────────┘
```

### 5.2 数据流

```
git commit → post-commit hook → ds hook-post-commit
  → CLI Router → Core Engine
    → DiffParser.execGitDiff(repo, hash) → FileChunk[]
    → LLMClient.generateSummary(chunks, meta)
      → HTTP POST /chat/completions → OpenAI Compat API
      → parse JSON response → SummaryCard
    → Storage.upsertSummary(card)
  → 静默结束（失败写 errors.log）
```

### 5.3 外部依赖
| 依赖 | 用途 | 版本约束 |
|------|------|---------|
| Node.js | 运行时 | >= 18 |
| TypeScript | 编译 | ^5.x |
| better-sqlite3 | SQLite 绑定 | ^11.x |
| commander | CLI 框架 | ^12.x |
| chalk | 终端颜色 | ^5.x |
| express | Web 服务 | ^4.x |
| htmx.org | Web 前端交互 | ^2.x (CDN) |
| simple-git | git 操作封装 | ^3.x |

无 Redis、无 PostgreSQL、无消息队列——零外部服务依赖。

---

## 6. 数据模型

### 6.1 ER 图（逻辑）

```
┌──────────────┐       ┌──────────────────┐
│   commits    │       │    summaries     │
├──────────────┤       ├──────────────────┤
│ repo_path  PK│──┐    │ id            PK │
│ commit_hashPK│──╋━━━━│ commit_hash   FK │
│ author       │  │    │ repo_path     FK │
│ date         │  │    │ summary          │
│ message      │  │    │ intent           │
│ generated_at │  │    │ scope (JSON)     │
└──────────────┘  │    │ risk             │
                  │    │ truncated        │
                  │    │ model            │
                  │    │ tokens_used      │
                  │    │ created_at       │
                  │    └──────────────────┘
                  │
                  │    ┌──────────────────┐
                  │    │   hook_state     │
                  │    ├──────────────────┤
                  └────│ repo_path     PK │
                       │ installed_at     │
                       │ backup_path      │
                       └──────────────────┘
```

### 6.2 DDL

```sql
CREATE TABLE IF NOT EXISTS commits (
    repo_path    TEXT NOT NULL,
    commit_hash  TEXT NOT NULL,
    author       TEXT,
    date         TEXT,
    message      TEXT,
    generated_at TEXT,
    PRIMARY KEY (commit_hash, repo_path)
);

CREATE TABLE IF NOT EXISTS summaries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_hash  TEXT NOT NULL,
    repo_path    TEXT NOT NULL,
    summary      TEXT NOT NULL,
    intent       TEXT,
    scope        TEXT,            -- JSON array of file paths
    risk         TEXT,
    truncated    INTEGER DEFAULT 0,
    model        TEXT,
    tokens_used  INTEGER,
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (commit_hash, repo_path) 
        REFERENCES commits(commit_hash, repo_path)
);

CREATE TABLE IF NOT EXISTS hook_state (
    repo_path    TEXT PRIMARY KEY,
    installed_at TEXT,
    backup_path  TEXT
);

CREATE INDEX IF NOT EXISTS idx_summaries_repo_date 
    ON summaries(repo_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commits_repo_date 
    ON commits(repo_path, date DESC);
```

### 6.3 配置文件结构 (`~/.diffsense/config.json`)

```json
{
  "provider": "deepseek",
  "base_url": "https://api.deepseek.com/v1",
  "model": "deepseek-chat",
  "token_limit": 8000,
  "web_port": 3000
}
```

> **注意**: `api_key` 不在此文件中，必须通过环境变量 `DEEPSEEK_API_KEY` 或 `GLM_API_KEY` 注入。

---

## 7. 技术选型与理由

| 选项 | 选择 | 理由 |
|------|------|------|
| **语言** | TypeScript (Node.js) | 全栈统一语言，CLI+Web 共享代码；`commander`+`chalk` 成熟的 CLI 生态；`express` 轻量 Web |
| **数据库** | SQLite (better-sqlite3) | 零配置单文件，Docker 单容器无外部依赖；同步 API 简单可靠，无需连接池 |
| **CLI 框架** | commander | Node 生态标准，声明式命令定义 |
| **Web 服务** | Express 4.x | 最小化服务端，仅处理路由和 API；配合 HTMX 无需前端构建 |
| **Web 前端** | 服务端渲染 + HTMX | 无前端构建步骤，交互够用（分页、搜索、展开），代码量符合 4-5k 行目标 |
| **Git 操作** | simple-git | 封装 `git diff`、`git show`、`git log` 等命令，避免手写 shell |
| **LLM 调用** | 原生 `fetch` + OpenAI 兼容协议 | DeepSeek/GLM 均支持 `/chat/completions`，一套代码覆盖；避免引入重量级 SDK |
| **设计系统** | Vercel + `web-design-guidelines` | 中性工具型审美、数据展示友好、`web-design-guidelines` skill 提供完整布局/排版/色彩指导 |
| **Open Design Skill** | `web-design-guidelines` | 覆盖布局、typography、色彩、动效、可访问性的完整设计指南，适合严肃工具界面 |
| **Docker** | 单容器多模式 | `docker run diffsense <cmd>` 即 CLI 模式；`docker run -p 3000:3000 diffsense web` 即 Web 模式 |

### 7.1 Open Design 选型说明

- **设计系统**: Vercel — 简洁、中性、偏数据展示的设计语言，与 DiffSense 作为开发者工具的品牌调性一致
- **Skill**: `web-design-guidelines` — 提供界面布局、排版层级、色彩搭配、动效微交互、可访问性的系统化指导
- **反 AI-slop 保障**: 该 skill 内置设计维度自评和 checklist，确保界面不落入"千篇一律"的 LLM 生成陷阱

---

## 8. 项目结构

```
diffsense/
├── src/
│   ├── cli/
│   │   ├── index.ts            # CLI 入口（bin/ds）
│   │   ├── commands/
│   │   │   ├── init.ts
│   │   │   ├── uninit.ts
│   │   │   ├── config.ts
│   │   │   ├── log.ts
│   │   │   ├── explain.ts
│   │   │   ├── generate.ts
│   │   │   └── web.ts
│   │   └── hook-post-commit.ts  # 内部命令
│   ├── core/
│   │   ├── index.ts             # Core Engine 入口
│   │   ├── diff-parser.ts       # git diff 执行与分块
│   │   ├── llm-client.ts        # LLM API 调用与 prompt 构建
│   │   ├── storage.ts           # SQLite CRUD 操作
│   │   ├── config.ts            # 配置文件读写
│   │   ├── logger.ts            # 错误日志
│   │   └── types.ts             # 共享类型定义
│   ├── web/
│   │   ├── index.ts             # Express 服务启动
│   │   ├── routes/
│   │   │   ├── pages.ts         # 页面路由（SSR）
│   │   │   └── api.ts           # JSON API
│   │   └── views/
│   │       ├── layout.html      # 布局模板
│   │       ├── list.html        # 列表页
│   │       ├── detail.html      # 详情页
│   │       └── stats.html       # 统计页
│   └── types.ts                 # 项目全局类型
├── tests/
│   ├── core/
│   │   ├── diff-parser.test.ts
│   │   ├── llm-client.test.ts
│   │   └── storage.test.ts
│   ├── cli/
│   │   └── commands.test.ts
│   └── fixtures/
│       └── sample-diffs/        # 测试用 diff 样本
├── package.json
├── tsconfig.json
├── Dockerfile
├── README.md
├── SPEC.md                      # 本文件
├── PLAN.md                      # 实现计划（待产出）
└── SPEC_PROCESS.md              # 过程记录（待产出）
```

---

## 9. 验收标准

| 功能 | 验收标准 |
|------|---------|
| **ds init** | `ds init` 在 git repo 中成功写入 post-commit hook；`ds uninit` 移除 hook 并恢复原状；非 repo 目录报错 |
| **ds config** | 交互式输入后生成有效的 `~/.diffsense/config.json`；API key 不在文件中 |
| **ds log** | `ds log --n 5` 输出最近 5 条摘要，含 hash、摘要、日期、作者；空数据时提示友好 |
| **ds explain** | `ds explain HEAD` 输出完整结构化卡片（摘要+意图+范围+风险）；truncated 文件显示警告 |
| **ds generate** | `ds generate HEAD~1` 调用 LLM 生成摘要并持久化；覆盖已有缓存 |
| **ds web** | 浏览器访问 `localhost:3000` 可见列表页；点击进入详情页；`/stats` 显示统计面板 |
| **post-commit hook** | `git commit` 后自动生成摘要并写入 SQLite；失败不阻断 commit；错误写入 `errors.log` |
| **Docker** | `docker build -t diffsense . && docker run diffsense log` 输出正常；`docker run -p 3000:3000 diffsense web` 可访问 Web |
| **测试** | `npm test` 一键运行全部测试；测试通过率 100%；核心模块覆盖率 > 80% |
| **安全** | 配置文件中无 API key；Web 仅绑定 127.0.0.1 |

---

## 10. 风险与未决问题

### 10.1 已识别风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 返回非标准 JSON | 摘要生成失败，需重试 | Prompt 中约束 JSON 格式 + 解析失败时尝试 `JSON.parse` 容错（trim 前后空白、去掉 markdown code fence） |
| 大文件 diff 超出 token 限制 | 摘要不完整 | 截断 + 警告标记；开发者可手动用 `ds explain --file <path>` 深度分析（未来扩展） |
| DeepSeek API 不稳定 | 摘要生成间歇失败 | 静默失败 + 日志 + `ds generate` 手动重试；后续可加 fallback 到 GLM |
| 并发 `ds generate` 写入 SQLite | 可能锁冲突 | better-sqlite3 默认串行化，单用户场景下概率低；必要时加 WAL 模式 |
| Windows Git Bash hook 兼容性 | hook 脚本可能不执行 | 使用 `.sh` 脚本（Git Bash 自带），README 注明需 Git Bash 环境 |
| HTMX + SSR 交互局限性 | Web 交互不如 SPA 流畅 | 当前功能（分页、搜索、展开）HTMX 完全胜任；如需复杂交互可后续迁移 |

### 10.2 未决问题
- 多个 repo 同时使用 DiffSense 时，SQLite 文件隔离（当前设计：每个 repo 独立 `.diffsense.db`），但全局配置共享——需确认无冲突
- 摘要质量评估：没有客观指标衡量"摘要好不好"，依赖开发者主观判断。后续可加 thumbs up/down 反馈收集

---

## 附录 A: 技术决策记录汇总

| # | 决策点 | 选择 |
|---|--------|------|
| 1 | 目标场景 | 个人开发者日常使用 |
| 2 | 摘要触发时机 | post-commit hook 自动生成 + 本地缓存 |
| 3 | LLM 提供商 | 仅云端 API — DeepSeek + 智谱 GLM-4-Flash |
| 4 | 多模型配置 | 单一配置 |
| 5 | 技术栈 | TypeScript/Node.js |
| 6 | 存储方案 | SQLite (better-sqlite3) |
| 7 | CLI/Web 关系 | 对等双入口，CLI 优先开发 |
| 8 | Diff 分块策略 | 按文件分块 |
| 9 | 摘要格式 | 结构化卡片（摘要+意图+范围+风险） |
| 10 | Hook 安装 | `ds init` 写入 post-commit |
| 11 | Web 设计系统 | Vercel + `web-design-guidelines` |
| 12 | 项目结构 | 单包 + 双入口（bin → CLI, `ds web` → Web） |
| 13 | 配置文件 | `~/.diffsense/config.json` 全局 |
| 14 | 截断策略 | 截断 + 警告标记 |
| 15 | Docker | 单容器，CLI/Web 两种运行模式 |
| 16 | API Key 安全 | 环境变量优先，配置文件不存 |
| 17 | LLM 失败处理 | 静默失败 + 日志 + 手动重试 |
| 18 | Web 页面 | 三页（列表 + 详情 + 统计） |
| 19 | 测试策略 | 核心引擎优先（单元测试 + 集成测试） |
| 20 | 首个 commit | 单 commit 自身摘要 |
| 21 | 输出语言 | 中文 |

---

## Phase 2: 多仓库 SaaS Web 模式

> **版本**: v2.0  
> **状态**: brainstorming 确认（8 项设计决策签字）  
> **生成方式**: Superpowers `brainstorming` 技能驱动

### 2.1 问题陈述

**当前局限**: DiffSense 部署为单仓库工具——服务启动时绑定一个固定 repo 路径，所有分析围绕该仓库。新用户无法通过 Web 界面提交自己的仓库进行分析。

**目标**: 将 DiffSense 改造为 SaaS 形态——任意访客打开网站，输入 GitHub 公开仓库链接 + API Key，即可对该仓库进行 AI 语义分析。

**核心价值**: 零部署成本——用户不需要安装 Docker、clone 代码、配置环境变量，打开浏览器即可使用。

### 2.2 用户模型

**无账号模式**: 不要求注册/登录。访客即用。通过 Cookie session token 标识会话。

### 2.3 功能规约

#### 模块 1: 首页（新增）

| 项目 | 规约 |
|------|------|
| **URL** | `GET /` |
| **界面** | 单一输入框：GitHub 仓库 URL + API Key 输入框 + "开始分析"按钮 |
| **输入验证** | URL 须匹配 `https://github.com/<owner>/<repo>`；API Key 须非空 |
| **错误处理** | clone 失败 → 前端显示"无法访问该仓库，请确认是公开仓库且 URL 正确"；不支持私有仓库 |

#### 模块 2: 仓库管理（新增）

| 项目 | 规约 |
|------|------|
| **Clone** | 服务端 `git clone --depth=50 <url>` 到 `repos/<session-id>/<owner>-<repo>/` |
| **数据隔离** | 每仓库独立 `.diffsense.db`，存放在 repo 目录下（和现有逻辑一致） |
| **生命周期** | 会话级保留。30 分钟无 HTTP 请求 → 自动清理（删除 repo 目录 + 内存 session）。每次请求刷新 TTL |
| **清理机制** | 定时任务每 5 分钟扫描一次 session，清除过期仓库 |

#### 模块 3: Session 管理（新增）

| 项目 | 规约 |
|------|------|
| **Session 创建** | 首次 clone 成功时生成 UUID session token，设置 HTTP-only Cookie，30 分钟过期 |
| **Session 恢复** | 用户再次访问时，服务端读取 Cookie 中的 token，查找对应 session 的 repo 路径 |
| **Session 存储** | 内存 Map（不持久化），重启服务后全部丢失 |

#### 模块 4: API Key 管理（新增）

| 项目 | 规约 |
|------|------|
| **存储** | 服务端加密存储（AES-256-GCM），密钥为环境变量 `DIFFSENSE_SECRET` 或启动时随机生成 |
| **使用** | 分析 commit 时解密读取，通过 OpenAI 兼容协议发送到 LLM 提供商 |
| **删除** | 用户可在设置中删除已存储的 API Key |

#### 模块 5: 列表页（改动）

| 项目 | 规约 |
|------|------|
| **行为** | 与现有列表页完全一致，但 repo 路径从 session 获取而非启动参数 |
| **新增** | 若 session 过期或 repo 不存在，重定向回首页 |

#### 模块 6: 详情页 / 统计页 / 分析 API（无改动）

复用现有实现，repo 路径从 session 获取。

### 2.4 非功能性需求

| 项目 | 规约 |
|------|------|
| **安全** | API Key AES-256-GCM 加密存储；`DIFFSENSE_SECRET` 必须通过环境变量注入，如未设置则启动时随机生成（重启后旧 Key 无法解密） |
| **性能** | Clone 深度限制 50 commits，单次 clone 超时 30s |
| **资源** | 单个 repo 磁盘占用约 50MB（含 git objects + DB）；需要定期清理过期 session |
| **并发** | 不同 session 互不干扰（独立 repo 目录 + 独立 DB） |

### 2.5 新增设计决策

| # | 决策点 | 选择 |
|---|--------|------|
| 22 | 用户模型 | 无账号，访客即用 |
| 23 | 仓库生命周期 | 会话级，30 分钟无操作自动清理 |
| 24 | API Key 处理 | 服务端 AES-256-GCM 加密存储 |
| 25 | 首页设计 | 单输入框：URL + Key |
| 26 | 数据隔离 | 每仓库独立 `.diffsense.db` |
| 27 | 会话机制 | Cookie session token，30 分钟过期 |
| 28 | Clone 失败处理 | 即时前端错误提示 |
| 29 | 添加后行为 | 跳转列表页，手动勾选分析 |
