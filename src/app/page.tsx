"use client";

/**
 * 文档格式化平台 — 主页面
 *
 * 功能：
 *   1. 文件上传/拖拽 + 文字输入 双模式
 *   2. 中文字号体系（二号/三号/小四…）
 *   3. 间距单位可选（pt/cm/mm/字符）
 *   4. 动态文档元素管理（增删/拖拽/复制/批量编辑）
 *   5. 内置预设 + 自定义模板（保存/重命名/删除）
 *   6. 实际文档段落预览（上传后显示原文+格式效果）
 *   7. localStorage 自动保存/恢复
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Upload, Download, FileText, Loader2,
  ChevronDown, ChevronRight, X, Plus, Check,
  GripVertical, Copy, Save, Pencil, Trash2, Type, FileUp, Eye,
  Undo2, Redo2, Globe, PanelLeft
} from "lucide-react";
import ThreePanelLayout from "@/components/layout/ThreePanelLayout";
import ChatPanel from "@/components/chat/ChatPanel";
import { useLocale } from "@/lib/lang";
import { AgentProvider } from "@/lib/agent/react/agent-provider";
import { ToolContext } from "@/lib/agent/tools/types";

// ── 类型 ──────────────────────────────────────────────────

interface FormatConfig {
  font: string;
  size: string;          // pt，如 "22", "10.5"
  bold: boolean;
  align: "left" | "center" | "right" | "justify";
  space_before: string;  // pt
  space_after: string;   // pt
  color: string;
  line_spacing: string;  // 倍数
  first_line_indent?: string;  // cm
}

interface ElementDef {
  id: string;
  label: string;
  type: "heading" | "body";
  wordStyles: string[];
  config: FormatConfig;
}

interface UserPreset {
  id: string;
  label: string;
  elements: ElementDef[];
  page: { margin_top: string; margin_bottom: string; margin_left: string; margin_right: string };
  header?: HeaderConfig;
}

/** 页眉/页码 配置 */
interface HeaderConfig {
  showHeader: boolean;
  text: string;
  useChapterHeader: boolean;
  showPageNumber: boolean;
  pageNumberAlign: "left" | "center" | "right";
}

/** 文档预览 — 单个段落信息 */
interface ParagraphInfo {
  index: number;
  text: string;
  style: string;
  element: string;
}

// ── 常量 ──────────────────────────────────────────────────

const STORAGE_KEY = "doc-format-platform-state";
const PRESETS_KEY = "doc-format-user-presets";

const FONTS = ["宋体", "黑体", "微软雅黑", "仿宋", "楷体", "Arial", "Times New Roman"];

/** 中文字号 → pt 映射 */
const CN_SIZES: { label: string; pt: string }[] = [
  { label: "初号", pt: "42" }, { label: "小初", pt: "36" },
  { label: "一号", pt: "26" }, { label: "小一", pt: "24" },
  { label: "二号", pt: "22" }, { label: "小二", pt: "18" },
  { label: "三号", pt: "16" }, { label: "小三", pt: "15" },
  { label: "四号", pt: "14" }, { label: "小四", pt: "12" },
  { label: "五号", pt: "10.5" }, { label: "小五", pt: "9" },
  { label: "六号", pt: "7.5" }, { label: "小六", pt: "6.5" },
  { label: "七号", pt: "5.5" }, { label: "八号", pt: "5" },
];
const CN_SIZE_PTS = CN_SIZES.map((s) => s.pt);
const ptToCn = (pt: string) => CN_SIZES.find((s) => s.pt === pt)?.label || null;

/** 间距单位选项 */
const SPACE_UNITS = [
  { value: "行", label: "行" },
  { value: "pt", label: "pt" },
  { value: "cm", label: "cm" },
  { value: "mm", label: "mm" },
];
const INDENT_UNITS = [
  { value: "char", label: "字符" },
  { value: "cm", label: "cm" },
  { value: "mm", label: "mm" },
];

function ptToUnit(ptVal: number, unit: string, fontSizePt?: number): number {
  if (unit === "cm") return ptVal / 28.35;
  if (unit === "mm") return ptVal / 2.835;
  if ((unit === "char" || unit === "行") && fontSizePt) return ptVal / fontSizePt;
  return ptVal;
}
function unitToPt(val: number, unit: string, fontSizePt?: number): number {
  if (unit === "cm") return val * 28.35;
  if (unit === "mm") return val * 2.835;
  if ((unit === "char" || unit === "行") && fontSizePt) return val * fontSizePt;
  return val;
}
function cmToUnit(cmVal: number, unit: string, fontSizePt?: number): number {
  if (unit === "mm") return cmVal * 10;
  if (unit === "char" || unit === "行") return fontSizePt ? cmVal * 28.35 / fontSizePt : cmVal;
  return cmVal;
}
function unitToCm(val: number, unit: string, fontSizePt?: number): number {
  if (unit === "mm") return val / 10;
  if (unit === "char" || unit === "行") return fontSizePt ? val * fontSizePt / 28.35 : val;
  return val;
}

const SPACINGS = ["1.0", "1.15", "1.5", "2.0", "2.5"];
const ALIGNS = [ "left", "center", "right", "justify" ];

const DEFAULT_ELEMENTS: ElementDef[] = [
  {
    id: "title", label: "大标题", type: "heading",
    wordStyles: ["Heading 1", "heading1", "1 heading 1", "标题 1", "标题1", "title"],
    config: { font: "黑体", size: "22", bold: true, align: "center", space_before: "0", space_after: "12", color: "000000", line_spacing: "1.5" },
  },
  {
    id: "subtitle", label: "副标题", type: "heading",
    wordStyles: ["Heading 2", "heading2", "2 heading 2", "标题 2", "标题2", "subtitle"],
    config: { font: "黑体", size: "16", bold: false, align: "center", space_before: "0", space_after: "6", color: "333333", line_spacing: "1.5" },
  },
  {
    id: "heading", label: "小标题", type: "heading",
    wordStyles: ["Heading 3", "heading3", "3 heading 3", "标题 3", "标题3", "Heading 4", "heading4", "4 heading 4", "标题 4", "Heading 5", "heading5", "5 heading 5", "标题 5"],
    config: { font: "黑体", size: "14", bold: true, align: "left", space_before: "12", space_after: "6", color: "000000", line_spacing: "1.5" },
  },
  {
    id: "body", label: "正文", type: "body",
    wordStyles: ["Normal", "normal", "正文", "body text"],
    config: { font: "宋体", size: "12", bold: false, align: "justify", space_before: "0", space_after: "0", color: "000000", line_spacing: "1.5", first_line_indent: "0.74" },
  },
];

const BUILTIN_PRESETS: Record<string, {
  label: string;
  elementConfigs: Record<string, FormatConfig>;
  page: { margin_top: string; margin_bottom: string; margin_left: string; margin_right: string; header?: HeaderConfig };
}> = {
  essay: {
    label: "学术论文",
    elementConfigs: {
      title:    { font: "黑体",     size: "22", bold: true,  align: "center",  space_before: "0",  space_after: "12", color: "000000", line_spacing: "1.5" },
      subtitle: { font: "黑体",     size: "15", bold: false, align: "center",  space_before: "0",  space_after: "6",  color: "000000", line_spacing: "1.5" },
      heading:  { font: "黑体",     size: "14", bold: true,  align: "left",    space_before: "12", space_after: "6",  color: "000000", line_spacing: "1.5" },
      body:     { font: "宋体",     size: "12", bold: false, align: "justify", space_before: "0",  space_after: "0",  color: "000000", line_spacing: "1.5", first_line_indent: "0.74" },
    },
    page: { margin_top: "2.5", margin_bottom: "2.5", margin_left: "3.0", margin_right: "3.0" },
  },
  report: {
    label: "商业报告",
    elementConfigs: {
      title:    { font: "微软雅黑", size: "26", bold: true,  align: "center", space_before: "24", space_after: "12", color: "1a1a1a", line_spacing: "1.15" },
      subtitle: { font: "微软雅黑", size: "16", bold: false, align: "center", space_before: "0",  space_after: "18", color: "666666", line_spacing: "1.15" },
      heading:  { font: "微软雅黑", size: "14", bold: true,  align: "left",   space_before: "18", space_after: "6",  color: "1a1a1a", line_spacing: "1.15" },
      body:     { font: "微软雅黑", size: "11", bold: false, align: "left",   space_before: "0",  space_after: "6",  color: "333333", line_spacing: "1.15", first_line_indent: "0" },
    },
    page: { margin_top: "2.0", margin_bottom: "2.0", margin_left: "2.5", margin_right: "2.5" },
  },
  official: {
    label: "政府公文",
    elementConfigs: {
      title:    { font: "方正小标宋简体", size: "22", bold: true,  align: "center",  space_before: "0", space_after: "0", color: "000000", line_spacing: "1.5" },
      subtitle: { font: "楷体",         size: "16", bold: false, align: "center",  space_before: "0", space_after: "0", color: "000000", line_spacing: "1.5" },
      heading:  { font: "黑体",         size: "16", bold: true,  align: "left",    space_before: "0", space_after: "0", color: "000000", line_spacing: "1.5" },
      body:     { font: "仿宋",         size: "16", bold: false, align: "justify", space_before: "0", space_after: "0", color: "000000", line_spacing: "1.5", first_line_indent: "0.74" },
    },
    page: { margin_top: "3.7", margin_bottom: "3.5", margin_left: "2.8", margin_right: "2.6" },
  },
  novel: {
    label: "小说/散文",
    elementConfigs: {
      title:    { font: "楷体", size: "22", bold: true,  align: "center",  space_before: "0",  space_after: "12", color: "000000", line_spacing: "2.0" },
      subtitle: { font: "楷体", size: "15", bold: false, align: "center",  space_before: "0",  space_after: "18", color: "444444", line_spacing: "2.0" },
      heading:  { font: "楷体", size: "14", bold: true,  align: "left",    space_before: "24", space_after: "6",  color: "000000", line_spacing: "2.0" },
      body:     { font: "楷体", size: "14", bold: false, align: "justify", space_before: "0",  space_after: "0",  color: "000000", line_spacing: "2.0", first_line_indent: "0.74" },
    },
    page: { margin_top: "2.0", margin_bottom: "2.0", margin_left: "2.5", margin_right: "2.5" },
  },
};

