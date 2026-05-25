"use client";

import { MessageSquare, PanelLeftClose } from "lucide-react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useAgent } from "@/lib/agent/react/agent-provider";

interface ChatPanelProps {
  onToggle: () => void;
  loc: (key: string, params?: Record<string, string>) => string;
}

export default function ChatPanel({ onToggle, loc }: ChatPanelProps) {
  const { messages, sendMessage, isLoading, error, clearMessages } = useAgent();

  const handleSend = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{loc("chat.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 1 && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs"
              title={loc("chat.clear") || "清空对话"}
              aria-label={loc("chat.clear") || "清空对话"}
            >
              清空
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={loc("chat.collapse")}
            aria-label={loc("chat.collapse")}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
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
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        loading={isLoading}
        placeholder={loc("chat.placeholder")}
        inputAriaLabel={loc("chat.input_aria")}
        sendAriaLabel={loc("chat.send_aria")}
      />
    </div>
  );
}
