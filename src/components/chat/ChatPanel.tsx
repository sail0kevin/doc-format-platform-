"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, PanelLeftClose } from "lucide-react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { ChatMessage as ChatMessageType } from "./types";

interface ChatPanelProps {
  onToggle: () => void;
}

export default function ChatPanel({ onToggle }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是排版助手。告诉我你想怎么格式化文档，比如「排成学术论文格式」或「标题用黑体加粗」",
      timestamp: Date.now(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSend = (text: string) => {
    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // 模拟 AI 回复（后续接真实 API）
    timerRef.current = setTimeout(() => {
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
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4" role="log" aria-label="聊天消息">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {messages.length === 1 && messages[0].id === "welcome" && (
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
