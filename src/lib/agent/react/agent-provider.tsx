"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { AgentEngine } from "../engine/agent-engine";
import { AgentMessage, genId } from "../engine/types";
import { ToolContext } from "../tools/types";
import { allTools } from "../tools/index";

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

interface AgentContextValue {
  messages: AgentMessage[];
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  isLoading: boolean;
  error: string | null;
}

interface AgentProviderProps {
  children: React.ReactNode;
  /** 构建 ToolContext 的回调——每次发消息前从 React state 取最新值 */
  buildContext: () => ToolContext;
  /** 工具调用的响应函数——引擎返回 toolCalls 后，由 Provider 执行实际 state 变更 */
  onToolCall: (toolName: string, args: Record<string, any>) => void;
  /** System Prompt */
  systemPrompt?: string;
  /** 欢迎消息（支持多语言），默认中文 */
  welcomeMessage?: string;
  /** 错误提示前缀（支持多语言），默认中文 */
  errorPrefix?: string;
}

// ══════════════════════════════════════════════════════
// Context
// ══════════════════════════════════════════════════════

const AgentContext = createContext<AgentContextValue | null>(null);

// ══════════════════════════════════════════════════════
// Provider
// ══════════════════════════════════════════════════════

const DEFAULT_SYSTEM_PROMPT = "你是文档排版助手。你通过工具帮助用户排版 Word 文档。需求明确就操作，不明确就给建议。";

export function AgentProvider({ children, buildContext, onToolCall, systemPrompt, welcomeMessage, errorPrefix }: AgentProviderProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage || '你好！我是 AI 排版助手。你可以告诉我排版需求，比如「排成学术论文格式」或「标题用黑体二号」。',
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 引擎实例——整个生命周期只创建一次
  const engineRef = useRef<AgentEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AgentEngine(
      { systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT, toolNames: allTools.map((t) => t.name), maxToolCalls: 5, maxHistoryLength: 50 },
      allTools
    );
  }

  // 组件卸载时清理历史
  useEffect(() => {
    return () => { engineRef.current?.clearHistory(); };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // 添加用户消息
    const userMsg: AgentMessage = { id: genId(), role: "user", content: trimmed, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      // 从 React state 构建当前上下文
      const context = buildContext();
      // 引擎执行 ReAct 循环
      const result = await engineRef.current!.processUserInput(trimmed, context);

      // 处理工具调用——更新 React state
      for (const tc of result.toolCalls) {
        onToolCall(tc.toolName, tc.args);
      }

      // 添加 AI 回复
      const aiMsg: AgentMessage = {
        id: genId(),
        role: "assistant",
        content: result.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const prefix = errorPrefix || "抱歉，处理请求时出错";
      setError(err.message || `${prefix}。请检查 LLM 服务是否可用`);
      const errMsg: AgentMessage = {
        id: genId(),
        role: "assistant",
        content: `${prefix}：${err.message}。请检查 LLM 服务是否正常运行。`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, buildContext, onToolCall]);

  const clearMessages = useCallback(() => {
    engineRef.current?.clearHistory();
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: welcomeMessage || '你好！我是 AI 排版助手。你可以告诉我排版需求，比如「排成学术论文格式」或「标题用黑体二号」。',
        timestamp: Date.now(),
      },
    ]);
    setError(null);
  }, [welcomeMessage]);

  return (
    <AgentContext.Provider value={{ messages, sendMessage, clearMessages, isLoading, error }}>
      {children}
    </AgentContext.Provider>
  );
}

// ══════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent() 必须在 AgentProvider 内使用");
  return ctx;
}
