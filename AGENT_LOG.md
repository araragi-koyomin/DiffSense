# AGENT_LOG.md — DiffSense 开发过程记录

> 按时间顺序记录关键节点：触发的技能、关键 prompt、subagent 输出、人工干预、教训。

---

## 2026-06-14 | Phase 0: 基础设施搭建（人工操作）

### 触发的 Superpowers 技能
无（此阶段为手动环境配置，未进入 Superpowers 工作流）

### 完成内容
1. 安装 Superpowers 框架 → `~/.config/opencode/node_modules/superpowers`（14 个技能）
2. 安装 Open Design → `~/.config/opencode/open-design/`（155 skills + 151 design systems）
3. 初始化 Git 仓库，配置 remote → `github.com/araragi-koyomin/DiffSense`
4. 配置 GitHub Actions CI（`.github/workflows/ci.yml`）— Node.js 20 test + Docker build
5. 选题确定：**DiffSense — 代码变更语义解释器**

### 关键 Commit
- `6812d00` — initial project setup with Superpowers and CI
- `7af81f8` — add Open Design skills and refine CI for DiffSense (Node.js/TS)

### 冷启动验证：第二智能体方案

选用 **Aider** 作为 §4.5 要求的"不同类型"验证 agent。

**安装与使用：**
```bash
# 安装（已完成）
pip install aider-chat
# 或 npm install -g aider-chat

# 冷启动验证时的启动方式
cd /path/to/DiffSense
aider --model deepseek/deepseek-chat --api-key deepseek=<your-key>
# 或使用 GLM
aider --model openai/glm-4 --api-key openai=<your-key>
```

**验证流程：**
1. 启动全新 Aider session（不导入任何 OpenCode 历史）
2. 将 `SPEC.md` + `PLAN.md` 内容提供给 Aider
3. 指定 PLAN 中 1–2 个 task 让它自主实现
4. 观察：在哪里停下来提问？产出代码与预期差距？
5. 记录发现的问题到 `SPEC_PROCESS.md`，修订 SPEC/PLAN

**提示词模板：**
```
请阅读 SPEC.md 和 PLAN.md，然后从 PLAN 中选择 Task X 开始实现。
遵循 TDD：先写失败测试，再写最小实现。遇到任何不确定的地方，
停下来问我，不要凭猜测继续。所有代码写在本仓库中。
```

### 人工干预
- Superpowers 安装时遇到 Windows npm 路径问题，按官方 troubleshooting 文档用 npm 安装到 `~/.config/opencode` 解决
- Open Design 仓库过大（8000+ 文件），选择直接克隆并配置 skills.paths 引用，而非复制到项目中
- 项目级 `opencode.json` 同时挂载 Superpowers 插件 + Open Design skills + design-systems reference

### 学到的教训
- Windows 环境下 Superpowers 的 git-backed plugin 可能有 Bun 路径问题，npm 安装方式更稳定
- Open Design 的 155 个 skills 全部暴露可能影响上下文窗口，后续可按需筛选
- 冷启动验证 agent 需提前安装测试，避免到验证阶段才发现不可用

---

## 后续记录模板

```markdown
## YYYY-MM-DD | Phase N: [阶段名称]

### 触发的技能
- brainstorming / writing-plans / subagent-driven-development / test-driven-development / requesting-code-review / systematic-debugging / finishing-a-development-branch

### 关键 Prompt
> [粘贴给 agent 的 prompt]

### Subagent 输出
- Commit: `<hash>`
- 关键代码片段或链接

### 人工干预
- 修改了什么？为什么？

### 学到的教训
- [可复用的经验]
```
