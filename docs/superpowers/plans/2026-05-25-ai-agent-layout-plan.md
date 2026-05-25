# AI Agent 三段式布局实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有单列 Tab 页面改造为左中右三段式布局（AI 聊天 | 配置 | 预览），并集成 AI Agent 对话功能。

**Architecture:** 使用 `react-resizable-panels` 实现可拖拽三列布局；左侧 ChatPanel 作为 AI 对话界面，中间保留现有上传+配置功能，右侧展示文档格式预览。ChatPanel 支持折叠/展开。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, react-resizable-panels, Lucide icons

---

### Task 1: 安装依赖 & 创建 ThreePanelLayout

**Files:**
- Modify: `package.json`
- Create: `src/components/layout/ThreePanelLayout.tsx`
- Create: `src/components/layout/PanelToggle.tsx`

- [ ] **Step 1: 安装 react-resizable-panels**

```bash
cd /g/projects/doc-format-platform && npm install react-resizable-panels
```

- [ ] **Step 2: 创建 ThreePanelLayout 组件**

`src/components/layout/ThreePanelLayout.tsx`:

```tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface ThreePanelLayoutProps {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
  leftCollapsed?: boolean;
  onLeftToggle?: () => void;
  defaultLeftSize?: number;   // 百分比
  defaultMiddleSize?: number; // 百分比
}

const STORAGE_KEY = "doc-format-panel-layout";

function loadLayout(): [number, number] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed as [number, number];
  } catch {}
  return null;
}

function saveLayout(sizes: [number, number]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
}

export default function ThreePanelLayout({
  left, middle, right,
  leftCollapsed = false,
  defaultLeftSize = 19,
  defaultMiddleSize = 31,
}: ThreePanelLayoutProps) {
  const [sizes, setSizes] = useState<[number, number] | null>(null);

  useEffect(() => {
    const saved = loadLayout();
    setSizes(saved ?? [defaultLeftSize, defaultMiddleSize]);
  }, [defaultLeftSize]);

  const handleResize = (panelSizes: number[]) => {
    if (panelSizes.length >= 2) {
      saveLayout([panelSizes[0], panelSizes[1]]);
    }
  };

  // 尚未加载（SSR）
  if (!sizes) {
    return (
      <div className="flex h-full">
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <PanelGroup direction="horizontal" onLayout={handleResize}>
      {!leftCollapsed && (
        <>
          <Panel defaultSize={sizes[0]} minSize={10} maxSize={40}>
            <div className="h-full overflow-y-auto border-r border-border/60">
              {left}
            </div>
          </Panel>
          <PanelResizeHandle className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group">
            <div className="w-0.5 h-8 rounded-full bg-border/40 group-hover:bg-primary/40 transition-colors" />
          </PanelResizeHandle>
        </>
      )}
      <Panel defaultSize={!leftCollapsed ? sizes[1] : 100 - sizes[0] + sizes[1]} minSize={25}>
        <div className="h-full overflow-y-auto border-r border-border/60">
          {middle}
        </div>
      </Panel>
      <PanelResizeHandle className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group">
        <div className="w-0.5 h-8 rounded-full bg-border/40 group-hover:bg-primary/40 transition-colors" />
      </PanelResizeHandle>
      <Panel minSize={30}>
        <div className="h-full overflow-y-auto">
          {right}
        </div>
      </Panel>
    </PanelGroup>
  );
}
```

- [ ] **Step 3: 验证编译通过**

```bash
cd /g/projects/doc-format-platform && npx next build --no-lint 2>&1 | tail -20
```

Expected: Build succeeds (可能报 ThreePanelLayout 未使用，不影响)

- [ ] **Step 4: Commit**

```bash
cd /g/projects/doc-format-platform && git add -A && git commit -m "feat: 添加 react-resizable-panels 依赖和 ThreePanelLayout 组件"
```

---

### Task 2: 创建 ChatPanel 组件

