# AGENT_LOG.md — DiffSense 智能体使用过程记录

> 按时间顺序记录关键节点，每项包含：时间戳、触发的 Superpowers 技能、关键 prompt / context 配置、subagent 输出关键片段、人工干预、学到的教训。

---

## [2026-06-14] Phase 1: Brainstorming — SPEC 生成

### 条目 #1 — 启动 brainstorming 流程

- **时间戳**: 2026-06-14
- **触发的 Superpowers 技能**: `brainstorming`
- **使用的智能体**: OpenCode (deepseek-v4-pro)
- **关键 prompt / context 配置**:
  - 用户提供初步想法：DiffSense — 代码变更语义解释器，git diff 解析 / 变更分块 / LLM 摘要生成 / CLI + Web / Commit 历史浏览 / Docker 单容器 / 4k-5k 行
  - 智能体加载了 `brainstorming` 技能和 `using-superpowers` 技能
  - 智能体读取了 `AI4SE_Final_Project0518.md` 项目要求文档（含 Open Design 前端强制要求）
- **人工干预**: 用户在第三轮中途打开项目需求文档，提醒智能体注意前端 Open Design 要求，智能体据此修订了 Q12 的设计方案
- **学到的教训**: 在 brainstorming 初期就让智能体读取课程要求文档（SPEC 模板、交付物清单），可以避免后期返工。本次 Q12 的修订是一次及时的纠正

---

### 条目 #2 — 21 轮结构化设计确认

- **时间戳**: 2026-06-14
- **触发的 Superpowers 技能**: `brainstorming`（持续）
- **关键决策记录**:

| 轮次 | 决策点 | 选项 | 用户选择 | 对后续设计的影响 |
|------|--------|------|---------|----------------|
| Q1 | 目标使用场景 | 个人日常 / Code Review / 审计汇报 | **A: 个人日常** | 决定了 post-commit 自动化、零干扰设计、CLI 优先 |
| Q2 | 摘要触发时机 | 按需 / post-commit hook / 混合 | **B: post-commit hook** | 决定了 `ds init` 安装机制和静默失败策略 |
| Q3 | LLM 提供商策略 | 本地 Ollama / 云端 API / 双模式 | **B: 云端 API** | 简化了实现，去掉了本地模型管理模块 |
| Q4 | 具体 LLM 提供商 | — | **DeepSeek + 智谱 GLM-4-Flash** | 用户直接指定，两者均为 OpenAI 兼容协议 |
| Q5 | 多模型配置 | 单一 / 回退链 / 按复杂度分派 | **A: 单一配置** | 简化为一个 provider 一套配置 |
| Q6 | 技术栈 | Python / Go / TypeScript | **C: TypeScript/Node.js** | 全栈统一语言，决定了整个项目骨架 |
| Q7 | 存储方案 | SQLite / JSON / Git Notes | **A: SQLite** | 决定了 better-sqlite3 依赖和数据模型设计 |
| Q8 | CLI/Web 分工 | 对等双入口 / CLI 为主 / 仅 CLI+HTML | **A: 对等双入口，CLI 优先** | 决定了开发顺序和模块组织 |
| Q9 | Diff 分块策略 | 按文件 / 按 hunk / 自适应 | **A: 按文件** | 决定了 DiffParser 的核心算法 |
| Q10 | 摘要格式 | 一句话 / 结构化卡片 / 自由叙述 | **B: 结构化卡片** | 决定了 LLM prompt 模板和输出解析逻辑 |
| Q11 | Hook 安装机制 | CLI 命令 / 全局配置 / 守护进程 | **A: `ds init`** | 决定了 init/uninit 命令设计 |
| Q12 | Web 设计系统 | Vercel / Linear / Stripe | **A: Vercel + web-design-guidelines** | 经项目要求文档纠正，选择了 Open Design 要求的设计系统 |
| Q13 | 项目结构 | 单体包 / workspaces / 单包双入口 | **C: 单包双入口** | 决定了 package.json 的 bin 和目录结构 |
| Q14 | 配置文件位置 | 全局 / per-repo / 混合层叠 | **A: 全局** | 决定了 config.ts 的实现路径 |
| Q15 | Token 超限策略 | 截断 / 降级分块 / 仅警告 | **C: 截断 + 警告** | 决定了 DiffParser 的截断逻辑 |
| Q16 | Docker 运行模型 | Web 常驻 / 可执行工具 / CLI 走 API | **B: 容器作为可执行工具** | 决定了 Dockerfile 的 ENTRYPOINT 设计 |
| Q17 | CLI 命令集 | 提议 7 条命令 | **确认** | 直接采纳 init/uninit/config/log/explain/generate/web |
| Q18 | 数据模型 | 提议 2+1 表结构 | **确认** | 直接采纳 commits/summaries/hook_state 三表设计 |
| Q19 | LLM 失败处理 | 静默日志 / 重试队列 / 终端警告 | **A: 静默失败 + 日志** | 决定了 hook-post-commit 的错误处理策略 |
| Q20 | Web 页面数量 | 单页 / 双页 / 三页 | **C: 三页** | 增加了 stats 页面模块 |
| Q21 | API Key 安全 | 文件 + 权限 / 环境变量 / 加密 | **B: 环境变量** | 决定了配置文件中不存 api_key |
| Q22 | 测试策略 | 核心引擎优先 / 全覆盖 / 关键路径 | **A: 核心引擎优先** | 决定了 tests/ 目录结构以 core/ 为主 |
| Q23 | 边界条件 | 首个 commit / 输出语言 | 首 commit 做自身摘要 + 中文 | 决定了 DiffParser 对无 parent commit 的处理 |