// ── 工具 ──────────────────────────────────────────────────

function generateId(label: string, existing: ElementDef[]): string {
  const map: Record<string, string> = {
    "大":"da_","标":"biao_","题":"ti","副":"fu_","小":"xiao_","正":"zheng_","文":"wen",
    "章":"zhang","节":"jie","代":"dai_","码":"ma","块":"kuai","引":"yin_","用":"yong",
    "注":"zhu","释":"shi","表":"biao_","格":"ge","页":"ye_","眉":"mei","脚":"jiao",
    "摘":"zhai_","要":"yao",
  };
  let base = label.split("").map((ch) => map[ch] || (ch >= "一" && ch <= "鿿" ? "" : ch)).join("")
    .replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  if (!base || base.length < 2) base = "elem";
  const ids = new Set(existing.map((e) => e.id));
  let c = base, n = 2; while (ids.has(c)) { c = `${base}_${n}`; n++; }
  return c;
}

function cloneElements(src: ElementDef[]): ElementDef[] {
  return src.map((e) => ({ ...e, wordStyles: [...e.wordStyles], config: { ...e.config } }));
}

function loadJson(key: string, fallback: any) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function saveJson(key: string, data: any) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

/** 解析纯文本，智能检测标题层级，返回预览段落 */
function parseTextToParagraphs(text: string, elements: ElementDef[]): {
  paragraphs: ParagraphInfo[];
  structure: Record<string, string>;
} {
  const lines = text.split("\n").map((l) => l.trim());
  const paragraphs: ParagraphInfo[] = [];
  const structure: Record<string, string> = {};

  const bodyId = elements.find((e) => e.type === "body")?.id || "body";

  const getHeadingId = (level: 1 | 2 | 3): string => {
    const headings = elements.filter((e) => e.type === "heading");
    const patterns: { lvl: 1 | 2 | 3; tests: RegExp[] }[] = [
      { lvl: 1, tests: [/heading 1/i, /标题 1/i, /^title$/i] },
      { lvl: 2, tests: [/heading 2/i, /标题 2/i, /subtitle/i] },
      { lvl: 3, tests: [/heading 3/i, /标题 3/i] },
    ];
    for (const p of patterns) {
      if (p.lvl !== level) continue;
      for (const el of headings) {
        if (el.wordStyles.some((s) => p.tests.some((t) => t.test(s.trim())))) return el.id;
      }
    }
    if (headings.length >= level) return headings[level - 1].id;
    if (headings.length > 0) return headings[headings.length - 1].id;
    return bodyId;
  };

  /** 判断是否为强标题信号（编号模式、首行等） */
  const detectStrong = (line: string, idx: number): 1 | 2 | 3 | null => {
    if (/^(第[一二三四五六七八九十百千\d]+[章节篇部]|附录)/.test(line)) return 1;
    if (/^[一二三四五六七八九十]+[、．]/.test(line)) return 2;
    if (/^\d+\.\d+\.\d+/.test(line) && line.length <= 25) return 3;
    if (/^\d+\.\d+/.test(line) && line.length <= 25) return 2;
    if (/^\d+[.、)]/.test(line) && line.length <= 20) return 2;
    if (/^[（(][一二三四五六七八九十\d]+[）)]/.test(line) && line.length <= 20) return 3;
    if (idx === 0 && line.length < 60) return 1;
    return null;
  };

  /** 判断是否为弱标题候选（短文本、无句号、无列表标记） */
  const isWeakCandidate = (line: string): boolean => (
    line.length < 30
    && line.length >= 2
    && !/[。！？，；：.!?;，]$/.test(line)
    && !/[、；：]/.test(line)
    && !line.includes('→')
    && !/^[-•*▪▶]/.test(line)
  );

  // ── Phase 1: 初步判断 ──
  const raw: { level: 1 | 2 | 3 | null; text: string; weak: boolean }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const strong = detectStrong(line, raw.length);
    const weak = !strong && isWeakCandidate(line);
    raw.push({
      level: strong || (weak ? 3 : null),
      text: line,
      weak: !strong && weak,
    });
  }

  // ── Phase 2: 连续弱候选 → 全部降为正文 ──
  // 连续 2+ 个弱候选意味着是列表项，不是标题
  let i = 0;
  while (i < raw.length) {
    if (raw[i].weak) {
      let j = i + 1;
      while (j < raw.length && raw[j].weak) j++;
      if (j - i >= 2) {
        // 连续弱候选 → 全部降为正文
        for (let k = i; k < j; k++) raw[k].level = null;
      }
      i = j;
    } else {
      i++;
    }
  }

  // ── Phase 3: 弱候选不是 Headings → 降为正文 ──
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].weak && raw[i].level !== null) {
      const nextIsHeading = i < raw.length - 1 && raw[i + 1].level !== null;
      if (!nextIsHeading) {
        raw[i].level = null;
      }
    }
  }

  // ── 输出 ──
  for (const item of raw) {
    const elementId = item.level ? getHeadingId(item.level) : bodyId;
    paragraphs.push({
      index: paragraphs.length,
      text: item.text,
      style: item.level ? `H${item.level}` : "Normal",
      element: elementId,
    });
    structure[String(paragraphs.length - 1)] = elementId;
  }

  return { paragraphs, structure };
}

