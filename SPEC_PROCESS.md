# SPEC_PROCESS.md — DiffSense 规约与计划生成过程文档

> 记录与 Superpowers 协作生成 SPEC.md 和 PLAN.md 的全过程，包括 brainstorming 关键节点、冷启动验证发现、修订决策。

---

## 1. Brainstorming 关键节点

Superpowers 的 `brainstorming` 技能在本次项目中通过 **23 轮逐模块签字确认** 推进。以下是对我原本设想产生实质影响的关键追问：

### 1.1 Q12 迫使我关注 Open Design 选型

**智能体的追问：** 在讨论 Web 前端方案时，智能体给出 A（Express+EJS）、B（React+shadcn/ui）、C（Express+HTMX）三种选项。我在看到这个框架时意识到漏掉了课程强制要求——立即打开 `AI4SE_Final_Project0518.md` 中断对话。

**我的修正：** 明确告诉智能体"按照项目中前端部分的严格要求"，智能体重新读取需求文档后发现 **含前端必须使用 Open Design**。智能体随即给出 Vercel / Linear / Stripe 三个设计系统的对比方案。

**影响：** 我原本想选"C: Express + HTMX"（最轻量），但由于 Open Design 约束，最终选择了 **Vercel + `web-design-guidelines` skill**。这个约束是外部给定的（课程要求），不是 brainstorming 产生的，但智能体在我中断对话后灵活适配了约束条件。

### 1.2 Q4 让我意识到自己已有明确技术偏好

**智能体的追问：** 在 LLM 提供商策略 Q3 中我选了"仅云端 API"后，智能体追问具体支持哪些服务商，给出 A（仅 OpenAI）、B（OpenAI+Anthropic）、C（OpenAI 兼容通用）三选。

**我的回答：** 我直接跳过了选项框架，输入了 **"deepseek api/glm 4.7 flash api"**。这意味着我心里的答案已经成型——智能体的选项框架在我这里起到了"提示我表达已有想法"的作用，而非"帮我做选择"。

**反思：** 这是一个典型场景：对于已经做过调研的技术选型，brainstorming 的三选框架更多是"确认"而非"建议"。智能体正确地识别了 DeepSeek/GLM 都是 OpenAI 兼容格式，归入了方案 C 的底层实现。

### 1.3 Q1-Q2 澄清了"为什么做"而非仅仅"做什么"

**智能体的追问：** 我的初步描述是"git diff 看得懂改了什么但看不懂为什么改"，智能体没有直接跳到"怎么做"，而是先问 **Q1：目标场景**（个人日常 / Code Review / 审计汇报）和 **Q2：触发时机**（按需 / post-commit hook / 混合）。

**我的修正：** 我原本想法模糊——既想做个人工具又想做 code review 辅助。Q1 强迫我在三个场景中选一个，最后选了 **A：个人日常**。这个选择连锁影响了 Q2（post-commit hook）、Q10（结构化卡片格式）、Q19（静默失败策略）的设计决策。

**影响：** 如果没有 Q1 的聚焦，DiffSense 会变成一个试图同时服务三个场景的模糊项目。聚焦到"个人日常"后，设计收敛为：**零干扰、自动化、缓存优先**。

---

## 2. 关键迭代（至少 3 轮）

### 迭代 1：从模糊想法到确认的目标场景（Q1–Q3）

**对话节选：**
> 智能体：Q1 — DiffSense 的主要使用场景是什么？A) 个人日常 B) Code Review 辅助 C) 审计汇报
> 我：A
> 智能体：Q2 — 摘要生成时机？A) 按需 B) post-commit hook C) 混合
> 我：B
> 智能体：Q3 — LLM 策略？A) 本地 Ollama B) 云端 API C) 双模式
> 我：B

**我的决策：** 在项目启动的最初三轮，我迅速聚焦到"个人日常 + post-commit 自动 + 云端 API"。这三个决策互相关联——如果选了"审计汇报"，则摘要格式需要非技术人员可读、触发时机可能不是 post-commit hook。早期聚焦避免了设计发散。

**智能体的表现：** Q1→Q2→Q3 的问题链有逻辑递进——先确定"谁用"，再确定"何时触发"，最后确定"用什么能力"。这是 brainstorming 做得不错的地方。