**Files:**
- Create: `src/components/chat/ChatMessage.tsx`
- Create: `src/components/chat/ChatInput.tsx`
- Create: `src/components/chat/ChatPanel.tsx`
- Create: `src/components/chat/types.ts`

- [ ] **Step 1: 定义聊天类型**

`src/components/chat/types.ts`:

```ts
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
}
```

- [ ] **Step 2: 创建 ChatMessage 组件**

`src/components/chat/ChatMessage.tsx`:

```tsx
"use client";

import { ChatMessage as ChatMessageType } from "./types";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : "bg-muted text-foreground rounded-tl-md"
        }`}>
          {message.content}
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-1">
          {new Date(message.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 ChatInput 组件**

`src/components/chat/ChatInput.tsx`:

```tsx
"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, loading, placeholder }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border/60 p-3">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "输入排版需求…"}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 min-h-[36px] max-h-[120px]"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || loading}
          className="shrink-0 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 ChatPanel 主组件**

`src/components/chat/ChatPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { MessageSquare, PanelLeftClose, PanelLeft } from "lucide-react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { ChatMessage as ChatMessageType } from "./types";

interface ChatPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function ChatPanel({ collapsed, onToggle }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是排版助手。告诉我你想怎么格式化文档，比如「排成学术论文格式」或「标题用黑体加粗」",
      timestamp: Date.now(),
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (text: string) => {
    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // 模拟 AI 回复（后续接真实 API）
    setTimeout(() => {
      const aiMsg: ChatMessageType = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: "已解析你的排版需求，配置已更新到中间面板，你可以手动微调后点击格式化。",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">AI 排版助手</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="折叠聊天面板"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {messages.length === 1 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/50 gap-2">
            <MessageSquare className="w-8 h-8" />
            <p className="text-xs">输入排版需求，AI 帮你配置格式</p>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <ChatInput onSend={handleSend} loading={loading} />
    </div>
  );
}
```

- [ ] **Step 5: 验证编译通过**

```bash
cd /g/projects/doc-format-platform && npx next build --no-lint 2>&1 | tail -20
```

Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
cd /g/projects/doc-format-platform && git add -A && git commit -m "feat: 创建 AI 聊天面板组件（ChatPanel/ChatMessage/ChatInput）"
```

---

### Task 3: 改造 page.tsx 为三段式布局

**Files:**
- Modify: `src/app/page.tsx`

这是最关键的任务。当前 page.tsx 是单列 Tab 布局（upload / settings / preview 三个 Tab），需要改造为三列：

| 左（聊天） | 中（配置）                       | 右（预览）           |
|-----------|--------------------------------|---------------------|
| ChatPanel | 上传 + 设置（保留在当前 Tab 中）   | 预览 + 下载          |

核心改动：
1. 页面容器改为 `h-screen` 全屏布局，去掉 `max-w-3xl` 限制
2. 头部区域（标题、语言切换、主题切换）收缩到顶部栏
3. 内容区域用 ThreePanelLayout 包裹
4. 左侧：ChatPanel
5. 中间：当前 Tab 内容中的 upload + settings（去掉 preview Tab）
6. 右侧：当前 preview 部分提取出来

- [ ] **Step 1: 改造 page.tsx 顶层结构**

把页面从 `py-10 px-4` 的居中布局改为 `h-screen` 全屏三列布局。主要变动在 return 部分（约 1243-1767 行）。

替换 return 部分的核心结构：

```tsx
// 页面顶部保持 state/effect 定义不变，只改 return

return (
  <div className="h-screen flex flex-col bg-background overflow-hidden">
    {/* 顶部标题栏 — 收缩为细条 */}
    <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <h1 className="text-sm font-semibold tracking-tight">{loc("app.title")}</h1>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={toggleTheme}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          {theme === "dark" ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
        </button>
        <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Globe className="w-3.5 h-3.5" />
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </div>
    </header>

    {/* 三列主要内容 */}
    <div className="flex-1 overflow-hidden">
      <ThreePanelLayout
        left={<ChatPanel collapsed={chatCollapsed} onToggle={() => setChatCollapsed(!chatCollapsed)} />}
        middle={
          <div className="h-full overflow-y-auto p-4">
            {/* 上传区域 */}
            {/* 设置区域 */}
            {/* 去掉 preview Tab */}
          </div>
        }
        right={
          <div className="h-full overflow-y-auto p-4">
            {/* 预览 + 下载 */}
          </div>
        }
        leftCollapsed={chatCollapsed}
        onLeftToggle={() => setChatCollapsed(!chatCollapsed)}
      />
    </div>

    {/* Floating CTA — 保留，但位置调整为在中间面板底部 */}
    {!loading && !resultUrl && (
      // 格式化按钮放入中间面板底部
    )}
  </div>
);
```

具体的 page.tsx 改造涉及较多 inline 内容搬运，核心逻辑是：
1. 保留所有 state/effect/handler 定义不变（1-1242 行）
2. 新增 `chatCollapsed` state
3. 添加 ChatPanel 和 ThreePanelLayout 的 import
4. 改造 return 结构

- [ ] **Step 2: 将 preview 内容移至右侧面板**

从 page.tsx 删除 `<TabsContent value="preview">` 块（1682-1734 行），改为直接在右侧面板渲染：

```
<PreviewSection elements={elements} docParagraphs={previewData} loading={previewLoading} headerConfig={headerConfig} loc={loc} />
{loading && ...}
{error && ...}
{resultUrl && ...}
```

- [ ] **Step 3: 合并 upload 和 settings 到中间面板**

去掉 Tabs 组件，将 upload 内容和 settings 内容直接在中间面板中上下排列（用 Separator 分隔）。

- [ ] **Step 4: 验证构建**

```bash
cd /g/projects/doc-format-platform && npx next build --no-lint 2>&1 | tail -30
```

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
cd /g/projects/doc-format-platform && git add -A && git commit -m "feat: 页面改造为三段式布局（聊天|配置|预览）"
```

---

### Task 4: 完善细节 — 折叠按钮 & 面板拖拽持久化

- [ ] **Step 1: 添加聊天面板展开按钮**

当面板折叠时，在中间面板顶部左侧显示一个展开按钮：

```tsx
{chatCollapsed && (
  <button
    onClick={() => setChatCollapsed(false)}
    className="absolute top-2 left-2 z-10 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    title="展开聊天面板"
  >
    <PanelLeft className="w-4 h-4" />
  </button>
)}
```

- [ ] **Step 2: 验证和微调**

```bash
cd /g/projects/doc-format-platform && npm run dev
```

手动检查：确认三列布局、拖拽手柄、折叠/展开、宽度保持均正常。

- [ ] **Step 3: Commit**

```bash
cd /g/projects/doc-format-platform && git add -A && git commit -m "feat: 添加面板折叠/展开切换功能"
```

---

### 自检清单

1. **Spec 覆盖**：
   - 三列布局 ✓（ThreePanelLayout + react-resizable-panels）
   - 可拖拽 ✓（PanelResizeHandle）
   - 可折叠 ✓（leftCollapsed + Toggle）
   - 宽度持久化 ✓（localStorage）
   - 移动端适配 — 待后续任务
   - AI 聊天 UI ✓（ChatPanel + ChatMessage + ChatInput）
   - AI 真实 API — 待后续任务

2. **占位符检查**：无 TBD/TODO 遗留

3. **类型一致性**：
   - `ChatMessage` 类型在 types.ts 定义，在 ChatMessage.tsx 和 ChatPanel.tsx 中一致使用
   - ThreePanelLayout 的 `sizes` 在 `useEffect` 中初始化，handleResize 接收 PanelGroup 的尺寸数组