// ── 子组件：间距输入（带单位切换）─────────────────────────
function SpacingField({
  label, value, unit, units, onChange, fontSizePt,
}: {
  label: string;
  value: string;    // 标准单位值（pt 或 cm）
  unit: string;
  units: { value: string; label: string }[];
  onChange: (standardVal: string) => void;
  fontSizePt?: number;  // "字符" 单位转换需要
}) {
  const [u, setU] = useState(unit);
  const num = parseFloat(value) || 0;

  // 显示值 = 标准值 → 当前单位
  const displayVal = (() => {
    if (units[0].value === "pt") {
      return ptToUnit(num, u, fontSizePt).toFixed(u === "mm" ? 1 : 2);
    } else {
      return cmToUnit(num, u, fontSizePt).toFixed(u === "mm" ? 1 : 2);
    }
  })();

  const handleChange = (raw: string) => {
    const v = parseFloat(raw);
    if (isNaN(v)) return;
    if (units[0].value === "pt") {
      onChange(unitToPt(v, u, fontSizePt).toFixed(1));
    } else {
      onChange(unitToCm(v, u, fontSizePt).toFixed(2));
    }
  };

  const handleUnitChange = (newUnit: string) => {
    setU(newUnit);
    // 值不变，只是单位变了，不需要回调
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <div className="flex gap-1">
        <Input type="number" min="0" max="100" step="0.1"
          value={displayVal} onChange={(e) => handleChange(e.target.value)} className="flex-1" />
        <Select value={u} onValueChange={(v) => v && handleUnitChange(v)}>
          <SelectTrigger className="w-[70px] h-9 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>{units.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {/* 快速预设按钮（仅"行"单位时显示） */}
      {u === "行" && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {[
            { v: "0", label: "无" },
            { v: "0.25", label: "¼行" },
            { v: "0.5", label: "½行" },
            { v: "1", label: "1行" },
            { v: "1.5", label: "1½行" },
            { v: "2", label: "2行" },
          ].map((preset) => {
            const isActive = Math.abs(parseFloat(displayVal) - parseFloat(preset.v)) < 0.05;
            return (
              <button key={preset.v} onClick={() => handleChange(preset.v)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  isActive
                    ? "bg-primary/10 border-primary/30 text-primary font-medium"
                    : "border-border hover:bg-muted hover:border-foreground/20 text-muted-foreground"
                }`}>
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 子组件：字号选择（中文 + pt）─────────────────────────
function SizeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cnLabel = ptToCn(value);
  const displayValue = value;

  return (
    <Select value={displayValue} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger>
        <SelectValue>
          {cnLabel ? `${cnLabel} (${value}pt)` : `${value}pt`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CN_SIZES.map((s) => (
          <SelectItem key={s.pt} value={s.pt}>
            <span className="flex items-center gap-3">
              <span className="w-6 text-right text-[10px] text-muted-foreground/50">{s.pt}</span>
              <span style={{ fontSize: `${parseFloat(s.pt) * 0.5}px`, lineHeight: "1.2" }}>{s.label}</span>
            </span>
          </SelectItem>
        ))}
        {/* 额外数字选项 */}
        {!CN_SIZE_PTS.includes(value) && (
          <SelectItem value={value}>
            <span className="flex items-center gap-3">
              <span className="w-6 text-right text-[10px] text-muted-foreground/50">{value}</span>
              <span style={{ fontSize: `${parseFloat(value) * 0.5}px`, lineHeight: "1.2" }}>{value}pt</span>
            </span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

// ── 子组件：批量编辑工具栏 ───────────────────────────────
function BatchToolbar({
  selectedIds, elements, onApply, onClear, allFonts, loc,
}: {
  selectedIds: Set<string>; elements: ElementDef[]; onApply: (key: string, value: any) => void; onClear: () => void;
  allFonts: string[];
  loc: (key: string, params?: Record<string, string>) => string;
}) {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 2) return null;
  // 统一改 pt，字符映射的转换不用在 toolbar 里处理
  return (
    <div className="flex items-center gap-2 flex-wrap p-2.5 bg-primary/[0.04] dark:bg-primary/[0.08] rounded-lg border border-primary/10 dark:border-primary/15">
      <span className="text-xs text-primary font-medium whitespace-nowrap shrink-0">{loc("batch.selected", { n: String(selected.length) })}</span>
      <span className="w-px h-4 bg-border shrink-0" />
      <Select onValueChange={(v) => v !== "__keep" && onApply("font", v)}>
        <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue placeholder={loc("config.font")} /></SelectTrigger>
        <SelectContent><SelectItem value="__keep">{loc("config.font")}...</SelectItem>{allFonts.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
      </Select>
      <Select onValueChange={(v) => v !== "__keep" && onApply("size", v)}>
        <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue placeholder={loc("config.size")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__keep">{loc("config.size")}...</SelectItem>
          {CN_SIZES.map((s) => <SelectItem key={s.pt} value={s.pt}>{s.label} ({s.pt}pt)</SelectItem>)}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => v !== "__keep" && onApply("bold", v === "yes")}>
        <SelectTrigger className="h-7 text-xs w-[80px]"><SelectValue placeholder={loc("config.bold")} /></SelectTrigger>
        <SelectContent><SelectItem value="__keep">{loc("config.bold")}...</SelectItem><SelectItem value="yes">{loc("config.bold_yes")}</SelectItem><SelectItem value="no">{loc("config.bold_no")}</SelectItem></SelectContent>
      </Select>
      <Select onValueChange={(v) => v !== "__keep" && onApply("line_spacing", v)}>
        <SelectTrigger className="h-7 text-xs w-[72px]"><SelectValue placeholder={loc("config.line_spacing")} /></SelectTrigger>
        <SelectContent><SelectItem value="__keep">{loc("config.line_spacing")}...</SelectItem>{SPACINGS.map((s) => <SelectItem key={s} value={s}>{s}{loc("unit.times")}</SelectItem>)}</SelectContent>
      </Select>
      <Select onValueChange={(v) => v !== "__keep" && onApply("align", v)}>
        <SelectTrigger className="h-7 text-xs w-[80px]"><SelectValue placeholder={loc("config.align")} /></SelectTrigger>
        <SelectContent><SelectItem value="__keep">{loc("config.align")}...</SelectItem>{ALIGNS.map((a) => <SelectItem key={a} value={a}>{loc("config.align_" + a)}</SelectItem>)}</SelectContent>
      </Select>
      <span className="w-px h-4 bg-border shrink-0" />
      <div className="flex items-center gap-1">
        <input type="color" className="w-7 h-7 rounded border cursor-pointer"
          onChange={(e) => onApply("color", e.target.value.replace("#", ""))} title={loc("config.color")} />
        <div className="flex gap-0.5">
          {["000000","333333","8B0000","CC0000","2980b9"].map((c) => (
            <button key={c} onClick={() => onApply("color", c)}
              className="w-3.5 h-3.5 rounded-full border border-border/50 cursor-pointer hover:scale-125 transition-transform"
              style={{ backgroundColor: `#${c}` }} title={`#${c}`} aria-label={`Color #${c}`} />
          ))}
        </div>
      </div>
      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={onClear}>{loc("elem.cancel")}</Button>
    </div>
  );
}

// ── 子组件：文档元素编辑面板 ──────────────────────────────
function ElementPanel({
  element, isSelected, onToggleSelect, onConfigChange, onMetaChange,
  onCopy, onDelete, canDelete, onDragStart, onDragOver, onDragLeave, onDrop,
  draggedId, dragOverId, allFonts, loc,
}: {
  element: ElementDef; isSelected: boolean; onToggleSelect: (id: string) => void;
  onConfigChange: (id: string, key: string, value: any) => void;
  onMetaChange: (id: string, field: "label" | "wordStyles", value: any) => void;
  onCopy: (id: string) => void; onDelete: (id: string) => void;
  canDelete: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  draggedId: string | null;
  dragOverId: string | null;
  allFonts: string[];
  loc: (key: string, params?: Record<string, string>) => string;
}) {
  const [open, setOpen] = useState(false);
  const { id, label, type, wordStyles, config } = element;
  const setCfg = (key: string, value: any) => onConfigChange(id, key, value);
  const fontSizePt = parseFloat(config.size) || 12;

  return (
    <div className={`border rounded-lg transition-all duration-150 ${
        isSelected ? "ring-2 ring-primary/30" : ""
      } ${
        id === draggedId ? "opacity-40 scale-[0.98]" : ""
      } ${
        id === dragOverId && id !== draggedId ? "border-primary border-2 shadow-sm translate-y-0.5" : ""
      }`}
      draggable onDragStart={(e) => onDragStart(e, id)}
      onDragOver={(e) => onDragOver(e, id)} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, id)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground/30 dark:text-muted-foreground/40 hover:text-muted-foreground shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(id)}
          className="w-4 h-4 rounded border-border shrink-0 cursor-pointer" />
        <button type="button" className="flex items-center gap-2 flex-1 min-w-0 hover:text-foreground/80 text-left"
          onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <input className="font-medium text-sm bg-transparent border-b border-dashed border-border/50 dark:border-border/60 focus:border-foreground/40 focus:outline-none min-w-[40px] max-w-[100px]"
            value={label} onChange={(e) => onMetaChange(id, "label", e.target.value)} onClick={(e) => e.stopPropagation()} />
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            type === "heading"
              ? wordStyles.some(s => /heading 1|标题 1|^title$/i.test(s))
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                : wordStyles.some(s => /heading 2|标题 2|subtitle/i.test(s))
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
            {type === "heading"
              ? wordStyles.some(s => /heading 1|标题 1|^title$/i.test(s)) ? "H1"
                : wordStyles.some(s => /heading 2|标题 2|subtitle/i.test(s)) ? "H2"
                : "H3"
              : loc("badge.body")}
          </span>
        </button>
        <button type="button" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={() => onCopy(id)} title={loc("elem.copy")} aria-label={loc("elem.copy")}><Copy className="w-3.5 h-3.5" /></button>
        <button type="button" disabled={!canDelete}
          className={`p-1 rounded ${canDelete ? "hover:bg-destructive/10 dark:hover:bg-destructive/20 text-muted-foreground hover:text-destructive" : "text-muted-foreground/30 dark:text-muted-foreground/40 cursor-not-allowed"}`}
          onClick={() => onDelete(id)} title={canDelete ? loc("elem.delete") : loc("elem.at_least_one")} aria-label={loc("elem.delete")}><X className="w-4 h-4" /></button>
      </div>
      <div className={`panel-content ${open ? '' : 'collapsed'}`}>
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{loc("elem.style_name")}<span className="ml-1 text-[10px] text-muted-foreground cursor-help" title={loc("elem.style_hint")}>ⓘ</span></label>
            <Input value={wordStyles.join(", ")} onChange={(e) => onMetaChange(id, "wordStyles", e.target.value)}
              placeholder={loc("elem.placeholder_style")} className="text-xs h-8" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 字体 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{loc("config.font")}</label>
              <Select value={config.font} onValueChange={(v) => setCfg("font", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{allFonts.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 字号（中文体系） */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{loc("config.size")}</label>
              <SizeSelect value={config.size} onChange={(v) => setCfg("size", v)} />
            </div>
            {/* 颜色 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{loc("config.color")}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={`#${config.color}`}
                  onChange={(e) => setCfg("color", e.target.value.replace("#", ""))} className="w-8 h-8 rounded border cursor-pointer" />
                <Input value={`#${config.color}`} onChange={(e) => setCfg("color", e.target.value.replace("#", ""))} className="font-mono text-xs h-8" />
              </div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {["000000","333333","666666","1a1a1a","444444","8B0000","CC0000","2980b9","27ae60","E67E22"].map((c) => (
                  <button key={c} onClick={() => setCfg("color", c)}
                    className="w-4.5 h-4.5 rounded-full border border-border cursor-pointer hover:scale-125 transition-transform"
                    style={{ backgroundColor: `#${c}` }} title={`#${c}`} aria-label={`Color #${c}`} />
                ))}
              </div>
            </div>
            {/* 对齐 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{loc("config.align")}</label>
              <Select value={config.align} onValueChange={(v) => setCfg("align", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALIGNS.map((a) => <SelectItem key={a} value={a}>{loc("config.align_" + a)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 加粗 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{loc("config.bold")}</label>
              <Select value={config.bold ? "yes" : "no"} onValueChange={(v) => setCfg("bold", v === "yes")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="yes">{loc("config.bold_yes")}</SelectItem><SelectItem value="no">{loc("config.bold_no")}</SelectItem></SelectContent>
              </Select>
            </div>
            {/* 行间距 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{loc("config.line_spacing")}</label>
              <Select value={String(config.line_spacing)} onValueChange={(v) => setCfg("line_spacing", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SPACINGS.map((s) => <SelectItem key={s} value={s}>{s}{loc("unit.times")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 段前距（默认"行"单位） */}
            <SpacingField label={loc("config.space_before")} value={config.space_before} unit="行" units={SPACE_UNITS}
              onChange={(v) => setCfg("space_before", v)} fontSizePt={fontSizePt} />
            {/* 段后距（默认"行"单位） */}
            <SpacingField label={loc("config.space_after")} value={config.space_after} unit="行" units={SPACE_UNITS}
              onChange={(v) => setCfg("space_after", v)} fontSizePt={fontSizePt} />
            {/* 首行缩进（默认"字符"单位） */}
            {type === "body" && (
              <SpacingField label={loc("config.indent")} value={config.first_line_indent || "0"} unit="char" units={INDENT_UNITS}
                onChange={(v) => setCfg("first_line_indent", v)} fontSizePt={fontSizePt} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 子组件：格式预览 ─────────────────────────────────────
function PreviewSection({ elements, docParagraphs, loading, headerConfig, loc }: {
  elements: ElementDef[];
  docParagraphs: ParagraphInfo[] | null;
  loading: boolean;
  headerConfig?: HeaderConfig;
  loc: (key: string, params?: Record<string, string>) => string;
}) {
  const hasDoc = docParagraphs && docParagraphs.length > 0;

  // 文档统计
  const stats = hasDoc ? (() => {
    const totalChars = docParagraphs!.reduce((s, p) => s + p.text.length, 0);
    const cnChars = docParagraphs!.reduce((s, p) => s + (p.text.match(/[一-鿿]/g)?.length || 0), 0);
    const enWords = docParagraphs!.reduce((s, p) => s + (p.text.match(/[a-zA-Z]+/g)?.length || 0), 0);
    const estPages = Math.max(1, Math.round(totalChars / 1500));
    return { paragraphs: docParagraphs!.length, chars: totalChars, words: cnChars + enWords, pages: estPages };
  })() : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{loc("preview.title")}</CardTitle>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{stats.paragraphs} {loc("stats.paragraphs")}</span>
              <span className="text-border">·</span>
              <span>{stats.words} {loc("stats.words")}</span>
              <span className="text-border">·</span>
              <span>≈{stats.pages} {loc("stats.pages")}</span>
            </div>
          )}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 页眉/页码预览 */}
        {headerConfig && (headerConfig.showHeader || headerConfig.showPageNumber) && hasDoc && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/30 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {headerConfig.showHeader && (
                <span className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">{loc("preview.header")}:</span>
                  <span className="font-medium text-foreground/70">
                    {headerConfig.useChapterHeader ? loc("header.chapter_hint") : (headerConfig.text || `—`)}
                  </span>
                </span>
              )}
            </div>
            {headerConfig.showPageNumber && (
              <span className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">{loc("preview.page")}</span>
                <span className="font-mono text-foreground/70">1</span>
              </span>
            )}
          </div>
        )}

        {hasDoc ? (
          // ── 文档实际段落预览（合并相邻同类型段落）────
          (() => {
            const groups: { element: string; items: typeof docParagraphs }[] = [];
            const items = docParagraphs.slice(0, 60);
            for (const p of items) {
              const prev = groups[groups.length - 1];
              const el = elements.find((e) => e.id === p.element);
              const canMerge = el?.type === "body";
              if (prev && prev.element === p.element && canMerge) {
                prev.items.push(p);
              } else {
                groups.push({ element: p.element, items: [p] });
              }
            }
            return groups.map((group) => {
              const el = elements.find((e) => e.id === group.element);
              if (!el) return null;
              const c = el.config;
              const fontSizePt = parseFloat(c.size);
              const fontSizePx = fontSizePt * 1.33;
              const alignMap: Record<string, string> = { left: "left", center: "center", right: "right", justify: "justify" };
              const isMerged = group.items.length > 1;

              return (
                <div key={group.items[0].index} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                  <div className="shrink-0 flex flex-col items-end gap-0.5 min-w-[70px]">
                    <span className="text-[10px] text-muted-foreground">{group.items[0].style}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      el.type === "heading"
                        ? el.wordStyles.some(s => /heading 1|标题 1|^title$/i.test(s))
                          ? "bg-indigo-100 text-indigo-700"
                          : el.wordStyles.some(s => /heading 2|标题 2|subtitle/i.test(s))
                            ? "bg-blue-100 text-blue-700"
                            : "bg-sky-100 text-sky-700"
                        : "bg-emerald-100 text-emerald-700"}`}>
                      {el.type === "heading"
                        ? el.wordStyles.some(s => /heading 1|标题 1|^title$/i.test(s)) ? "H1"
                          : el.wordStyles.some(s => /heading 2|标题 2|subtitle/i.test(s)) ? "H2"
                          : "H3"
                        : loc("badge.body")}{isMerged ? ` ×${group.items.length}` : ""}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {group.items.map((p, i) => (
                      <div key={p.index} style={{
                        fontFamily: `"${c.font}", sans-serif`, fontSize: `${fontSizePx}px`,
                        fontWeight: c.bold ? 700 : 400, color: `#${c.color}`,
                        textAlign: (alignMap[c.align] || "left") as React.CSSProperties["textAlign"],
                        lineHeight: i === group.items.length - 1 ? parseFloat(c.line_spacing) : parseFloat(c.line_spacing),
                        marginTop: i === 0 ? `${parseFloat(c.space_before) * 1.33}px` : undefined,
                        marginBottom: i === group.items.length - 1 ? `${parseFloat(c.space_after) * 1.33}px` : undefined,
                        textIndent: c.first_line_indent ? `${parseFloat(c.first_line_indent) * 37.8}px` : undefined,
                      }}>
                        {p.text.length > 120 ? p.text.slice(0, 120) + "…" : p.text}
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()
        ) : (
          // ── 退化为示例文字预览 ──
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50">
              <Eye className="w-3.5 h-3.5 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground/60">{loc("preview.example")} · {loc("preview.example_desc")}</p>
            </div>
            {elements.filter((e) => e.wordStyles.length > 0).map((el) => {
              const c = el.config;
              const fontSizePx = parseFloat(c.size) * 1.33;
              const alignMap: Record<string, string> = { left: "left", center: "center", right: "right", justify: "justify" };
              return (
                <div key={el.id} className="border-b border-border/40 dark:border-border/50 pb-3 last:border-0 last:pb-0">
                  <p className="text-[10px] text-muted-foreground mb-1">{el.label} · {el.wordStyles.slice(0, 2).join(", ")}</p>
                  <div style={{
                    fontFamily: `"${c.font}", sans-serif`, fontSize: `${fontSizePx}px`,
                    fontWeight: c.bold ? 700 : 400, color: `#${c.color}`,
                    textAlign: (alignMap[c.align] || "left") as React.CSSProperties["textAlign"], lineHeight: parseFloat(c.line_spacing),
                    marginTop: `${parseFloat(c.space_before) * 1.33}px`,
                    marginBottom: `${parseFloat(c.space_after) * 1.33}px`,
                    textIndent: c.first_line_indent ? `${parseFloat(c.first_line_indent) * 37.8}px` : undefined,
                    padding: "4px 0",
                  }}>
                    {el.label} — 预览文字示例 0123 ABC abc
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && !hasDoc && elements.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Eye className="w-8 h-8 opacity-30" />
            <p className="text-sm">{loc("preview.empty")}</p>
            <p className="text-xs opacity-60">{loc("preview.empty_hint")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 主页面 ────────────────────────────────────────────────
export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [textContent, setTextContent] = useState("");
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState<string>("essay");
  const [elements, setElements] = useState<ElementDef[]>(() => cloneElements(DEFAULT_ELEMENTS));
  const [pageMargins, setPageMargins] = useState<{ margin_top: string; margin_bottom: string; margin_left: string; margin_right: string }>(
    { margin_top: "2.5", margin_bottom: "2.5", margin_left: "3.0", margin_right: "3.0" }
  );
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    showHeader: false,
    text: "",
    useChapterHeader: false,
    showPageNumber: false,
    pageNumberAlign: "center",
  });

  // 自定义字体
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [fontInput, setFontInput] = useState("");
  const allFonts = [...FONTS, ...customFonts];

  // 自定义预设
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [savePresetName, setSavePresetName] = useState("");

  // 添加元素
  const [showAddForm, setShowAddForm] = useState<"heading" | "body" | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newStyles, setNewStyles] = useState("");

  // 批量选中 + 拖拽
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // 文档预览
  const [previewData, setPreviewData] = useState<ParagraphInfo[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);


  // API
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSuggestion, setErrorSuggestion] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState("formatted");
  const { lang, setLang, loc } = useLocale();
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // ── 主题切换 ──────────────────────────────────────────
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = localStorage.getItem("doc-format-theme") as "light" | "dark" | null;
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try { localStorage.setItem("doc-format-theme", next); } catch {}
      return next;
    });
  }, []);

  const showError = (msg: string) => {
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("net::ERR_")) {
      setError(loc("error.network"));
      setErrorSuggestion(loc("error.retry_hint_network"));
    } else if (msg.includes("500") || msg.includes("Internal Server")) {
      setError(loc("error.server"));
      setErrorSuggestion(loc("error.retry_hint_server"));
    } else if (msg.includes("413") || msg.includes("Payload Too Large")) {
      setError(loc("error.payload"));
      setErrorSuggestion(loc("error.retry_hint_payload"));
    } else if (msg.includes("style") || msg.includes("映射冲突")) {
      setError(msg);
      setErrorSuggestion(loc("error.retry_hint_style"));
    } else {
      setError(msg || loc("error.unknown"));
      setErrorSuggestion(loc("error.retry_hint_generic"));
    }
  };
  const clearError = () => { setError(null); setErrorSuggestion(null); };

  // ── 撤销历史 ──────────────────────────────────────────
  const MAX_HISTORY = 50;
  const [history, setHistory] = useState<{ elements: ElementDef[]; margins: typeof pageMargins }[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const skipHistoryRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const pushHistory = useCallback((els: ElementDef[], mgs: typeof pageMargins) => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIdx + 1);
      const next = [...trimmed, { elements: cloneElements(els), margins: { ...mgs } }];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIdx((i) => Math.min(i + 1, MAX_HISTORY - 1));
  }, [historyIdx]);
  const undo = useCallback(() => {
    setHistory((prev) => {
      if (historyIdx <= 0 || prev.length === 0) return prev;
      const target = prev[historyIdx - 1];
      if (!target) return prev;
      skipHistoryRef.current = true;
      setElements(cloneElements(target.elements));
      setPageMargins({ ...target.margins });
      setHistoryIdx((i) => i - 1);
      return prev;
    });
  }, [historyIdx]);
  const redo = useCallback(() => {
    setHistory((prev) => {
      if (historyIdx >= prev.length - 1) return prev;
      const target = prev[historyIdx + 1];
      if (!target) return prev;
      skipHistoryRef.current = true;
      setElements(cloneElements(target.elements));
      setPageMargins({ ...target.margins });
      setHistoryIdx((i) => i + 1);
      return prev;
    });
  }, [historyIdx]);

  // ── localStorage hydrate + auto-save ──────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      // Hydrate state from localStorage after first mount (SSR-safe)
      const saved = loadJson(STORAGE_KEY, null);
      if (saved) {
        if (saved.mode) setMode(saved.mode);
        if (saved.preset) setPreset(saved.preset);
        if (saved.elements) setElements(cloneElements(saved.elements));
        if (saved.pageMargins) setPageMargins(saved.pageMargins);
        if (saved.headerConfig) setHeaderConfig(saved.headerConfig);
        if (saved.customFonts) setCustomFonts(saved.customFonts);
      }
      const savedPresets = loadJson(PRESETS_KEY, []);
      if (savedPresets.length) setUserPresets(savedPresets);
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveJson(STORAGE_KEY, { elements, pageMargins, mode, preset, headerConfig, customFonts }), 300);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [elements, pageMargins, mode, preset, headerConfig]);
  useEffect(() => { if (isMounted.current) saveJson(PRESETS_KEY, userPresets); }, [userPresets]);

  // ── 配置变更时推历史 ──────────────────────────────────
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isMounted.current) return;
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => pushHistory(elements, pageMargins), 500);
    return () => { if (historyTimer.current) clearTimeout(historyTimer.current); };
  }, [elements, pageMargins]);

  // ── 键盘快捷键 ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === "y" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); redo(); }
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if ((inputMode === "file" && file) || (inputMode === "text" && textContent.trim())) handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, inputMode, file, textContent]);

  // ── 文件上传后自动提取预览 ─────────────────────────────
  useEffect(() => {
    if (!file || inputMode !== "file") { setPreviewData(null); return; }
    setPreviewLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fetch("/api/preview", { method: "POST", body: fd })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (Array.isArray(data)) setPreviewData(data);
        else setPreviewData(null);
      })
      .catch(() => setPreviewData(null))
      .finally(() => setPreviewLoading(false));
  }, [file, inputMode]);

  // ── 文字输入模式自动解析预览 ────────────────────────────
  useEffect(() => {
    if (inputMode !== "text" || !textContent.trim()) {
      if (inputMode !== "file") setPreviewData(null);
      return;
    }
    const { paragraphs } = parseTextToParagraphs(textContent, elements);
    setPreviewData(paragraphs);
  }, [textContent, inputMode, elements]);

  // ── 派生 ──────────────────────────────────────────────
  const headingElements = elements.filter((e) => e.type === "heading");
  const bodyElements = elements.filter((e) => e.type === "body");
  const allPresets = { ...BUILTIN_PRESETS, ...Object.fromEntries(userPresets.map((p) => [p.id, p])) };

  // ── 文件拖拽 ──────────────────────────────────────────
  const onDropFile = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".docx")) { setFile(f); setInputMode("file"); }
  }, []);

  // ── 预设 ──────────────────────────────────────────────
  const applyPreset = (key: string) => {
    setPreset(key);
    const p = allPresets[key];
    if (!p) return;
    if ("elements" in p && Array.isArray((p as UserPreset).elements)) {
      const up = p as UserPreset;
      setElements(cloneElements(up.elements));
      setPageMargins({ ...up.page });
      if (up.header) setHeaderConfig({ ...up.header });
    } else if ("elementConfigs" in p) {
      const bp = p as typeof BUILTIN_PRESETS[string];
      setElements((prev) => prev.map((el) => {
        const cfg = bp.elementConfigs[el.id];
        return cfg ? { ...el, config: { ...cfg } } : el;
      }));
      setPageMargins({ ...bp.page });
      if (bp.page.header) setHeaderConfig({ ...bp.page.header });
    }
  };

  // ── 元素 CRUD ─────────────────────────────────────────
  const updateElementConfig = (id: string, key: string, value: any) => {
    setElements((prev) => prev.map((e) => e.id === id ? { ...e, config: { ...e.config, [key]: value } } : e));
    setMode("custom");
  };
  const updateElementMeta = (id: string, field: "label" | "wordStyles", value: any) => {
    setElements((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      if (field === "label") return { ...e, label: value };
      const styles = typeof value === "string" ? value.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) : value;
      return { ...e, wordStyles: styles };
    }));
  };
  const removeElement = (id: string) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    if (!window.confirm(loc("elem.confirm_delete", { label: el.label }))) return;
    setElements((prev) => {
      if (prev.length <= 1) { setError(loc("elem.at_least_one")); return prev; }
      return prev.filter((e) => e.id !== id);
    });
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };
  const copyElement = (id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const clone: ElementDef = { ...src, id: generateId(id + "_copy", prev), label: src.label + loc("elem.copy_suffix"), wordStyles: [...src.wordStyles], config: { ...src.config } };
      const next = [...prev]; next.splice(idx + 1, 0, clone); return next;
    });
  };
  const addElement = () => {
    if (!showAddForm) return;
    const label = newLabel.trim();
    if (!label) { setError(loc("error.element_name_missing")); return; }
    const type = showAddForm;
    const wordStyles = newStyles.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const bc: FormatConfig = type === "body"
      ? { font: "宋体", size: "12", bold: false, align: "justify", space_before: "0", space_after: "0", color: "000000", line_spacing: "1.5", first_line_indent: "0.74" }
      : { font: "黑体", size: "14", bold: true, align: "left", space_before: "12", space_after: "6", color: "000000", line_spacing: "1.5" };
    setElements((prev) => [...prev, { id: generateId(label, elements), label, type, wordStyles, config: { ...bc } }]);
    setShowAddForm(null); setNewLabel(""); setNewStyles(""); clearError();
  };
  const resetElements = () => {
    if (!window.confirm(loc("confirm.reset"))) return;
    setElements(cloneElements(DEFAULT_ELEMENTS));
    setPageMargins({ margin_top: "2.5", margin_bottom: "2.5", margin_left: "3.0", margin_right: "3.0" });
    clearError();
  };

  // ── 批量编辑 ──────────────────────────────────────────
  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const batchApply = (key: string, value: any) => {
    if (selectedIds.size < 2) return;
    setElements((prev) => prev.map((e) => selectedIds.has(e.id) ? { ...e, config: { ...e.config, [key]: value } } : e));
    setMode("custom");
  };
  const clearSelection = () => setSelectedIds(new Set());

  // ── 拖拽 ──────────────────────────────────────────────
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };
  const handleDragLeave = () => setDragOverId(null);
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault(); setDragOverId(null); setDraggedId(null);
    const srcId = e.dataTransfer.getData("text/plain");
    if (!srcId || srcId === targetId) return;
    setElements((prev) => {
      const si = prev.findIndex((el) => el.id === srcId);
      const ti = prev.findIndex((el) => el.id === targetId);
      if (si === -1 || ti === -1 || prev[si].type !== prev[ti].type) return prev;
      const next = [...prev]; next.splice(si, 1);
      const newTi = next.findIndex((el) => el.id === targetId);
      next.splice(newTi, 0, prev[si]); return next;
    });
  };

  // ── 自定义预设 ────────────────────────────────────────
  const saveCurrentAsPreset = () => {
    const name = savePresetName.trim();
    if (!name) { setError(loc("error.preset_name_missing")); return; }
    const id = "user_" + name.toLowerCase().replace(/[^a-z0-9一-鿿]/g, "_");
    const np: UserPreset = { id, label: name, elements: cloneElements(elements), page: { ...pageMargins }, header: { ...headerConfig } };
    setUserPresets((prev) => { const f = prev.filter((p) => p.id !== id); return [...f, np]; });
    setSavePresetName(""); clearError();
  };
  const deleteUserPreset = (id: string) => setUserPresets((prev) => prev.filter((p) => p.id !== id));
  const startRenamePreset = (id: string) => setEditingPresetId(id);
  const commitRenamePreset = (id: string, newLabel: string) => {
    setUserPresets((prev) => prev.map((p) => p.id === id ? { ...p, label: newLabel } : p));
    setEditingPresetId(null);
  };

  // ── 提交 ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (inputMode === "file" && !file) return;
    if (inputMode === "text" && !textContent.trim()) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true); clearError(); setResultUrl(null);

    // style_map
    const styleMap: Record<string, string> = {}; const conflicts: string[] = [];
    for (const el of elements) {
      for (const s of el.wordStyles) {
        const k = s.toLowerCase().trim(); if (!k) continue;
        if (styleMap[k] && styleMap[k] !== el.id) conflicts.push(`"${s}" → "${styleMap[k]}" & "${el.id}"`);
        styleMap[k] = el.id;
      }
    }
    if (conflicts.length > 0) { showError(`${loc("error.conflict")}: ${conflicts.join("; ")}`); setLoading(false); isSubmittingRef.current = false; return; }

    const normalize = (cfg: FormatConfig) => {
      const nk = ["size", "space_before", "space_after", "line_spacing", "first_line_indent"];
      const r: Record<string, any> = {};
      for (const [k, v] of Object.entries(cfg)) r[k] = nk.includes(k) ? Number(v) : v;
      return r;
    };
    const elementsObj: Record<string, any> = {};
    for (const el of elements) elementsObj[el.id] = normalize(el.config);

    const textStructure = inputMode === "text" && textContent.trim()
      ? parseTextToParagraphs(textContent, elements).structure
      : undefined;

    const config = {
      elements: elementsObj,
      style_map: styleMap,
      page: {
        margin_top: Number(pageMargins.margin_top),
        margin_bottom: Number(pageMargins.margin_bottom),
        margin_left: Number(pageMargins.margin_left),
        margin_right: Number(pageMargins.margin_right),
        ...(headerConfig.showHeader || headerConfig.showPageNumber ? {
          header: {
            show_header: headerConfig.showHeader,
            text: headerConfig.text,
            show_page_number: headerConfig.showPageNumber,
            page_number_align: headerConfig.pageNumberAlign,
            use_chapter_header: headerConfig.useChapterHeader,
          },
        } : {}),
      },
      ...(textStructure ? { text_structure: textStructure } : {}),
    };

    const fd = new FormData();
    if (inputMode === "file") fd.append("file", file!);
    else fd.append("text", textContent);
    fd.append("config", JSON.stringify(config));

    try {
      const res = await fetch("/api/format", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.text()) || "Server error");
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) { showError(err.message || ""); }
    finally { setLoading(false); isSubmittingRef.current = false; }
  };

  // ── AI Agent ───────────────────────────────────────────
  const buildContext = useCallback((): ToolContext => ({
    elements: elements as any,
    pageMargins: pageMargins,
    headerConfig: headerConfig,
    preset,
    canUndo: historyIdx > 0,
    canRedo: historyIdx < history.length - 1,
  }), [elements, pageMargins, headerConfig, preset, historyIdx, history]);

  const handleToolCall = useCallback((toolName: string, args: Record<string, any>) => {
    switch (toolName) {
      case "apply_preset":
        applyPreset(args.presetName);
        break;
      case "add_element":
        if (args.type && args.label) {
          const wordStylesArr = args.wordStyles
            ? String(args.wordStyles).split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
            : [];
          const newEl = {
            id: `agent-${Date.now()}`,
            label: args.label,
            type: args.type as "heading" | "body",
            wordStyles: wordStylesArr,
            config: args.type === "body"
              ? { font: "宋体", size: "12", bold: false, align: "justify", space_before: "0", space_after: "0", color: "000000", line_spacing: "1.5", first_line_indent: "0.74" }
              : { font: "黑体", size: "14", bold: true, align: "left", space_before: "12", space_after: "6", color: "000000", line_spacing: "1.5" },
          };
          setElements((prev: any[]) => [...prev, newEl]);
        }
        break;
      case "remove_element":
        setElements((prev: any[]) => prev.filter((e: any) => e.id !== args.elementId));
        break;
      case "update_config":
        setElements((prev: any[]) => prev.map((e: any) =>
          e.id === args.elementId ? { ...e, config: { ...e.config, [args.key]: args.value } } : e
        ));
        break;
      case "set_margins":
        if (args.margins) setPageMargins(args.margins);
        break;
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
    }
  }, []);

  // ── UI ────────────────────────────────────────────────
  return (
    <AgentProvider buildContext={buildContext} onToolCall={handleToolCall}>
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部导航栏 */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {chatCollapsed && (
            <button
              onClick={() => setChatCollapsed(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={loc("chat.expand")}
              aria-label={loc("chat.expand")}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-base font-semibold">{loc("app.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* 语言切换 */}
          <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border transition-all">
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === "zh" ? "EN" : "中文"}</span>
          </button>
          {/* 主题切换 */}
          <button onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border transition-all" title={loc("theme.toggle")} aria-label={loc("theme.toggle")}>
            {theme === "dark" ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        <ThreePanelLayout
          left={
            <ChatPanel onToggle={() => setChatCollapsed((prev) => !prev)} loc={loc} />
          }
          leftCollapsed={chatCollapsed}
          middle={
            <div className="h-full overflow-y-auto p-4 space-y-6">
              {/* 上传区域 */}
              <div className="rounded-xl bg-card ring-1 ring-foreground/10 p-4">

            <h3 className="font-heading text-base leading-snug font-medium mb-4">{loc("input.title")}</h3>
            {/* 模式切换 */}
            <div className="flex gap-2 mb-4">
              <Button variant={inputMode === "file" ? "default" : "outline"} size="sm" onClick={() => setInputMode("file")}>
                <FileUp className="w-4 h-4 mr-1" />{loc("input.file")}
              </Button>
              <Button variant={inputMode === "text" ? "default" : "outline"} size="sm" onClick={() => setInputMode("text")}>
                <Type className="w-4 h-4 mr-1" />{loc("input.text")}
              </Button>
            </div>

            {inputMode === "file" ? (
              <div
                className={`border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 p-8 text-center ${
                  fileDragOver
                    ? "border-primary bg-primary/8 shadow-sm dropzone-active"
                    : file
                      ? "border-primary/40 bg-primary/4 hover:bg-primary/6"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setFileDragOver(true); }}
                onDragEnter={(e) => { e.preventDefault(); setFileDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setFileDragOver(false); }}
                onDrop={onDropFile}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground truncate max-w-[280px]">{file.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setFile(null); setPreviewData(null); }}>{loc("input.reselect")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground">{loc("input.drag_hint")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{loc("input.drag_support")}</p>
                    </div>
                    <label className="cursor-pointer inline-flex items-center justify-center rounded-lg text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors h-9 px-4 shadow-sm">
                      {loc("input.browse")}
                      <input type="file" accept=".docx" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setInputMode("file"); } }} />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{loc("input.text_hint")}</p>
                  {textContent.trim() && (
                    <p className="text-xs text-muted-foreground">{textContent.trim().split("\n").filter(Boolean).length} {loc("input.paragraphs")}</p>
                  )}
                </div>
                <Textarea
                  value={textContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTextContent(e.target.value)}
                  placeholder={`${loc("input.text_placeholder")}\n${loc("input.text_example")}`}
                  className="min-h-[200px] resize-y focus-visible:ring-1"
                />
              </div>
            )}
              </div>

              <Separator />

              {/* 设置区域 */}
              <div className="rounded-xl bg-card ring-1 ring-foreground/10 p-4 space-y-6">
          <div className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-base leading-snug font-medium">{loc("settings.title")}</h3>
              <span className="w-px h-4 bg-border/50" />
              <button type="button" onClick={undo} disabled={historyIdx <= 0}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title={loc("undo.title")} aria-label={loc("undo.title")}>
                <Undo2 className="w-4 h-4" />
              </button>
              <button type="button" onClick={redo} disabled={historyIdx >= history.length - 1}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title={loc("redo.title")} aria-label={loc("redo.title")}>
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input value={savePresetName} onChange={(e) => setSavePresetName(e.target.value)}
                placeholder={loc("settings.preset_name")} className="h-8 w-28 text-xs"
                onKeyDown={(e) => e.key === "Enter" && saveCurrentAsPreset()} />
              <Button variant="outline" size="sm" className="h-8" onClick={saveCurrentAsPreset}>
                <Save className="w-3.5 h-3.5 mr-1" />{loc("settings.save_preset")}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetElements}>{loc("settings.reset")}</Button>
              {/* 导入/导出 */}
              {userPresets.length > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                  const blob = new Blob([JSON.stringify(userPresets, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "doc-format-presets.json"; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-3.5 h-3.5 mr-1" />{loc("preset.export")}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                const input = document.createElement("input");
                input.type = "file"; input.accept = ".json";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  try {
                    const raw = await file.text();
                    const presets = JSON.parse(raw);
                    if (!Array.isArray(presets)) throw new Error();
                    setUserPresets((prev) => {
                      const ids = new Set(prev.map((p) => p.id));
                      return [...prev, ...presets.filter((p: any) => p.id && p.label && !ids.has(p.id))];
                    });
                    setError(loc("preset.import_ok"));
                    setTimeout(() => clearError(), 2000);
                  } catch { setError(loc("preset.import_bad")); }
                };
                input.click();
              }}>
                <FileUp className="w-3.5 h-3.5 mr-1" />{loc("preset.import")}
              </Button>
            </div>
          </div>
            <div className="flex rounded-xl bg-muted p-1 w-fit" role="radiogroup">
              <button role="radio" aria-checked={mode === "preset"} onClick={() => setMode("preset")}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all duration-150 ${mode === "preset" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {loc("settings.preset")}
              </button>
              <button role="radio" aria-checked={mode === "custom"} onClick={() => setMode("custom")}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all duration-150 ${mode === "custom" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {loc("settings.custom")}
              </button>
            </div>

            {mode === "preset" && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs text-muted-foreground">{loc("settings.builtin")}</p>
                    <span className="text-muted-foreground/40 cursor-help text-[11px]" title={loc("settings.preset_hint")}>ⓘ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(BUILTIN_PRESETS).map(([key, p]) => (
                      <button key={key} onClick={() => applyPreset(key)}
                        className={`relative text-left p-3 rounded-xl border transition-all duration-150 ${
                          preset === key
                            ? "border-primary/40 bg-primary/[0.04] shadow-sm"
                            : "border-border hover:border-primary/20 hover:bg-muted/30"
                        }`}>
                        <p className="text-sm font-medium text-foreground">{loc("preset." + key)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {(() => {
                            const t = p.elementConfigs?.title?.font;
                            const b = p.elementConfigs?.body?.font;
                            return t && b && t !== b ? `${t} / ${b}` : (t || b || "");
                          })()}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                {userPresets.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">{loc("settings.my_presets")}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {userPresets.map((up) => (
                        <div key={up.id} className="relative group">
                          {editingPresetId === up.id ? (
                            <Input className="h-9 text-sm" autoFocus defaultValue={up.label}
                              onBlur={(e) => commitRenamePreset(up.id, e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") commitRenamePreset(up.id, e.currentTarget.value); if (e.key === "Escape") setEditingPresetId(null); }} />
                          ) : (
                            <button onClick={() => applyPreset(up.id)}
                              className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-2 ${
                                preset === up.id
                                  ? "border-primary/40 bg-primary/[0.04] shadow-sm"
                                  : "border-border hover:border-primary/20 hover:bg-muted/30"
                              }`}>
                              <span className="text-sm font-medium truncate">{up.label}</span>
                              <span className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <span className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary cursor-pointer" onClick={() => startRenamePreset(up.id)} title={loc("elem.rename")} aria-label={loc("elem.rename")}><Pencil className="w-3 h-3" /></span>
                                <span className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer" onClick={() => deleteUserPreset(up.id)} title={loc("elem.delete")} aria-label={loc("elem.delete")}><Trash2 className="w-3 h-3" /></span>
                              </span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* 标题层级 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-primary/40" />
                <h3 className="text-sm font-semibold text-foreground">{loc("elem.title")}</h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                  onClick={() => { setShowAddForm("heading"); setNewLabel(""); setNewStyles(""); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" />{loc("elem.add_heading")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{loc("heading.hint")}</p>
              {selectedIds.size >= 2 && headingElements.some((e) => selectedIds.has(e.id)) && (
                <div className="mb-2"><BatchToolbar selectedIds={selectedIds} elements={elements} onApply={batchApply} onClear={clearSelection} allFonts={allFonts} loc={loc} /></div>
              )}
              <div className="space-y-2">
                {(() => {
                  const levelOf = (el: ElementDef): number => {
                    const styles = el.wordStyles.map(s => s.toLowerCase());
                    if (styles.some(s => s.includes("heading 1") || s.includes("标题 1") || s === "title")) return 1;
                    if (styles.some(s => s.includes("heading 2") || s.includes("标题 2") || s === "subtitle")) return 2;
                    return 3;
                  };
                  const sorted = [...headingElements].sort((a, b) => levelOf(a) - levelOf(b));
                  return sorted.map((el) => {
                    const level = levelOf(el);
                    return (
                    <div key={el.id} style={{ marginLeft: `${(level - 1) * 24}px` }}>
                      <ElementPanel element={el} isSelected={selectedIds.has(el.id)} onToggleSelect={toggleSelect}
                        onConfigChange={updateElementConfig} onMetaChange={updateElementMeta}
                        onCopy={copyElement} onDelete={removeElement} canDelete={elements.length > 1}
                        onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                        onDrop={handleDrop} draggedId={draggedId} dragOverId={dragOverId} allFonts={allFonts} loc={loc} />
                    </div>
                    );
                  });
                })()}
                {headingElements.length === 0 && <p className="text-xs text-muted-foreground py-2">{loc("elem.no_headings")}</p>}
              </div>
            </div>

            <Separator />

            {/* 正文类 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-primary/20" />
                <h3 className="text-sm font-semibold text-foreground">{loc("elem.body")}</h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                  onClick={() => { setShowAddForm("body"); setNewLabel(""); setNewStyles(""); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" />{loc("elem.add_body")}
                </Button>
              </div>
              {selectedIds.size >= 2 && bodyElements.some((e) => selectedIds.has(e.id)) && (
                <div className="mb-2"><BatchToolbar selectedIds={selectedIds} elements={elements} onApply={batchApply} onClear={clearSelection} allFonts={allFonts} loc={loc} /></div>
              )}
              <div className="space-y-2">
                {bodyElements.map((el) => (
                  <ElementPanel key={el.id} element={el} isSelected={selectedIds.has(el.id)} onToggleSelect={toggleSelect}
                    onConfigChange={updateElementConfig} onMetaChange={updateElementMeta}
                    onCopy={copyElement} onDelete={removeElement} canDelete={elements.length > 1}
                    onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                    onDrop={handleDrop} draggedId={draggedId} dragOverId={dragOverId} allFonts={allFonts} loc={loc} />
                ))}
                {bodyElements.length === 0 && <p className="text-xs text-muted-foreground py-2">{loc("elem.no_bodies")}</p>}
              </div>
            </div>

            {/* 添加内联表单 */}
            {showAddForm && (
              <div className="rounded-xl border bg-muted/30 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 rounded-full bg-primary/30" />
                  <p className="text-sm font-medium text-foreground">{loc(showAddForm === "heading" ? "elem.add_title" : "elem.add_body_title")}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div><label className="text-xs text-muted-foreground mb-1.5 block">{loc("elem.name")}</label>
                    <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                      placeholder={showAddForm === "heading" ? loc("elem.placeholder_label") : loc("elem.placeholder_label_body")} className="h-9" /></div>
                  <div><label className="text-xs text-muted-foreground mb-1.5 block">{loc("elem.style_name")} <span className="text-muted-foreground/50 cursor-help text-[11px]" title={loc("elem.style_hint")}>ⓘ</span></label>
                    <Input value={newStyles} onChange={(e) => setNewStyles(e.target.value)}
                      placeholder={showAddForm === "heading" ? loc("elem.placeholder_style") : loc("elem.placeholder_style_body")} className="h-9" /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addElement}><Check className="w-3.5 h-3.5 mr-1" />{loc("elem.confirm")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddForm(null)}>{loc("elem.cancel")}</Button>
                </div>
              </div>
            )}

            {/* 页面边距 */}
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-border" />
                <p className="text-sm font-medium text-foreground">{loc("margin.title")}</p>
                <span className="text-xs text-muted-foreground ml-auto">{loc("margin.unit")}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["margin.top","margin.bottom","margin.left","margin.right"] as const).map((mk, i) => {
                  const mKey = ["margin_top","margin_bottom","margin_left","margin_right"][i] as keyof typeof pageMargins;
                  return (
                  <div key={mKey}><label className="text-xs text-muted-foreground mb-1.5 block">{loc(mk)}</label>
                    <Input type="number" min="0" max="10" step="0.1" value={pageMargins[mKey]}
                      onChange={(e) => setPageMargins((p) => ({ ...p, [mKey]: e.target.value }))} /></div>
                  );
                })}
              </div>
            </div>

            {/* 页眉 / 页码 */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-border" />
                <p className="text-sm font-medium text-foreground">{loc("header.title")}</p>
              </div>
              {/* 页眉文字 */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={headerConfig.showHeader}
                    onChange={(e) => setHeaderConfig((p) => ({ ...p, showHeader: e.target.checked, useChapterHeader: false }))}
                    className="w-4 h-4 rounded border-border cursor-pointer" />
                  {loc("header.show_header")}
                </label>
                {headerConfig.showHeader && (
                  <div className="ml-6 space-y-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground">
                      <input type="checkbox" checked={headerConfig.useChapterHeader}
                        onChange={(e) => setHeaderConfig((p) => ({ ...p, useChapterHeader: e.target.checked }))}
                        className="w-3.5 h-3.5 rounded border-border cursor-pointer" />
                      {loc("header.use_chapter")}
                    </label>
                    {!headerConfig.useChapterHeader ? (
                      <Input value={headerConfig.text} onChange={(e) => setHeaderConfig((p) => ({ ...p, text: e.target.value }))}
                        placeholder={loc("header.text_placeholder")} className="h-8 text-xs w-full" />
                    ) : (
                      <p className="text-xs text-muted-foreground/70 leading-relaxed px-1">{loc("header.chapter_hint")}</p>
                    )}
                  </div>
                )}
              </div>
              {/* 页码 */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={headerConfig.showPageNumber}
                    onChange={(e) => setHeaderConfig((p) => ({ ...p, showPageNumber: e.target.checked }))}
                    className="w-4 h-4 rounded border-border cursor-pointer" />
                  {loc("header.show_page_number")}
                </label>
                <Select value={headerConfig.pageNumberAlign}
                  onValueChange={(v) => v && setHeaderConfig((p) => ({ ...p, pageNumberAlign: v as "left" | "center" | "right" }))}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["left", "center", "right"] as const).map((a) => (
                      <SelectItem key={a} value={a}>{loc("config.align_" + a)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 自定义字体 */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-border" />
                <p className="text-sm font-medium text-foreground">{loc("font.custom")}</p>
              </div>
              <p className="text-xs text-muted-foreground">{loc("font.hint")}</p>
              <div className="flex gap-2">
                <Input value={fontInput} onChange={(e) => setFontInput(e.target.value)}
                  placeholder={loc("font.placeholder")} className="h-8 text-xs flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && fontInput.trim()) { setCustomFonts((p) => [...p, fontInput.trim()]); setFontInput(""); } }} />
                <Button size="sm" variant="outline" className="h-8"
                  onClick={() => { if (fontInput.trim()) { setCustomFonts((p) => [...p, fontInput.trim()]); setFontInput(""); } }}>
                  <Plus className="w-3.5 h-3.5 mr-1" />{loc("font.add")}
                </Button>
              </div>
              {customFonts.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {customFonts.map((f, i) => (
                    <span key={f} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted border border-border/50">
                      {f}
                      <button onClick={() => setCustomFonts((p) => p.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60">{loc("font.empty")}</p>
              )}
            </div>
              </div>
            </div>
          }
          right={
            <div className="h-full overflow-y-auto p-4 space-y-6">
              <PreviewSection elements={elements} docParagraphs={previewData} loading={previewLoading} headerConfig={headerConfig} loc={loc} />

              <div className="flex flex-col items-center gap-5 py-4">
                {loading ? (
                  <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {loc("submit.progress")}
                    </div>
                  </div>
                ) : (
                <Button size="lg" disabled={loading || (inputMode === "file" && !file) || (inputMode === "text" && !textContent.trim())}
                  onClick={handleSubmit} className="min-w-[220px] shadow-sm" title={loc("submit.tooltip")}>
                  <FileText className="w-4 h-4 mr-2" />
                  {loc("submit.format")}
                </Button>
                )}
                {error && (
                  <div className="flex items-start gap-3 bg-destructive/10 dark:bg-destructive/15 text-destructive text-sm rounded-lg border border-destructive/20 dark:border-destructive/30 p-3 w-full max-w-md mx-auto" role="alert">
                    <div className="flex-1 space-y-1">
                      <p className="leading-relaxed">{error}</p>
                      {errorSuggestion && <p className="text-xs text-destructive/70 leading-relaxed">{errorSuggestion}</p>}
                      <button onClick={handleSubmit} className="text-xs font-medium text-destructive underline underline-offset-2 hover:text-destructive/80 transition-colors">
                        {loc("submit.retry")}
                      </button>
                    </div>
                    <button onClick={clearError} className="p-0.5 rounded hover:bg-destructive/10 shrink-0 mt-0.5 transition-colors" aria-label={loc("error.close")}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {resultUrl && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500">
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 4.5a.5.5 0 0 1 1 0v4.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7 9.293V4.5z"/></svg>
                      {loc("submit.complete")}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value={downloadFilename} onChange={(e) => setDownloadFilename(e.target.value)}
                        className="w-36 h-9 text-sm" placeholder={loc("submit.filename")} />
                      <span className="text-sm text-muted-foreground">.docx</span>
                    </div>
                    <a href={resultUrl} download={`${downloadFilename || "formatted"}.docx`}>
                      <Button size="lg" className="shadow-sm"><Download className="w-4 h-4 mr-2" />{loc("submit.download")}</Button>
                    </a>
                  </div>
                )}
              </div>
            </div>
          }
        />
      </div>

    </div>
    </AgentProvider>
  );
}
