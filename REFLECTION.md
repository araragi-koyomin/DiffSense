# REFLECTION.md — DiffSense 项目反思报告

---

## 1. Superpowers 技能：哪些有用，哪些形式大于实质？

**发挥最大作用的技能：**

`brainstorming` 是整条链路的基石。它不是简单地让我"描述需求"，而是追问逐层剥开模糊想法——"你的用户究竟是谁？""如果 Token 超限怎么办？""Web 界面和 CLI 的数据流是什么关系？"这些问题在传统的个人开发中往往被跳过，而正是这些被跳过的边界条件，在 subagent 实现时最容易引发偏差。SPEC.md 生成后经过冷启动验证只暴露了 2 个 minor 问题，足以说明 brainstorming 的产出质量。

`subagent-driven-development` 是产能放大器。17 次 subagent 派发，5 轮并行执行，如果每个 task 我自己手写测试+实现+调试，保守估计 2 小时/task，总计约 42 小时——实际实现阶段耗时约 2 小时。这不是"AI 替我写代码"，而是"AI 替我执行了我已经设计好的、边界清晰的实现步骤"。

`test-driven-development` 的强制约束比预期有效。有几次 subagent 试图跳过一个测试直接写实现（"这种简单类型不需要测试"），TDD 技能自动拦截并强制回到红-绿-重构流程。这证明了在 AI 协作中"流程约束"比"口头提醒"有效得多。

**感觉形式大于实质的技能：**

`receiving-code-review` 在 subagent-driven 流程中被架空——评审反馈直接由主 agent 在派发 subagent 时内联处理，从未触发过独立的 receiving-code-review 流程。`verification-before-completion` 也被同样跳过，因为"commit 前跑测试"已经被 TDD 技能内置。

**结论：** Superpowers 的核心流程技能（brainstorming → plans → subagent + TDD → finishing）形成了严密的闭环，但评审相关的"防御性"技能在 subagent 模式下与流程重叠，造成了冗余。

---

## 2. TDD 强制在 AI 协作下的体感

**TDD 是放大器，不是阻碍。**

对于 subagent 而言，TDD 的"红-绿-重构"循环是天然的操作指南：有明确的验证命令（npm test -- tests/...）、明确的期望输出（FAIL/PASS）、明确的下一步（写最少代码）。这使得 subagent 在完全陌生的一次性上下文中也能自主推进——它不需要"理解"项目全局，只需满足当前测试。

对于我（人类 reviewer）而言，TDD 提供了客观的验收标准：83 个测试全部 PASS = 核心逻辑已覆盖。在没看全部源码的情况下，我可以信任"测试通过"意味着功能正确。

唯一的摩擦点出现在测试覆盖范围的选择上——PLAN.md 中的 smoke test（如"registerConfigCommand 函数可导出"）对 CLI 层的实际行为覆盖不足。这不是 TDD 的问题，而是 PLAN 中测试设计的缺陷。

---

## 3. Subagent-Driven 工作流的自主性

**Subagent 能在单 task 范围内完全自主推进，不需要干预。**

17 次 subagent 派发中，subagent 主动报告 BLOCKED 或 NEEDS_CONTEXT 的次数为 0——这说明 PLAN.md 的 task 粒度（2-5 分钟/task，精确代码块）足够消除歧义。

**最有价值的发现：并行派发效率大幅优于串行。**
- T10-T14（5 个 CLI 命令）并行派发：约 2 分钟完成
- 如果串行：约 10 分钟（5 × 2 分钟）
- 代价：需要一次手动集成（取消注释占位符 + 编译修复）

**最优 task 拆解颗粒度经验：**
- 太粗（如原始 T16）：subagent 跨多个文件，上下文膨胀，容易漏步骤
- 太细（如按函数拆分）：调度开销 > 实际收益
- **最佳粒度：一个 task = 一个功能完整的文件/模块**，如"T2 配置模块（3 个函数 + 5 个测试）"

---

## 4. SPEC 与 PLAN 质量对实现的影响

**有一个明确的反例：better-sqlite3 → sql.js 的偏离。**

PLAN.md T4/T5 的代码块是基于 better-sqlite3 API 编写的，但 Windows 环境无法编译该依赖。subagent 在遇到编译失败后，选择了功能等价但 API 不同的 sql.js。这个偏离是合理的，但它暴露了 PLAN 的一个缺陷：**PLAN 的代码块是"参考实现"，不是"唯一实现"——库版本变更、平台差异、编译环境都会导致偏离。**

如果在 SPEC 的非功能性需求中明确标注"需支持 Windows 环境"并让 PLAN 中注明"优先使用纯 JS 实现而非 native addon"，这个偏离在设计阶段就能被覆盖。

**SPEC_PROCESS.md 的冷启动验证是 SPEC 质量最重要的反馈机制。** Aider 对 T1 的试跑只暴露了 1 个 minor 问题（T0 前置条件未声明），证明 SPEC 在脱离隐性上下文后依然清晰。这种"客观证据"比任何自我感觉都更有说服力。

