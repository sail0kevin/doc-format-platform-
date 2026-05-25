"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, PanelLeftClose } from "lucide-react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { ChatMessage as ChatMessageType } from "./types";

interface ChatPanelProps {
  onToggle: () => void;
  loc: (key: string, params?: Record<string, string>) => string;
}

export default function ChatPanel({ onToggle, loc }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content: loc("chat.welcome"),
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
        content: loc("chat.ai_response"),
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

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4" role="log" aria-label={loc("chat.message_aria")}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {messages.length === 1 && messages[0].id === "welcome" && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/50 gap-2">
            <MessageSquare className="w-8 h-8" />
            <p className="text-xs">{loc("chat.empty_hint")}</p>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <ChatInput onSend={handleSend} loading={loading} placeholder={loc("chat.placeholder")} inputAriaLabel={loc("chat.input_aria")} sendAriaLabel={loc("chat.send_aria")} />
    </div>
  );
}
