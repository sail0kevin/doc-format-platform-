# AI Agent 标准框架设计

> **目标：** 为 doc-format-platform 构建一个标准化的 AI Agent 框架，用户通过聊天面板与 Agent 交互，
> Agent 能理解排版需求并操作页面配置。框架本身是通用的，理解后可在其他项目复用。
>
> **核心思想：** 四层架构，每层只管一件事，层与层之间通过接口通信，换掉任何一层不影响其他层。

---

## 1. 整体架构

```
┌──────────────────────────────────────────────────────┐
│  Layer 4: React 集成层                                │
│  @/lib/agent/react/                                   │
│  AgentProvider + useAgent() hook                      │
│  作用：把 Agent 引擎暴露给 React 组件                   │
├──────────────────────────────────────────────────────┤
│  Layer 3: Agent 引擎                                  │
│  @/lib/agent/engine/                                  │
│  ReAct 循环 + 对话管理 + 上下文窗口控制                │
│  作用：决定"什么时候回复，什么时候调工具"               │
├──────────────────────────────────────────────────────┤
│  Layer 2: LLM 通信层                                  │
│  @/lib/agent/llm/  +  src/app/api/agent/              │
│  模型调用 + 流式解析(预留) + 错误重试 + 多模型切换      │
│  作用：跟 AI 模型对话，屏蔽不同模型的差异               │
├──────────────────────────────────────────────────────┤
│  Layer 1: 工具系统 (Tools)                             │
│  @/lib/agent/tools/                                   │
│  apply_preset / add_element / update_config / undo...  │
│  作用：Agent 能执行的"动作"，每个工具一个文件            │
└──────────────────────────────────────────────────────┘
```

### 为什么这样分层

- **Layer 1 换工具集**：换项目时改 tools/ 目录就行，上层框架不动
- **Layer 2 换模型**：从 OpenAI 换 Ollama，只改 api/agent/route.ts 的调用代码
- **Layer 3 换交互模式**：从 ReAct 换成 Plan-then-execute，不影响上下层
- **Layer 4 换 UI 框架**：从 React 换成 Vue，只重写这层，下面三层是纯 TypeScript

### 核心数据流

```
用户输入 → Layer 4(React) 调 sendMessage()
         → Layer 3(引擎) 组装上下文 → 启动 ReAct 循环
           → Layer 2(LLM) 调 /api/agent
           → (服务端转发给 LLM 模型)
           → LLM 返回 → 解析 → 有工具调用？
             ├── 否 → 直接回复 → 返回给 Layer 4 渲染
             └── 是 → Layer 1(工具) execute → 结果回 Layer 3
                      → 继续调 LLM → 循环直到 LLM 直接回复
```

---

## 2. Layer 1: 工具系统

### 2.1 基础接口

```typescript
// @/lib/agent/tools/types.ts

interface ToolParameter {
  name: string;
  description: string;
  required: boolean;
  type: "string" | "number" | "boolean";
}

interface Tool {
  name: string;
  description: string;       // LLM 靠这个理解工具用途
  parameters: ToolParameter[];
  execute(args: Record<string, any>, context: ToolContext): Promise<string>;
}

interface ToolContext {
  elements: ElementDef[];
  pageMargins: Record<string, string>;
  headerConfig: HeaderConfig;
  preset: string;
  canUndo: boolean;
  canRedo: boolean;
}
```

### 2.2 工具列表

| 工具名 | 描述 | 参数 | 对应页面操作 |
|--------|------|------|------------|
| `apply_preset` | 应用内置排版预设 | presetName (必填) | 选择预设卡片 |
| `add_element` | 添加新的文档元素（标题/正文） | type, label, wordStyles (可选) | 点"添加标题"按钮 |
| `remove_element` | 删除指定文档元素 | elementId (必填) | 点 X 删除 |
| `update_config` | 修改某个元素的配置 | elementId, configKey, configValue | 修改配置面板 |
| `set_margins` | 调整页面边距 | top, bottom, left, right | 修改边距输入框 |
| `undo` | 撤销上一步操作 | 无 | Ctrl+Z |
| `redo` | 重做被撤销的操作 | 无 | Ctrl+Shift+Z |
| `suggest_format` | 给出排版建议（纯文本） | 无 | 返回建议文字 |

### 2.3 工具注册方式

