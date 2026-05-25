/**
 * 三列可拖拽布局组件 — ThreePanelLayout
 * ========================================
 *
 * 【作用】
 * 将页面水平分为左中右三列，每列之间有一个拖拽手柄，用户可以拖动调整各列宽度。
 * 左侧面板可以折叠/展开。所有面板宽度会自动保存到浏览器 localStorage，刷新不丢失。
 *
 * 【原理】
 * 基于 react-resizable-panels 库实现，核心组件：
 * - PanelGroup：面板容器，定义排列方向（horizontal = 水平）
 * - Panel：单个面板，带 defaultSize/minSize/maxSize 控制宽度范围
 * - PanelResizeHandle：面板之间的拖拽手柄
 * - localStorage 存取面板尺寸，实现持久化
 *
 * 【使用方法】
 * <ThreePanelLayout
 *   left={<ChatPanel />}           // 左侧面板内容
 *   middle={<ConfigPanel />}       // 中间面板内容
 *   right={<PreviewPanel />}       // 右侧面板内容
 *   leftCollapsed={false}          // 左侧是否折叠
 *   defaultLeftSize={19}           // 左侧默认宽度百分比
 *   defaultMiddleSize={31}         // 中间默认宽度百分比
 * />
 *
 * 【参数说明】
 * - left: ReactNode        — 左侧面板渲染的内容
 * - middle: ReactNode      — 中间面板渲染的内容
 * - right: ReactNode       — 右侧面板渲染的内容
 * - leftCollapsed?: boolean — 是否折叠左侧面板（默认 false）
 * - defaultLeftSize?: number  — 左侧面板默认宽度百分比（默认 19）
 * - defaultMiddleSize?: number — 中间面板默认宽度百分比（默认 31），右侧自动占剩余
 *
 * 【存储原理】
 * localStorage 的 key 是 "doc-format-panel-layout"，保存格式为 [左%, 中%, 右%] 的数组。
 * 只会在三个面板都可见时保存（折叠时不保存），避免折叠时错误覆盖尺寸数据。
 *
 * 【SSR 兼容】
 * 首次渲染时 sizes 为 null，显示空白占位，避免服务端和客户端 HTML 不匹配。
 * useEffect 在浏览器端加载 localStorage 数据后，才真正渲染面板。
 */

"use client";

import { ReactNode, useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

/**
 * ThreePanelLayout 的 Props 类型定义
 *
 * @property left   - 左侧面板的 React 内容
 * @property middle - 中间面板的 React 内容
 * @property right  - 右侧面板的 React 内容
 * @property leftCollapsed  - 是否隐藏左侧面板
 * @property defaultLeftSize   - 左侧面板初始宽度（百分比，默认 19）
 * @property defaultMiddleSize - 中间面板初始宽度（百分比，默认 31）
 */
interface ThreePanelLayoutProps {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
  leftCollapsed?: boolean;
  defaultLeftSize?: number;
  defaultMiddleSize?: number;
}

/**
 * localStorage 存储用的 key
 * 为什么要常量：避免拼写错误，改一次全改
 */
const STORAGE_KEY = "doc-format-panel-layout";

/**
 * 从 localStorage 加载保存的面板尺寸
 *
 * 【原理】
 * - 先检查 window 是否存在（SSR 保护）
 * - 从 localStorage 读取 JSON 字符串
 * - 解析为 [number, number, number] 格式的数组
 * - 如果格式不对或解析失败，返回 null 让调用者使用默认值
 *
 * @returns [左%, 中%, 右%] 的元组，或 null（无保存数据）
 */
function loadLayout(): [number, number, number] | null {
  // SSR 保护：服务端渲染时没有 window 对象，直接返回 null
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // 验证数据格式：必须是数组且长度为 3
    if (Array.isArray(parsed) && parsed.length === 3) return parsed as [number, number, number];
  } catch (e) {
    // localStorage 数据可能被手动改坏，静默降级 + 打印警告
    console.warn("保存的面板布局数据解析失败，将使用默认值:", e);
  }
  return null;
}

/**
 * 保存面板尺寸到 localStorage
 *
 * @param sizes - [左%, 中%, 右%] 的三元素数组
 */
function saveLayout(sizes: [number, number, number]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
}

