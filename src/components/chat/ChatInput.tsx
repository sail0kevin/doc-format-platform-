/**
 * 聊天输入框组件 — ChatInput
 * ============================
 *
 * 【作用】
 * 聊天界面底部的文本输入区域，包含一个自动增高（auto-resize）的文本框和发送按钮。
 * 支持 Enter 发送、Shift+Enter 换行、加载状态禁用等交互。
 *
 * 【原理】
 * - 文本框用 textarea 实现，通过 scrollHeight 实现自动增高
 * - 发送逻辑：点击按钮或按 Enter 键触发，先 trim（去除首尾空格），空内容不发送
 * - 加载时：文本框和按钮都 disabled，按钮显示旋转加载图标
 * - 无障碍：通过 aria-label 支持屏幕阅读器
 *
 * 【自动增高原理】
 * 1. 每次输入内容变化时，先把 height 设为 auto（重置到最小高度）
 * 2. 然后读取 scrollHeight（内容实际高度）
 * 3. 用 Math.min 限制最大 120px，超过则滚动
 * 4. 发送完成后重置 height 到 auto
 *
 * 【使用方法】
 * <ChatInput
 *   onSend={(text) => handleSend(text)}
 *   loading={false}
 *   placeholder="输入消息…"
 * />
 *
 * 【参数说明】
 * - onSend: (text: string) => void — 发送消息的回调，参数是去除首尾空格的文本
 * - loading: boolean — 是否正在等待 AI 回复，为 true 时禁用输入
 * - placeholder?: string — 输入框占位提示文字
 * - inputAriaLabel?: string — 输入框的无障碍标签
 * - sendAriaLabel?: string — 发送按钮的无障碍标签
 */

"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";

/**
 * ChatInput 组件的 Props 类型
 *
 * @property onSend        - 用户发送消息时的回调，参数是消息文本
 * @property loading       - 是否处于等待回复状态（禁用输入和发送）
 * @property placeholder   - 输入框的占位提示文字
 * @property inputAriaLabel - 输入框的 aria-label（无障碍）
 * @property sendAriaLabel  - 发送按钮的 aria-label（无障碍）
 */
interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
  placeholder?: string;
  inputAriaLabel?: string;
  sendAriaLabel?: string;
}

/**
 * ChatInput 组件
 *
 * @param props.onSend - 发送消息的回调函数
 * @param props.loading - 是否正在加载中
 * @param props.placeholder - 输入框占位文字
 * @returns JSX 元素 — 输入框 + 发送按钮
 */
export default function ChatInput({ onSend, loading, placeholder, inputAriaLabel, sendAriaLabel }: ChatInputProps) {
  // text: 输入框当前的内容
  const [text, setText] = useState("");
  // textareaRef: 引用 textarea DOM 元素，用于操作高度
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 处理发送消息
   *
   * 【流程】
   * 1. trim() 去除前后空格
   * 2. 如果为空或正在加载，不发送
   * 3. 调用 onSend 回调把文本传给父组件
   * 4. 清空输入框
   * 5. 重置 textarea 高度到初始状态
   */
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText("");
    // 发送后重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  /**
   * 键盘事件处理
   *
   * 【交互逻辑】
   * - Enter（没有按 Shift）：发送消息
   * - Shift + Enter：换行（textarea 默认行为）
   *
   * 为什么要 e.preventDefault()：阻止 Enter 的默认换行行为
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();     // 阻止换行
      handleSend();           // 发送消息
    }
    // Shift+Enter 不拦截，让 textarea 默认换行
  };

  return (
    <div className="border-t border-border/60 p-3">
      <div className="flex gap-2 items-end">
        {/* ── 文本输入框 ───────────────────────────────
             ref: 连接 DOM 引用，用于操作高度
             value + onChange: 受控组件模式，React 管理输入值
             rows={1}: 初始显示一行
             disabled={loading}: 加载时不能输入
             aria-label: 屏幕阅读器标签 */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // ── 自动增高逻辑 ──────────────────────
            // 1. 先重置 height 到 auto（缩到最小）
            // 2. 再设为 scrollHeight（内容实际高度）
            // 3. Math.min(..., 120) 限制最大 120px
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
          aria-label={inputAriaLabel || "聊天输入"}
        />
        {/* ── 发送按钮 ─────────────────────────────────
             disabled: 空内容或加载中时禁用
             加载时显示旋转的 Loader2 图标，否则显示 Send 图标 */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || loading}
          className="shrink-0 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label={sendAriaLabel || "发送"}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