- **人工干预**:
  - Q4: 用户直接指定 DeepSeek + GLM-4-Flash，而非从选项中选择，智能体正确识别二者均为 OpenAI 兼容协议，采纳了选项 C 的底层方案
  - Q12: 用户打开项目需求文档，提示注意 Open Design 强制要求，智能体修订了方案
  - Q23: 用户仅回答前两个子问题（首个 commit 处理 + 中文），拒绝回答 npm 发布和搜索细节问题
- **学到的教训**:
  - 逐模块签字确认的流程有效避免了"假设用户需求"的陷阱
  - 用户中途补充上下文（打开需求文档）是常见模式，brainstorming 应保持对项目约束的敏感性
  - 有些决定用户心里已经有了明确答案（如具体的 LLM 服务商、输出语言），不需要通过选项框架引导

---

### 条目 #3 — SPEC.md 产出

- **时间戳**: 2026-06-14
- **触发的 Superpowers 技能**: `brainstorming`（产出阶段）
- **产物**: `SPEC.md`（约 400 行），包含：
  - 1 问题陈述（3 个小节）
  - 2 用户故事（6 条，INVEST 原则）
  - 3 功能规约（CLI 7 命令 + Core Engine 3 模块 + Web 3 页面）
  - 4 非功能性需求（性能/安全/可用性/可观测性/规模/部署）
  - 5 系统架构（组件图 + 数据流 + 外部依赖）
  - 6 数据模型（ER 图 + DDL + 配置文件结构）
  - 7 技术选型与理由（含 Open Design 选型说明）
  - 8 项目结构（目录树）
  - 9 验收标准（按功能逐一列出）
  - 10 风险与未决问题（6 项已识别风险 + 缓解措施）
  - 附录 A: 21 项技术决策汇总表
- **人工干预**: 无——所有决策已在 Q1–Q23 中确认，SPEC 仅做汇总
- **学到的教训**: 前期充分签字确认后，SPEC 撰写几乎零摩擦。每个章节都是对已有决策的自然展开，无需临时补充设计

---

## 阶段总结: Brainstorming

### Superpowers `brainstorming` 技能在本阶段的评价

**做得好的地方:**
- 逐模块签字确认的节奏感很好，避免了"一次抛出 20 个问题"导致决策疲劳
- 每个技术决策给出了 2-3 个对比方案，帮助用户理解 trade-off
- 最终 SPEC.md 结构完整，覆盖了课程要求的 10 项内容

**可以改进的地方:**
- 如果更早读取项目要求文档（AI4SE_Final_Project0518.md），Q12 可以一开始就对齐 Open Design 要求
- 中间有 2-3 个问题的选项框架偏弱（如 Q4 用户心里已有明确答案）

### 下一步

按 Superpowers 流程，进入 **Phase 2: `writing-plans`**，将 SPEC.md 拆解为可执行的 task 列表（PLAN.md）。

---

## [2026-06-14] Phase 2: Writing Plans — PLAN 生成

### 条目 #4 — Writing Plans 执行

- **时间戳**: 2026-06-14
- **触发的 Superpowers 技能**: `writing-plans`
- **使用的智能体**: OpenCode (deepseek-v4-pro)
- **关键 prompt / context 配置**:
  - 加载了 `writing-plans` 技能（含 plan-document-reviewer-prompt.md）
  - 读取了已经确认的 SPEC.md 作为输入
  - 按 Superpowers_Workflow_Guide.md 中「第 2 步：Writing Plans → PLAN.md」的要求执行
- **范围检查结果**: Core Engine、CLI、Web 三者共享同一数据模型，不构成独立子系统，单 PLAN 覆盖全部
- **产物**: PLAN.md，包含：
  - REQUIRED SUB-SKILL 声明
  - 任务依赖图（含并行标记）
  - 19 个 Task（T0 项目脚手架 → T19 README）
  - 每个 Task 含 4-5 个 Step：RED（测试）→ GREEN（实现）→ 验证 → Commit
  - 每个 Step 含完整代码块和精确验证命令
- **人工干预**: 首次尝试用 tool call 直接输出 PLAN 内容时因体积过大（约 114KB）被 JSON 解析截断。改用 Write 工具直接写文件成功
- **学到的教训**:
  - 当 PLAN 代码量很大时（每个 task 含完整实现代码），应优先用文件写入而非 tool call 返回
  - `writing-plans` 技能要求"每步含完整代码块"导致 PLAN 体积膨胀——实际执行时 subagent 可参考 SPEC，PLAN 中可适度精简代码量
  - 依赖图对后续 subagent-driven 并行派发至关重要，应放在 PLAN 头部

### 条目 #5 — PLAN 自审

- **时间戳**: 2026-06-14
- **触发的 Superpowers 技能**: `writing-plans`（自审阶段）
- **自审结果**:
  - SPEC 覆盖率: 全部 10 章节均有对应 Task（核心引擎→CLI→Web→Docker→CI→README）
  - 占位符扫描: 零 TBD / TODO / "add error handling"
  - 类型一致性: T1 定义的接口在 T2–T16 中名称一致
  - 依赖标注: 依赖图和并行分组已显式标注
- **人工干预**: 无
- **学到的教训**: T16 将 Web 的 list/detail/stats/API 四个子模块合并为一个 task——粒度偏粗（实际需 10-15 分钟），后续 subagent 执行时可能需要拆分
