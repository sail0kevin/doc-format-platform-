/**
 * 单条聊天消息气泡组件 — ChatMessage
 * =====================================
 *
 * 【作用】
 * 渲染聊天界面中的一条消息，显示头像图标、消息文本、发送时间。
 * 用户消息和 AI 消息的样式不同（位置左右相反、颜色不同）。
 *
 * 【原理】
 * - 根据 message.role 判断是用户还是 AI，切换不同的样式
 * - 用户消息：右侧显示（flex-row-reverse），蓝色背景（bg-primary）
 * - AI 消息：左侧显示（默认），灰色背景（bg-muted）
 * - 使用 flexbox 配合 flex-row-reverse 实现左右布局切换
 * - 头像使用 lucide-react 的 Bot（机器人）和 User（用户）图标
 *
 * 【使用方法】
 * <ChatMessage message={{
 *   id: "msg-1",
 *   role: "user",
 *   content: "帮我排成学术论文格式",
 *   timestamp: Date.now(),
 * }} />
 *
 * 【参数说明】
 * - message: ChatMessage 类型 — 要显示的消息数据
 *   - id: string — 唯一标识
 *   - role: "user" | "assistant" — 消息角色
 *   - content: string — 文本内容
 *   - timestamp: number — 毫秒时间戳
 *
 * 【样式说明】
 * - 头像：圆形（rounded-full），32px，用户蓝色/AI 灰色
 * - 气泡：圆角（rounded-2xl），用户右上角直角/AI 左上角直角
 * - 时间：10px 灰色小字，显示时:分
 * - 最大宽度 85%，防止超长文本撑满屏幕
 */

"use client";

import { ChatMessage as ChatMessageType } from "./types";
import { Bot, User } from "lucide-react";

/**
 * ChatMessage 组件的 Props
 * @property message - 要显示的消息数据
 */
interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * ChatMessage 组件
 *
 * @param props.message - 消息数据对象
 * @returns JSX 元素 — 一条消息气泡
 *
 * 【渲染逻辑】
 * 1. 判断 role 决定布局方向（用户靠右/AI 靠左）
 * 2. 根据 role 选择头像图标和颜色
 * 3. 消息文本放在气泡内，带不同的圆角样式
 * 4. 底部显示发送时间
 */
export default function ChatMessage({ message }: ChatMessageProps) {
  // isUser 为 true 表示这是用户发的消息，样式靠右
  // 为 false 表示 AI 回复，样式靠左
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* ── 头像图标 ────────────────────────
           用户：蓝色背景 + 用户图标
           AI：灰色背景 + 机器人图标 */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      {/* ── 消息内容区域 ────────────────────
           max-w-[85%] 限制气泡最大宽度
           用户消息 text-right 让气泡靠右对齐 */}
      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {/* 消息气泡本体
             rounded-tr-md / rounded-tl-md：让气泡指向头像的方向是直角（对话感） */}
        <div className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : "bg-muted text-foreground rounded-tl-md"
        }`}>
          {message.content}
        </div>
        {/* 发送时间：10px 灰色文字，格式如 "14:30" */}
        <p className="text-[10px] text-muted-foreground/50 mt-1">
          {new Date(message.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