---

### 迭代 2：技术栈选择引发的连锁决策（Q6–Q13）

**对话节选：**
> 智能体：Q6 — 技术栈？A) Python B) Go C) TypeScript/Node.js
> 我：C
> （随后 Q7–Q13 在 TypeScript 生态下逐项确认存储/分块/摘要格式/CLI-Web 关系/设计系统/项目结构）

**我的决策：** 选择 TypeScript 是这次 brainstorming 中影响最深远的单个决策——它决定了后续 SQLite（better-sqlite3）、CLI 框架（commander）、Web 方案（Express）、测试框架（vitest）的全部选型。如果选了 Go，这些决策会完全不同。

**智能体的表现：** Q6 的选项描述准确地概括了各语言的 trade-off（Python 生态好但镜像大、Go 镜像小但 Web 需要嵌入、TypeScript 全栈统一）。我在评价 trade-off 时确认了"全栈统一语言"是核心考量。

---

### 迭代 3：用户主动打断→约束条件注入→方案重新对齐（Q12）

**对话节选：**
> 智能体：Q12 — Web 前端方案？A) EJS B) React C) HTMX
> 我：（打开 AI4SE_Final_Project0518.md）"按照其中前端部分的严格要求"
> 智能体：（读取需求文档，发现 Open Design 强制要求）Q12 修订：A) Vercel B) Linear C) Stripe
> 我：A

**我的决策：** 这是唯一一次**中断对话**——智能体给的三选方案在技术上是合理的（HTMX），但违反了课程的外部约束（含前端必须用 Open Design）。我选择不回答原始问题而是提供新上下文。

**智能体的表现：** 重新读取需求文档后，智能体自动识别出约束条件，替换了原始三选方案为三个 Open Design 设计系统的对比。这次"上下文注入→方案重新对齐"的流畅程度超出了我的预期。

**学到的教训：** 在 AI 协作中，用户主动提供约束上下文（尤其是外部文件定义的约束）是正常且必要的。brainstorming 的价值在于当约束变化时能快速重新对齐方案，而不是机械执行最初的对话。

## 3. AI 建议采纳与推翻记录

| 建议 | 来源 | 采纳/推翻 | 理由 |
|------|------|-----------|------|
| 使用 SQLite (better-sqlite3) 而非 PostgreSQL | brainstorming Q7 | 采纳 | 单机 CLI 工具无需客户端-服务器数据库，SQLite 零配置、单文件、Docker 无外部依赖 |
| 按文件分块（而非按 hunk 分块 + 上下文补齐） | brainstorming Q9 | 采纳 | 按文件分实现最简单，语义完整性好；截断策略（Q15）兜底处理大文件场景 |
| 使用 Vercel + web-design-guidelines 设计系统 | brainstorming Q12（修订后） | 采纳 | 受课程 Open Design 强制要求约束，Vercel 是三个选项中与开发者工具品牌调性最匹配的 |
| 单包 + 双入口项目结构 | brainstorming Q13 | 采纳 | 4-5k 行级别过度工程化得不偿失，单包足够清晰 |
| 全局配置文件 `~/.diffsense/config.json` | brainstorming Q14 | 采纳 | 个人工具只需一份全局配置，per-repo 配置增加不必要的复杂度 |
| 截断 + 警告标记（不自动降级分块） | brainstorming Q15 | 采纳 | 简单且不增加 LLM 调用成本；开发者可手动 `ds explain` 深入查看 |
| 静默失败 + 日志 + 手动重试 | brainstorming Q19 | 采纳 | post-commit hook 不阻塞 commit 流程是第一原则 |
| 网页三页（列表+详情+统计）而非单页 | brainstorming Q20 | 采纳 | 统计面板提供额外价值（月度趋势、模型分布），且不显著增加代码量 |
| 环境变量优先（不存 API key 到文件） | brainstorming Q21 | 采纳 | 安全性最佳实践：配置文件可公开分享而不泄露密钥 |
| 核心引擎优先测试 | brainstorming Q22 | 采纳 | CLI/Web 做集成测试即可，核心引擎是摘要质量的关键路径 |
| 单一 LLM 配置（不搞回退链或复杂度分派） | brainstorming Q5 | 采纳 | 个人工具不需要多模型路由的复杂度，简单即正确 |

