/**
 * 聊天消息类型定义
 * ===================
 *
 * 【作用】
 * 定义 AI 聊天功能中使用的数据结构和类型。
 * 这些接口规定了消息数据的格式，让 TypeScript 能检查代码中消息的使用是否正确。
 *
 * 【原理】
 * TypeScript 的 interface（接口）是一种类型约束，告诉编译器数据应该长什么样。
 * 如果一个对象不符合这个形状，TypeScript 会在编译时报错。
 *
 * 【使用方法】
 * import type { ChatMessage } from "./types";
 *
 * const msg: ChatMessage = {
 *   id: "msg-1",
 *   role: "user",
 *   content: "你好",
 *   timestamp: Date.now(),
 * };
 */

/**
 * ChatMessage — 单条聊天消息的数据结构
 *
 * @property id        - 消息唯一标识，用于 React 列表渲染的 key 和去重
 * @property role      - 消息角色："user" = 用户发的，"assistant" = AI 回复的
 * @property content   - 消息文本内容
 * @property timestamp - 发送时间戳（毫秒），用于显示时间和排序
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
