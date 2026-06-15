# DiffSense — 代码变更语义解释器

AI 驱动的 git commit 语义摘要工具。打开浏览器，输入 GitHub 仓库链接，AI 自动分析 commit 语义。

## 快速开始（Docker + docker-compose）

```bash
# 1. 构建并启动
docker-compose build
docker-compose up

# 2. 打开浏览器
# 访问 http://localhost:9090
# 输入 GitHub 公开仓库 URL + API Key 即可开始分析
```
> **PowerShell 用户：** 设置环境变量用 `$env:DIFFSENSE_SECRET = "your-secret"` 替代 `export`

## 使用方式

打开 `http://localhost:9090`，你会看到：

1. **输入 GitHub 仓库 URL**（如 `https://github.com/facebook/react`）
2. **输入 LLM API Key**（DeepSeek 或 智谱 GLM）
3. 系统自动 clone 仓库并进入 commit 列表
4. 勾选想分析的 commit，点击"分析选中"
5. 查看结构化摘要（摘要 / 意图 / 影响范围 / 风险 / 文件变更列表）

会话 30 分钟无操作自动清理。

## 部署到云服务器

以华为云 ECS 为例（已在 Huawei Cloud ECS + Ubuntu 22.04 验证通过）：

```bash
# 1. SSH 登录服务器
ssh root@你的公网IP

# 2. 安装 Docker（如未安装）
curl -fsSL https://get.docker.com | sh
systemctl start docker

# 3. 生成加密密钥（至少 32 位随机字符串）
openssl rand -hex 32

# 4. 拉取镜像并启动
docker run -d --name diffsense \
  -p 9090:3000 \
  -e DIFFSENSE_SECRET="第3步生成的密钥" \
  --restart always \
  ghcr.io/araragi-koyomin/diffsense:latest web

# 5. 华为云控制台 → ECS → 安全组 → 入方向规则 → 添加 TCP 9090，源地址 0.0.0.0/0
# 6. 访问 http://你的公网IP:9090
```

> `DIFFSENSE_SECRET` 用于加密用户提交的 API Key。不设置则每次重启后已保存的 Key 失效（需重新输入）。

## 从源码安装（CLI 模式）

```bash
git clone https://github.com/araragi-koyomin/DiffSense.git
cd DiffSense
npm install && npm run build
npm link                # 注册全局命令 ds
```

### CLI 命令

| 命令 | 说明 |
|------|------|
| `ds init` | 在当前仓库安装 post-commit hook |
| `ds uninit` | 卸载 post-commit hook |
| `ds config` | 交互式配置 LLM provider |
| `ds log [-n 10]` | 查看最近 commit 的摘要列表 |
| `ds explain <ref>` | 查看某次 commit 的详细结构化摘要 |
| `ds generate <ref>` | 强制为指定 commit 生成摘要 |
| `ds web` | 启动本地 Web 界面 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DIFFSENSE_SECRET` | 加密 API Key 的密钥（可选，建议设置） |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（CLI 模式用） |
| `GLM_API_KEY` | 智谱 GLM API 密钥（CLI 模式用） |

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
├── web/          # Web 服务 + 路由 + 视图 + session
└── types.ts
tests/
├── core/         # 引擎单元测试
├── cli/          # CLI 集成测试
└── web/          # Web 测试
```
