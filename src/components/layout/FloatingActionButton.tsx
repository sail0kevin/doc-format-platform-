/**
 * 可拖拽的浮动操作按钮（FAB）
 * ============================
 *
 * 【作用】
 * 在页面右下角显示一个可拖拽的黑色圆形按钮，点击后弹出快捷设置面板。
 * 面板内包含语言切换（中文/English）、主题切换等功能。
 *
 * 【原理】
 * - 使用 fixed 定位固定在屏幕右下角
 * - 通过 mouse/touch 事件实现拖拽
 * - 点击按钮切换面板展开/收起
 * - 面板内容通过 props 传入，灵活配置
 *
 * 【如何调用】
 * <FloatingActionButton
 *   lang="zh"
 *   onToggleLang={() => setLang(lang === "zh" ? "en" : "zh")}
 *   theme="light"
 *   onToggleTheme={toggleTheme}
 *   loc={loc}
 * />
 *
 * 【参数说明】
 * - lang: 当前语言 "zh" | "en"
 * - onToggleLang: 切换语言的函数
 * - theme: 当前主题 "light" | "dark"
 * - onToggleTheme: 切换主题的函数
 * - loc: 多语言翻译函数
 * - children: （可选）面板内额外的设置项
 */

"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { Globe, Sun, Moon, Settings, X } from "lucide-react";

interface FloatingActionButtonProps {
  /** 当前语言 "zh" | "en" */
  lang: string;
  /** 切换语言的回调函数 */
  onToggleLang: () => void;
  /** 当前主题 */
  theme: string;
  /** 切换主题的回调函数 */
  onToggleTheme: () => void;
  /** 多语言翻译函数 */
  loc: (key: string, params?: Record<string, string>) => string;
  /** 面板内的额外设置项（可选） */
  children?: ReactNode;
}

export default function FloatingActionButton({
  lang, onToggleLang, theme, onToggleTheme, loc, children
}: FloatingActionButtonProps) {
  // ── 状态管理 ──────────────────────────────────────────
  // open: 控制设置面板的展开/收起
  const [open, setOpen] = useState(false);

  // ── 拖拽相关 ──────────────────────────────────────────
  // 按钮的位置偏移量（相对于默认的右下角 fixed 定位）
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // 拖拽开始时记录鼠标位置和当前偏移，用于计算拖拽距离
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  // 按钮的 DOM 引用，用于事件绑定
  const btnRef = useRef<HTMLButtonElement>(null);

  /**
   * 鼠标按下时开始拖拽
   * 原理：记录起始位置，后续在 mousemove 中计算偏移
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, offsetX: offset.x, offsetY: offset.y };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  /**
   * 鼠标移动时更新按钮位置
   * 原理：用当前鼠标位置 - 起始鼠标位置 + 已有偏移 = 新偏移
   */
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.offsetX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.offsetY + (e.clientY - dragRef.current.startY),
    });
  };

  /**
   * 鼠标松开时结束拖拽
   * 原理：移除事件监听，清理拖拽状态
   */
  const handleMouseUp = () => {
    dragRef.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  // 组件卸载时清理事件监听，防止内存泄漏
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <>
      {/* ── 设置面板 ─────────────────────────────────────
           当 open 为 true 时显示，定位在按钮上方 */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-56 bg-card border border-border/60 rounded-2xl shadow-xl backdrop-blur-md p-3 space-y-1"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
          }}>
          {/* 面板标题栏：标题 + 关闭按钮 */}
          <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-1">
            <span className="text-xs font-medium text-foreground/70">{loc("settings.title")}</span>
            <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── 语言切换按钮 ──────────────────────────── */}
          <button
            onClick={onToggleLang}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-sm"
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-left">{loc("app.lang." + lang)}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              {lang === "zh" ? "EN" : "中文"}
            </span>
          </button>

          {/* ── 主题切换按钮 ──────────────────────────── */}
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-sm"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            <span className="flex-1 text-left">{loc("theme.toggle")}</span>
          </button>

          {/* ── 额外的设置项（由父组件传入） ───────────── */}
          {children}
        </div>
      )}

      {/* ── 可拖拽的圆形按钮 ─────────────────────────────
           黑色圆形，白色图标，固定在右下角
           拖拽时跟随鼠标移动 */}
      <button
        ref={btnRef}
        onMouseDown={handleMouseDown}
        onClick={() => !dragRef.current && setOpen((prev) => !prev)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-grab active:cursor-grabbing"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
        title={loc("settings.title")}
        aria-label={loc("settings.title")}
      >
        {/* 按钮内部图标：打开时显示 X，关闭时显示 ⚙ 齿轮 */}
        {open ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
      </button>
    </>
  );
}