/**
 * ThreePanelLayout 主组件
 *
 * 【渲染逻辑】
 * 1. 首次渲染时 sizes 为 null → 显示空白占位（SSR 安全）
 * 2. useEffect 加载 localStorage 数据 → 更新 sizes
 * 3. 根据 leftCollapsed 决定是否渲染左侧面板
 * 4. 用户拖拽手柄 → onLayout 回调 → 只在三面板时保存
 *
 * 【为什么用 useState(null) 而不是直接读 localStorage】
 * 因为 Next.js 是服务端渲染，localStorage 只在浏览器存在。
 * 如果在 render 中直接读 localStorage，服务端和客户端渲染结果不同，会报 hydration 错误。
 * 正确做法：首次渲染用 null，useEffect 在浏览器端加载数据。
 */
export default function ThreePanelLayout({
  left, middle, right,
  leftCollapsed = false,   // 默认左侧展开（不折叠）
  defaultLeftSize = 19,    // 默认左侧 19%
  defaultMiddleSize = 31,  // 默认中间 31%（右侧 = 100-19-31 = 50%）
}: ThreePanelLayoutProps) {
  // ── 状态管理 ──────────────────────────────────────────
  // sizes 存储三个面板的百分比宽度，null 表示尚未从 localStorage 加载
  const [sizes, setSizes] = useState<[number, number, number] | null>(null);

  // ── 加载保存的尺寸 ────────────────────────────────────
  // useEffect 保证只在浏览器端执行
  useEffect(() => {
    const saved = loadLayout();
    // 如果 localStorage 有数据就用保存的，没有就用默认值
    // 右侧宽度 = 100 - 左 - 中（自动占满剩余空间）
    setSizes(saved ?? [defaultLeftSize, defaultMiddleSize, 100 - defaultLeftSize - defaultMiddleSize]);
  }, [defaultLeftSize, defaultMiddleSize]);

  /**
   * 面板拖拽后的回调函数
   *
   * 【为什么只保存三面板状态】
   * 当左侧折叠时，PanelGroup 里只有 2 个面板（中间+右侧），
   * panelSizes 也只返回 2 个值。如果这时保存，会覆盖正确的三面板数据。
   * 所以只用 panelSizes.length === 3 来判断当前是三面板状态。
   *
   * @param panelSizes - 当前所有可见面板的百分比数组
   */
  const handleResize = (panelSizes: number[]) => {
    if (panelSizes.length === 3) {
      saveLayout([panelSizes[0], panelSizes[1], panelSizes[2]]);
    }
  };

  // ── SSR 占位：数据尚未加载，显示空白内容 ─────────────
  // 此时不渲染面板，避免 hydration 不匹配
  if (!sizes) {
    return (
      <div className="flex h-full">
        <div className="flex-1" />
      </div>
    );
  }

  // ── 渲染三列可拖拽面板 ──────────────────────────────
  return (
    <PanelGroup direction="horizontal" onLayout={handleResize}>
      {/* ── 左侧面板（折叠时隐藏） ───────────────────────
           key="left" 保证 React 能正确识别和复用这个面板
           minSize=10 最小不能小于 10%
           maxSize=40 最大不能大于 40% */}
      {!leftCollapsed && (
        <>
          <Panel key="left" defaultSize={sizes[0]} minSize={10} maxSize={40}>
            <div className="h-full overflow-y-auto border-r border-border/60">
              {left}
            </div>
          </Panel>
          {/* ── 左侧拖拽手柄 ────────────────────────────
               cursor-col-resize: 鼠标悬停时显示左右箭头光标
               hover:bg-primary/20: 悬停时显示浅色高亮
               group: 配合子元素 hover 效果 */}
          <PanelResizeHandle className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group">
            <div className="w-0.5 h-8 rounded-full bg-border/40 group-hover:bg-primary/40 transition-colors" />
          </PanelResizeHandle>
        </>
      )}
      {/* ── 中间面板 ────────────────────────────────────
           折叠时 defaultSize=70，右侧=30，让中间占大部分空间
           未折叠时使用 localStorage 保存的尺寸 */}
      <Panel key="middle" defaultSize={!leftCollapsed ? sizes[1] : 70} minSize={25}>
        <div className="h-full overflow-y-auto border-r border-border/60">
          {middle}
        </div>
      </Panel>
      {/* ── 中间拖拽手柄 ──────────────────────────────── */}
      <PanelResizeHandle className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group">
        <div className="w-0.5 h-8 rounded-full bg-border/40 group-hover:bg-primary/40 transition-colors" />
      </PanelResizeHandle>
      {/* ── 右侧面板 ────────────────────────────────────
           minSize=30 确保预览区域始终有足够空间 */}
      <Panel key="right" defaultSize={!leftCollapsed ? sizes[2] : 30} minSize={30}>
        <div className="h-full overflow-y-auto">
          {right}
        </div>
      </Panel>
    </PanelGroup>
  );
}