```typescript
// @/lib/agent/tools/index.ts — 所有工具的注册中心

import { Tool } from "./types";
import { applyPreset } from "./apply-preset";
import { addElement } from "./add-element";
// ...

// 所有工具放在一个数组里，传给 AgentConfig
export const allTools: Tool[] = [
  applyPreset,
  addElement,
  removeElement,
  updateConfig,
  setMargins,
  undo,
  redo,
  suggestFormat,
];
```

**加一个新工具只需三步：**
1. 在 `@/lib/agent/tools/` 下建新文件
2. 实现 Tool 接口（name + description + parameters + execute）
3. 在 `index.ts` 里 import + 注册

### 2.4 工具与 React 状态的联动

工具不直接操作 DOM 或 React state。工具只返回"结果文本"，由上层（Layer 4）处理实际的 state 变更。

```
工具 execute("apply_preset", { presetName: "essay" })
  → 返回字符串 "已选择学术论文预设，等待应用"
  → Layer 4 收到后调 setPreset("essay")、setElements(...)
```

这种"工具只返回意图，不直接改状态"的设计，保证了：
- 工具是可测试的（纯函数）
- UI 状态变更统一在 React 层管理
- Agent 操作可以跟用户手动操作走同一套 setter

---

## 3. Layer 2: LLM 通信层

### 3.1 消息格式

使用业界标准格式（兼容 OpenAI / Claude / Ollama）：

```typescript
// @/lib/agent/llm/types.ts

interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface LLMResponse {
  content: string;
  toolCalls?: { id: string; toolName: string; args: Record<string, any> }[];
  usage?: { promptTokens: number; completionTokens: number };
}
```

### 3.2 API 路由

```typescript
// src/app/api/agent/route.ts

// POST /api/agent
// Body: { messages: LLMMessage[], tools: ToolDef[] }
// Response: { content: string, toolCalls?: ToolCall[] }

// 支持模型切换（通过环境变量）
// LLM_PROVIDER=openai    → 调 OpenAI API
// LLM_PROVIDER=ollama    → 调本地 Ollama
// LLM_PROVIDER=claude    → 调 Claude API（预留）
```

### 3.3 错误处理策略

| 错误类型 | 前端表现 | 后端处理 |
|---------|---------|---------|
| 网络错误 | 显示"网络异常，请检查连接" | 自动重试 2 次 |
| API key 无效 | 显示"服务配置异常" | 返回 401 |
| LLM 超时 | 显示"回复超时，请重试" | 15s 超时截断 |
| Token 超限 | 自动截断历史后重试 | 返回 over_limit 标识 |

### 3.4 流式输出（预留）

当前版本不做流式，框架预留接口。后续如需流式：
- 只改 Layer 2（API 路由返回 SSE）
- 只改 Layer 4（前端解析 SSE 流）
- Layer 1、Layer 3 不动

---

## 4. Layer 3: Agent 引擎

### 4.1 核心逻辑：ReAct 循环

```
用户输入
    ↓
1. 引擎组装完整 Prompt：
   System Prompt + 页面状态 + 历史对话 + 用户输入
    ↓
2. 调 LLM（传入工具定义）
    ↓
3. LLM 返回 → 判断是否有 tool_call？
   ├── 无 → 直接回复，结束
   └── 有 → 遍历每个 tool_call
             ↓
        4. 查找对应的 Tool 定义
            ↓
        5. 调 Tool.execute(args, context)
            ↓
        6. 把 tool_call + tool_result 追加到对话历史
            ↓
        7. 回到步骤 2（循环）
```

### 4.2 状态定义

```typescript
// @/lib/agent/engine/types.ts

interface AgentConfig {
  systemPrompt: string;
  tools: Tool[];
  maxToolCalls: number;       // 每轮最多 5 次，防死循环
  maxHistoryLength: number;   // 最多保留多少条历史
}

interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: {
    type?: "tool_call" | "tool_result";
    toolName?: string;
  };
}
```

### 4.3 System Prompt 设计

System Prompt 分为三部分，引擎自动组装：

```
1. 角色定义：
   "你是文档排版助手。你可以调用工具来帮助用户排版文档。
    用户没有明确要求时，主动给出专业建议。"

2. 页面状态（每次动态生成）：
   "当前预设：essay（学术论文）
    文档元素：大标题(H1) / 副标题(H2) / 小标题(H3) / 正文
    页面边距：上2.5cm 下2.5cm 左3.0cm 右3.0cm"

3. 工具说明（自动从 Tool 定义生成）：
   "可用的工具：
    - apply_preset: 应用排版预设，参数：presetName(必填)
    - add_element: 添加文档元素，参数：type(必填), label(必填)
    - ..."
```

