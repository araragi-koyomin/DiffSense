# SPEC_PROCESS.md — DiffSense 规约与计划生成过程文档

> 记录与 Superpowers 协作生成 SPEC.md 和 PLAN.md 的全过程，包括 brainstorming 关键节点、冷启动验证发现、修订决策。

---

## 1. Brainstorming 关键节点

> 学生填写：Superpowers brainstorming 技能追问了哪些好问题？哪些让你修正了原来设想？

（待补充 — 请根据与 OpenCode brainstorming 对话的实际记录填写）

---

## 2. 关键迭代（至少 3 轮）

### 迭代 1：[主题]

**对话节选：**

**我的决策：**

---

### 迭代 2：[主题]

**对话节选：**

**我的决策：**

---

### 迭代 3：[主题]

**对话节选：**

**我的决策：**

---

## 3. AI 建议采纳与推翻记录

| 建议 | 来源 | 采纳/推翻 | 理由 |
|------|------|-----------|------|
| （示例）使用 better-sqlite3 而非 PostgreSQL | brainstorming | 采纳 | 单机 CLI 工具无需客户端-服务器数据库 |
| | | | |
| | | | |

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

### 冷启动验证结论

| 评估维度 | 评分 | 说明 |
|----------|------|------|
| SPEC 清晰度 | （待完成 T1 后填写） | |
| PLAN 可执行性 | （待完成 T1 后填写） | |
| 验证发现的歧义数 | 1 | 脚手架前置条件缺失 |

---

## 5. 反思

### Superpowers brainstorming 的优点

（待补充）

### Superpowers brainstorming 的不足

（待补充）

### 如果重做，会改变什么

（待补充）