---

## 5. 最有效的 Prompt / Context 策略

**给 subagent 的上下文由 PLAN.md 提供，不需要额外 prompt engineering。**

这是 Superpowers 设计哲学中最成功的部分——每个 subagent 接收的是 task 的**完整代码块 + 验证命令**，而非模糊的"请实现 XX 功能"。这种"零上下文猜测"的设计使得 subagent 产出高度一致（83 tests，仅 2 个 minor 偏离）。

**给主 agent 的 prompt 策略：**
1. 每段 prompt 开头声明当前进度（✅/⬜ 状态）
2. 明确标注约束（"不要修改已完成的 T0-T8 源文件"）
3. 给出验证标准（"预期 83 PASS"）

这个策略在整轮实现中效果稳定。

---

## 6. Open Design 消除"AI 生成界面千篇一律"的效果

**设计系统的约束是有效的，但效果集中在 CSS 层面。**

Vercel Geist 的 CSS tokens 强制了 Web 层的整体视觉语言——3 个页面的颜色、间距、字体全部通过 CSS 变量引用，零硬编码色值。这种一致性是"无设计系统"状态下 AI 自由发挥所无法达到的。

但 Open Design 的价值在当前项目中只发挥了 CSS 部分——设计系统的排版、间距、组件模式等高阶约束在 PLAN.md 中缺乏具体引用。如果能将 `web-design-guidelines` 的"禁止 AI-slop 模式"（如禁止卡片套卡片、禁止 6 行文本 wrapping）编码为 subagent 的硬约束，效果会更好。

---

## 7. 如果重做，会改变什么

1. **在 SPEC 阶段明确平台约束**（"Windows 环境，优先纯 JS 依赖"），避免实现阶段因编译问题切换依赖
2. **在 PLAN 中显式标注 Open Design 的"反 AI-slop"检查项**，而非仅在 task 头部声明设计系统名称
3. **冷启动验证选用 2 个 task 而非 1 个**——T1 过于简单（类型定义），更高的复杂度（如 T4 建表 + T5 CRUD 组合）能暴露更多结构性问题
4. **SPEC_PROCESS.md 在 brainstorming 结束后立刻补写**，而非等到冷启动验证之后——时间间隔导致细节需要通过 AGENT_LOG.md 反推
5. **减少 AGENT_LOG.md 的审查条目密度**——当前 20 条记录中 7 条是人工审查记录，实际可合并为"每层一条审查"

---

## 8. 对 Superpowers 方法论的批判

**Superpowers 假设了什么？这些假设在 DiffSense 项目里成立吗？**

假设 1：**充分规约可以消除实现阶段的歧义。** 在 DiffSense 中基本成立——PLAN.md 的精确代码块使得 17 个 subagent 零 BLOCKED 报告。但 sql.js 偏离说明，当 PLAN 与运行环境不一致时，subagent 会"静默偏离"而非报告冲突。

假设 2：**每个 task 都可以由独立 subagent 完成。** 在 DiffSense 中成立——项目结构天然符合"核心引擎 → CLI → Web"的分层架构。但对于更紧密耦合的系统（如事件驱动、共享状态），独立 subagent 模式可能引入集成成本。

假设 3：**TDD 的"红-绿-重构"循环可以由 subagent 自主执行。** 在 DiffSense 中成立——83 tests 全部按此流程生成。但 subagent 不会自行判断"测试覆盖是否充分"（如 CLI smoke test 过于浅层），这仍是人类 reviewer 的责任。

Superpowers 最大的局限不是技术性的，而是**它不能帮你回答"做什么"和"做对了吗"**——这两个问题在 DiffSense 项目中分别表现为"选择 DiffSense 这个选题本身是否合理"和"sql.js 偏离是否影响 spec 合规"。

---

## 9. 对当前 AI4SE 工具与方法论的整体看法

Superpowers 代表的"规约驱动的智能体开发"范式，解决的真正问题是：**当 AI 能完成大部分编码工作时，如何保证产出的质量、一致性和可追溯性。**

这不是"让 AI 替你写代码"的工具，而是"让 AI 替你在你设计的轨道上执行"的脚手架。轨道（SPEC + PLAN）的质量直接决定终点的质量——冷启动验证、银弹项目分叉

在 DiffSense 中，我最大的感受是：**PLAN.md 写得越像"给 junior engineer 的说明书"（含完整代码块、验证命令、期望输出），subagent 的产出就越可靠。** 这与传统开发中"写详细文档是负担"的直觉相反——在 AI 协作中，详细文档是效率倍增器而非成本。

对 AI4SE 领域的整体判断：当前的工具链（Superpowers + Open Design + 多种 agent）已经能覆盖从需求到部署的完整闭环。但链路的薄弱环节依然是**规约质量**和**设计决策**——而这两点，恰好是课程要求我们重点关注的人类判断力。

---