### 4.4 安全机制

| 机制 | 配置 | 说明 |
|------|------|------|
| 最大工具调用次数 | maxToolCalls: 5 | 防止无限循环 |
| 历史长度限制 | maxHistoryLength: 50 | 控制 token 消耗 |
| 工具异常隔离 | try/catch 包裹每个 execute | 一个工具报错不影响其他工具 |
| 上下文窗口管理 | 超长时自动丢弃最早的历史 | 确保 LLM 不超上下文限制 |

---

## 5. Layer 4: React 集成层

### 5.1 核心 API

```typescript
// @/lib/agent/react/types.ts

interface AgentContextValue {
  // 发消息
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;

  // 对话状态
  messages: AgentMessage[];
  isLoading: boolean;
  error: string | null;

  // 工具操作（提供给 Agent 和页面组件）
  applyPreset: (name: string) => void;
  addElement: (type: "heading" | "body", label: string, wordStyles?: string) => void;
  removeElement: (id: string) => void;
  updateConfig: (elementId: string, key: string, value: any) => void;
  setMargins: (margins: Record<string, string>) => void;
  undo: () => void;
  redo: () => void;
}
```

### 5.2 组件层级

```tsx
// 在 page.tsx 中
<AgentProvider>
  <ThreePanelLayout
    left={<ChatPanel />}      // 用 useAgent() 收发消息
    middle={<ConfigPanel />}   // 用 useAgent() 提供的操作函数
    right={<PreviewPanel />}
  />
</AgentProvider>
```

### 5.3 ChatPanel 改动

升级前后对比：

| 方面 | 当前 ChatPanel | 升级后 |
|------|---------------|--------|
| 消息管理 | 内部 useState | useAgent().messages |
| 发送消息 | setTimeout 模拟 | useAgent().sendMessage |
| 加载状态 | 内部 useState | useAgent().isLoading |
| 错误处理 | 无 | useAgent().error |
| 工具反馈 | 无 | Agent 自动显示工具调用结果 |

### 5.4 双向绑定

```
Agent 操作页面：
  LLM 决定调工具 → Tool.execute() → Layer 4 收到 → React setState

用户手动操作：
  用户改配置 → React setState → 引擎下次对话时自动获取最新状态
```

---

## 6. 目录结构

```
src/
├── lib/
│   └── agent/
│       ├── tools/
│       │   ├── types.ts            # Tool 接口定义
│       │   ├── index.ts            # 工具注册
│       │   ├── apply-preset.ts     # 切换预设
│       │   ├── add-element.ts      # 添加元素
│       │   ├── remove-element.ts   # 删除元素
│       │   ├── update-config.ts    # 修改配置
│       │   ├── set-margins.ts      # 设置边距
│       │   ├── undo-redo.ts        # 撤销/重做
│       │   └── suggest-format.ts   # 排版建议
│       ├── llm/
│       │   ├── types.ts            # LLM 消息格式
│       │   └── client.ts           # LLM 调用封装（纯函数）
│       ├── engine/
│       │   ├── types.ts            # 引擎类型定义
│       │   ├── agent-engine.ts     # ReAct 循环核心
│       │   └── system-prompt.ts    # System Prompt 组装
│       └── react/
│           ├── types.ts            # React 层类型
│           ├── agent-context.tsx    # Context 定义
│           └── agent-provider.tsx   # Provider + hook
├── app/
│   └── api/
│       └── agent/
│           └── route.ts            # API 路由（服务端转发）
└── components/
    └── chat/
        ├── ChatPanel.tsx           # 改为用 useAgent()（主要改动）
        ├── ChatMessage.tsx         # 不变或微调
        └── ChatInput.tsx           # 不变
```

**共约 15 个文件，除 ChatPanel.tsx 有改动外，其他组件基本不变。**

---

## 7. 技术要点

- **不引入新的 npm 包**——纯 TypeScript 实现，无额外依赖
- **API 密钥安全**——通过环境变量配置，存储于服务端
- **测试友好**——Layer 1 工具是纯函数，Layer 3 引擎可 mock LLM 调用
- **渐进式升级**——先在当前项目中实现，后续可以提取为独立 npm 包
- **后续扩展**：
  - 加流式输出 → 改 Layer 2 + Layer 4
  - 换模型 → 改 Layer 2
  - 加新工具 → 改 Layer 1（加文件 + 注册）
  - 换 UI 框架 → 重写 Layer 4
