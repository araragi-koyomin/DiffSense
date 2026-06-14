# DiffSense — 代码变更语义解释器

AI 驱动的 git commit 语义摘要工具。让 `git diff` 不仅能告诉你**改了什么**，还能告诉你**为什么改**。

## 快速开始（Docker + docker-compose）

```bash
# 1. 拉取镜像
docker pull ghcr.io/araragi-koyomin/diffsense:latest

# 2. 配置 API Key
#    PowerShell:
$env:DEEPSEEK_API_KEY = "sk-xxx"
#    Linux / macOS / Git Bash:
export DEEPSEEK_API_KEY="sk-xxx"

# 3. 初始化 + 配置（在你的 git 仓库目录下）
docker-compose run --rm diffsense init -r /repo
docker-compose run --rm diffsense config
```

## 使用方式

### Web 界面（推荐）

```bash
docker-compose up
# 访问 http://localhost:9090
# 停止: Ctrl+C
```

### CLI 命令

```bash
# 查看摘要列表
docker-compose run --rm diffsense log -r /repo

# 查看某次 commit 的详细摘要
docker-compose run --rm diffsense explain HEAD -r /repo

# 强制生成摘要（覆盖缓存）
docker-compose run --rm diffsense generate HEAD -r /repo

# 卸载 hook
docker-compose run --rm diffsense uninit -r /repo
```

## 从源码安装

```bash
git clone https://github.com/araragi-koyomin/DiffSense.git
cd DiffSense
npm install && npm run build
npm link                # 注册全局命令 ds
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `ds init` | 在当前仓库安装 post-commit hook |
| `ds uninit` | 卸载 post-commit hook |
| `ds config` | 交互式配置 LLM provider |
| `ds log [-n 10]` | 查看最近 commit 的摘要列表 |
| `ds explain <ref>` | 查看某次 commit 的详细结构化摘要 |
| `ds generate <ref>` | 强制为指定 commit 生成摘要 |
| `ds web` | 启动本地 Web 界面 |

## Web 界面 (http://localhost:9090)

三个页面：
- **摘要列表** — 展示仓库全部 commit，按 branch 筛选，勾选未分析的 commit 批量分析
- **详情页** — 完整结构化卡片（摘要 / 意图 / 影响范围 / 风险 / 文件变更列表）
- **统计面板** — 月度趋势图、模型使用分布、Token 消耗统计

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `GLM_API_KEY` | 智谱 GLM API 密钥 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址（可选） |
| `GLM_BASE_URL` | GLM API 地址（可选） |

## 技术栈

- **语言**: TypeScript / Node.js 18+
- **CLI**: commander + chalk
- **Web**: Express + SSR（Vercel Geist 设计系统）
- **存储**: SQLite（sql.js）
- **LLM**: OpenAI 兼容协议（DeepSeek / 智谱 GLM-4-Flash）
- **测试**: vitest

## 项目结构

```
src/
├── cli/          # CLI 入口 + 命令
├── core/         # 核心引擎（diff 解析 / LLM / 存储）
├── web/          # Web 服务 + 路由 + 视图
└── types.ts
tests/
├── core/         # 引擎单元测试
├── cli/          # CLI 集成测试
└── web/          # Web 测试
```
