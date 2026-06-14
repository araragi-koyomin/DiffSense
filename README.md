# DiffSense — 代码变更语义解释器

AI 驱动的 git commit 语义摘要工具。让 `git diff` 不仅能告诉你**改了什么**，还能告诉你**为什么改**。

## 快速开始

### 方式一：Docker（推荐）

```bash
docker pull ghcr.io/araragi-koyomin/diffsense:latest

# 配置（交互式）
docker run -it ghcr.io/araragi-koyomin/diffsense config

# CLI 模式
# Linux/macOS:
docker run -v $(pwd):/repo -e DEEPSEEK_API_KEY="sk-xxx" ghcr.io/araragi-koyomin/diffsense explain HEAD -r /repo
docker run -v $(pwd):/repo ghcr.io/araragi-koyomin/diffsense log -r /repo
# $(pwd) 换成所需要使用项目的仓库的路径

# Web 模式
docker run -v $(pwd):/repo -e DEEPSEEK_API_KEY="sk-xxx" -p 9090:3000 ghcr.io/araragi-koyomin/diffsense web -r /repo
```

### 方式二：从源码安装

```bash
git clone https://github.com/araragi-koyomin/DiffSense.git
cd DiffSense
npm install
npm run build
npm link          # 注册全局命令 ds

# 后续步骤同 Docker 方式
ds config
export DEEPSEEK_API_KEY="your-key"
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `ds init` | 在当前仓库安装 post-commit hook |
| `ds uninit` | 卸载 post-commit hook |
| `ds config` | 交互式配置 LLM provider（DeepSeek / 智谱 GLM） |
| `ds log [-n 10]` | 查看最近 commit 的摘要列表 |
| `ds explain <ref>` | 查看某个 commit 的详细结构化摘要 |
| `ds generate <ref>` | 强制为指定 commit 生成摘要（覆盖缓存） |
| `ds web` | 启动本地 Web 界面（默认端口 3000） |

## Web 界面

```bash
ds web
# 浏览器访问 http://localhost:3000
```

三个页面：
- **摘要列表** — 搜索、分页、多选批量分析、一键分析全部未生成摘要的 commit
- **详情页** — 完整结构化卡片（摘要 / 意图 / 影响范围 / 风险）
- **统计面板** — 月度趋势图、模型使用分布、Token 消耗统计

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（provider=deepseek 时必需） |
| `GLM_API_KEY` | 智谱 GLM API 密钥（provider=glm 时必需） |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址（可选，默认 api.deepseek.com） |
| `GLM_BASE_URL` | GLM API 地址（可选） |

## 技术栈

- **语言**: TypeScript / Node.js 18+
- **CLI**: commander + chalk
- **Web**: Express + HTMX + SSR（Vercel Geist 设计系统）
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