---

### 我推翻或修正的 AI 建议

| 原本 AI 建议 | 我的修正 | 理由 |
|-------------|---------|------|
| Q4 给的三选方案（OpenAI / OpenAI+Anthropic / 通用协议） | 我直接指定 DeepSeek + GLM-4-Flash | 已有明确的技术偏好，不需要选项框架筛选 |
| Q23 的 4 个子问题（首个 commit / 国际化 / npm 发布 / Web 搜索细节） | 我只回答前两个，拒绝回答后两个 | npm 发布不在项目范围内；Web 搜索细节在实现阶段决定即可 |
| T16 首次 PLAN 中 Web 四页合并一个 task | 要求拆分为 T16a-d 四个子 task | 原始粒度 subagent 执行时上下文膨胀，拆分后聚焦单一页面 |

---

## 4. 冷启动验证记录（V0）

### 验证 Agent
- **类型:** Aider（deepseek-chat）
- **与主开发 Agent 的关系:** 类型不同（主开发 = OpenCode）
- **分配的 Task:** PLAN.md T1（核心类型定义）
- **日期:** 2026-06-14

### 启动方式
```bash
aider --model deepseek/deepseek-chat
# 提供 SPEC.md + PLAN.md，全新 session，无历史上下文
```

### 发现的问题

#### 问题 1：Aider 在启动时立即询问 T0 脚手架缺失如何处理

**Aider 原话:**
> "PLAN.md 中 T1 的测试代码使用了 describe、it、expect 等全局 API，但 vitest.config.ts 中设置了 globals: true。然而，当前目录下还没有 vitest.config.ts 文件（T0 尚未执行）。我需要先创建 vitest.config.ts 吗？还是直接写测试文件，等运行时再处理配置？另外，package.json 和 tsconfig.json 也尚未创建。"

**暴露的问题:**
- 非 SPEC 缺陷。Aider 正确理解了 T0→T1 的依赖关系。
- PLAN.md minor 改进项：T1 作为独立 task（尤其是冷启动验证入口）时，缺少"若脚手架未建立"的 precondition 说明。
- 判定：PLAN 可改进，非阻塞性问题。

**SPEC.md / PLAN.md 修订:**
```diff
  ### T1: 核心类型定义

+ > **前置条件:** 若项目尚未初始化（T0 未执行），先创建 `tsconfig.json`
+ > （T0 第2步）与 `vitest.config.ts`（T0 第3步），再开始本 task。
- 
  **涉及文件:** `src/core/types.ts`、`tests/core/types.test.ts`
```

---

#### 问题 2：Aider 首次运行测试时未写入文件到磁盘

**现象：**
> `npx vitest run tests/core/types.test.ts` → "No test files found, exiting with code 1"

**原因：** Aider 在对话中展示了代码但未实际调用文件写入工具。需要明确指令"请将文件写入磁盘"后才执行。

**暴露的问题：**
- 非 SPEC/PLAN 缺陷，属于冷启动 agent 工具调用行为差异。
- Aider 的文件写入需要显式触发，与 OpenCode 的自动写入行为不同。
- 对 PLAN 无修订需求，但值得在 AGENT_LOG.md 中记录为 agent 行为差异。

---

#### 问题 3：Aider 格式化风格与 PLAN.md 不一致但功能等价

**现象：**
- PLAN.md T1 中 types.ts 使用多行格式 + JSDoc 注释；Aider 写成单行紧凑格式，无注释
- PLAN.md T1 测试文件使用多行 it 块；Aider 写成单行

**判定：** 不影响功能正确性。PLAN.md 的代码块是"参考实现"而非"强制格式"。Aider 的简化可读性略差但不违反任何约束。

---

### 验证产出对照

