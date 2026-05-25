/**
 * AI 聊天面板组件 — ChatPanel
 * ==============================
 *
 * 【作用】
 * 三段式布局中最左侧的 AI 聊天界面。用户输入排版需求，AI 理解后自动配置格式面板。
 * 包含：标题栏（带折叠按钮）、消息列表（带欢迎语和空状态提示）、输入区域。
 *
 * 【原理】
 * - 使用 useState 管理消息列表和加载状态
 * - 消息列表用数组存储 ChatMessage 对象，新消息 push 到末尾
 * - 用 useRef 存储 setTimeout 的 ID，组件卸载时清理（防止内存泄漏）
 * - 当前为模拟 AI 回复（setTimeout 1秒后返回固定消息），后续接入真实 API
 * - 多语言支持：所有文字通过 loc() 函数获取翻译
 *
 * 【消息渲染流程】
 * 1. 初始状态：只有一条 welcome 消息，显示空状态提示
 * 2. 用户发送消息：push 到 messages，设置 loading=true
 * 3. AI 回复（模拟）：1秒后 push AI 消息，设置 loading=false
 * 4. 用户切换语言：通过 loc() 重新获取翻译文案
 *
 * 【使用方法】
 * <ChatPanel
 *   onToggle={() => setChatCollapsed(prev => !prev)}
 *   loc={loc}
 * />
 *
 * 【参数说明】
 * - onToggle: () => void — 点击折叠按钮时触发，通知父组件切换折叠状态
 * - loc: (key: string) => string — 多语言翻译函数
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, PanelLeftClose } from "lucide-react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { ChatMessage as ChatMessageType } from "./types";

/**
 * ChatPanel 组件的 Props 类型
 *
 * @property onToggle - 折叠按钮点击回调，用于通知父组件切换面板折叠状态
 * @property loc      - 多语言翻译函数，传入 key 返回当前语言的文字
 */
interface ChatPanelProps {
  onToggle: () => void;
  loc: (key: string, params?: Record<string, string>) => string;
}

/**
 * ChatPanel 组件
 *
 * @param props.onToggle - 折叠/展开切换回调
 * @param props.loc      - 翻译函数
 * @returns JSX 元素 — 完整的聊天面板
 *
 * 【组件结构】
 * ┌─────────────────────┐
 * │ AI 排版助手    [×]  │ ← 标题栏 + 折叠按钮
 * ├─────────────────────┤
 * │ 🤖 你好！我是...   │ ← 消息列表（可滚动）
 * │       用户消息 → 🙋 │
 * │ 🤖 已解析你的...   │
 * ├─────────────────────┤
 * │ [输入排版需求...] 📤│ ← 输入区域
 * └─────────────────────┘
 */
export default function ChatPanel({ onToggle, loc }: ChatPanelProps) {
  // ── 消息列表 ──────────────────────────────────────────
  // 初始包含一条 AI 欢迎消息
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content: loc("chat.welcome"),      // 用 loc() 获取翻译后的欢迎语
      timestamp: Date.now(),
    },
  ]);
  // loading：true 表示正在等 AI 回复
  const [loading, setLoading] = useState(false);

  // ── 定时器引用 ────────────────────────────────────────
  // useRef 存储 setTimeout 返回的 ID，用于组件卸载时清理
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 组件卸载时清理定时器
   *
   * 【为什么要清理】
   * 如果 ChatPanel 被折叠（卸载）时 AI 回复还没到，
   * setTimeout 的回调会尝试在已卸载的组件上 setState，
   * 导致 React 警告："Can't perform a React state update on an unmounted component"
   * clearTimeout 可以防止这种情况。
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * 处理用户发送消息
   *
   * 【流程】
   * 1. 创建用户消息对象，push 到消息列表
   * 2. 设置 loading=true（禁用输入框，按钮显示加载动画）
   * 3. 启动 setTimeout 模拟 AI 回复（1秒后执行）
   * 4. AI 回复：创建 AI 消息对象，push 到列表，loading=false
   *
   * @param text - 用户输入的消息文本（已去除首尾空格）
   */
  const handleSend = (text: string) => {
    // ── 添加用户消息 ────────────────────────────────
    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,        // 用时间戳保证唯一
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    // 展开语法 [...] 把新消息追加到数组末尾
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // ── 模拟 AI 回复 ────────────────────────────────
    // 后续接入真实 API 时，这里改为 fetch/axios 调用
    timerRef.current = setTimeout(() => {
      const aiMsg: ChatMessageType = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: loc("chat.ai_response"),  // 用 loc() 获取翻译
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setLoading(false);
    }, 1000);  // 1秒后回复，模拟 AI 思考时间
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* ── 标题栏 ──────────────────────────────────────
           shrink-0: 不会被 flex 压缩，保持固定高度
           左侧：图标 + 标题文字
           右侧：折叠按钮（点击后通知父组件隐藏左侧面板） */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{loc("chat.title")}</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={loc("chat.collapse")}
          aria-label={loc("chat.collapse")}
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* ── 消息列表 ────────────────────────────────────
           flex-1: 占满剩余高度
           overflow-y-auto: 消息过多时滚动
           role="log": 无障碍标记为实时日志区域
           每条消息用 ChatMessage 组件渲染
           只有欢迎消息时显示空状态提示 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4" role="log" aria-label={loc("chat.message_aria")}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {/* 空状态提示：只有 "welcome" 一条消息时显示
             用 messages[0].id === "welcome" 判断，避免翻译文字变化时误判 */}
        {messages.length === 1 && messages[0].id === "welcome" && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/50 gap-2">
            <MessageSquare className="w-8 h-8" />
            <p className="text-xs">{loc("chat.empty_hint")}</p>
          </div>
        )}
      </div>

      {/* ── 输入区域 ────────────────────────────────────
           传入 ChatInput 组件，处理用户输入和发送 */}
      <ChatInput
        onSend={handleSend}
        loading={loading}
        placeholder={loc("chat.placeholder")}
        inputAriaLabel={loc("chat.input_aria")}
        sendAriaLabel={loc("chat.send_aria")}
      />
    </div>
  );
}