| 文件 | PLAN.md 要求 | Aider 产出 | 一致性 |
|------|-------------|-----------|--------|
| `tsconfig.json` | T0 Step 2，11 行 | 逐字匹配 | ✅ |
| `vitest.config.ts` | T0 Step 3，4 行 | 逐字匹配 | ✅ |
| `src/core/types.ts` | T1 Step 3，8 个 interface | 8 个 interface 全部定义，类型正确 | ✅ 功能等价 |
| `tests/core/types.test.ts` | T1 Step 1，3 个测试 | 3 个测试，断言一致 | ✅ 功能等价 |
| `npx vitest run` | T1 Step 4 预期 3 PASS | **3 PASS** | ✅ |

---

### 冷启动验证结论

| 评估维度 | 评分 | 说明 |
|----------|------|------|
| SPEC 清晰度 | **9/10** | T1 涉及的类型定义在 SPEC 中有完整描述，Aider 未就类型语义提问 |
| PLAN 可执行性 | **8/10** | Aider 按 PLAN 步骤顺序成功实现，唯一阻塞点为 T0 前置条件（已修复） |
| 验证发现的歧义数 | **2** | 脚手架前置条件缺失 + Aider 工具调用差异（非文档缺陷） |

**总体结论：** SPEC.md 和 PLAN.md 质量足以支撑陌生 agent 独立实现 T1。冷启动验证通过。

---

## 5. 反思

### Superpowers brainstorming 的优点

1. **"一次一个问题"防止决策疲劳。** 23 轮看似漫长，但每轮只需做一个选择，比一次性面对 20 个问题高效得多。我在 Q1–Q3 的选择速度远快于 Q15–Q22，说明早期聚焦降低了后期决策成本。

2. **"2-3 种方案对比"帮助你理解自己在选什么。** 尤其是 Q6（Python/Go/TypeScript），选项描述中的 trade-off 分析（镜像大小、生态成熟度、全栈能力）让我快速确定了"全栈统一语言"是核心需求。

3. **"逐模块签字确认"消除了设计师与实现者之间的隐性假设。** 每个设计模块都有我的明确确认，最后 SPEC.md 产出几乎零摩擦——因为每句话都对应一次确认。

4. **上下文注入后方案重新对齐的能力。** Q12 的中断→重新对齐是本次 brainstorming 最流畅的体验。智能体没有固执于原始三选方案，而是立即适应新约束。

### Superpowers brainstorming 的不足

1. **初始阶段缺少"读取项目约束文档"的步骤。** 我在 Q12 时才打开课程需求文档，导致前面 11 轮的某些决策（如 Web 前端方案）需要重新对齐。如果 brainstorming 技能启动时自动检查项目根目录的 `*_Final_Project*.md` 等约束文件，可以避免这种返工。

2. **选项框架的"过度结构化"问题。** Q4/Q23 的体验说明：当用户心里已有确定答案时，三选框架变成了"找哪个选项最接近我的想法"而非"帮我发现新方案"。brainstorming 应该识别这种信号（用户跳过选项直接输入），然后切换为"确认模式"而非继续摆选项。

3. **缺少对"外部强制约束"的感知机制。** 课程要求中"含前端必须使用 Open Design"是一个硬约束，但 brainstorming 没有在项目启动时主动扫描此类约束。这导致 Q12 的中断本质上是"用户手动注入约束"，而非智能体主动发现约束。

### 如果重做，会改变什么

1. **在 brainstorming 第一条 prompt 中就指定约束文件。** 我会写："请先读取 AI4SE_Final_Project0518.md 了解项目约束，然后按 brainstorming 流程推进。"

2. **减少选项框架，增加开放性问题。** Q4 如果直接问"你想用哪些 LLM 提供商？"而非给三选，我的回答可能是一样的，但流程更自然。选项框架适合"用户没想好"的场景，而非"用户已调研过"的场景。

3. **在 brainstorming 早期插入 SPEC_PROCESS.md 的实时写作。** 当前分支我是在 brainstorming 全部结束后才回头记录，导致细节遗忘（如 Q6 的完整对话需要从 AGENT_LOG.md 的简表中反推）。实时边聊边记录效果会更好。

4. **更早做冷启动验证。** V0 冷启动验证在 PLAN 产出后才发现 T1 缺少 T0 前置条件说明。如果在 SPEC 阶段就用 Aider 验证"拿到 SPEC.md 能不能实现 T1"，这个问题会更早暴露。
