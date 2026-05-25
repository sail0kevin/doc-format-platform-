"use client";

import { useState, useEffect, useCallback } from "react";

export type Lang = "zh" | "en";

const LANG_KEY = "doc-format-lang";

const translations: Record<string, Record<Lang, string>> = {
  // ── App header ──
  "app.title": { zh: "文档格式化", en: "Document Formatter" },
  "app.subtitle": { zh: "上传 .docx 或直接输入文字，选择预设模板或自定义格式，一键生成成品文档", en: "Upload .docx or type text, choose a preset or custom format, generate a polished document in one click" },
  "app.lang.zh": { zh: "中文", en: "Chinese" },
  "app.lang.en": { zh: "English", en: "English" },

  // ── Tabs ──
  "tab.upload": { zh: "上传文件", en: "Upload" },
  "tab.settings": { zh: "格式设置", en: "Settings" },
  "tab.preview": { zh: "预览下载", en: "Preview" },

  // ── Upload tab ──
  "input.title": { zh: "选择输入方式", en: "Input Method" },
  "input.file": { zh: "文件上传", en: "File Upload" },
  "input.text": { zh: "文字输入", en: "Text Input" },
  "input.drag_hint": { zh: "拖拽 docx 文件到此处", en: "Drag a .docx file here" },
  "input.drag_support": { zh: "支持 .docx 格式，自动识别段落结构", en: "Supports .docx format, auto-detects paragraph structure" },
  "input.browse": { zh: "浏览文件", en: "Browse Files" },
  "input.reselect": { zh: "重新选择", en: "Re-select" },
  "input.text_hint": { zh: "每行一个段落，空行自动忽略", en: "One paragraph per line, blank lines ignored" },
  "input.text_placeholder": { zh: "输入文字内容，每行一个段落…", en: "Type your text, one paragraph per line…" },
  "input.text_example": { zh: "例如：\n第一章 概述\n这是正文内容，将会用正文格式进行排版。\n第二章 方法\n本章详细介绍研究方法与步骤。", en: "e.g.:\nChapter 1 Introduction\nThis is body text that will be formatted.\nChapter 2 Method\nThis chapter details the research methods." },
  "input.paragraphs": { zh: "个段落", en: "paragraphs" },

  // ── Settings tab ──
  "settings.title": { zh: "格式设置", en: "Format Settings" },
  "settings.preset": { zh: "预设模板", en: "Presets" },
  "settings.custom": { zh: "自定义", en: "Custom" },
  "settings.builtin": { zh: "内置模板", en: "Built-in Templates" },
  "settings.my_presets": { zh: "我的模板", en: "My Presets" },
  "settings.preset_name": { zh: "模板名称", en: "Preset Name" },
  "settings.save_preset": { zh: "保存模板", en: "Save Preset" },
  "settings.reset": { zh: "重置默认", en: "Reset Defaults" },
  "settings.preset_hint": { zh: "预设模板包含完整的字体/字号/间距/颜色配置，一键套用", en: "Presets include complete font/size/spacing/color configs, apply in one click" },

  // ── Element headings ──
  "elem.title": { zh: "标题层级", en: "Heading Levels" },
  "elem.body": { zh: "正文类元素", en: "Body Elements" },
  "elem.add_heading": { zh: "添加标题", en: "Add Heading" },
  "elem.add_body": { zh: "添加正文", en: "Add Body" },
  "elem.add_title": { zh: "添加标题类元素", en: "Add Heading Element" },
  "elem.add_body_title": { zh: "添加正文类元素", en: "Add Body Element" },
  "elem.name": { zh: "元素名称", en: "Element Name" },
  "elem.style_name": { zh: "Word 段落样式名", en: "Word Style Name" },
  "elem.style_hint": { zh: "Word 文档中的样式名称，多个用逗号分隔", en: "Word style names, comma-separated" },
  "elem.copy": { zh: "复制", en: "Copy" },
  "elem.delete": { zh: "删除", en: "Delete" },
  "elem.confirm_delete": { zh: "确定删除「{label}」元素吗？", en: "Delete「{label}」element?" },
  "elem.at_least_one": { zh: "至少需要保留一个文档元素", en: "At least one element is required" },
  "elem.no_headings": { zh: "暂无标题元素", en: "No heading elements" },
  "elem.no_bodies": { zh: "暂无正文类元素", en: "No body elements" },
  "elem.confirm": { zh: "确认", en: "Confirm" },
  "elem.cancel": { zh: "取消", en: "Cancel" },

  // ── Element config fields ──
  "config.font": { zh: "字体", en: "Font" },
  "config.size": { zh: "字号", en: "Size" },
  "config.color": { zh: "颜色", en: "Color" },
  "config.align": { zh: "对齐方式", en: "Alignment" },
  "config.bold": { zh: "加粗", en: "Bold" },
  "config.line_spacing": { zh: "行间距", en: "Line Spacing" },
  "config.space_before": { zh: "段前间距", en: "Space Before" },
  "config.space_after": { zh: "段后间距", en: "Space After" },
  "config.indent": { zh: "首行缩进", en: "First Line Indent" },
  "config.align_left": { zh: "左对齐", en: "Left" },
  "config.align_center": { zh: "居中", en: "Center" },
  "config.align_right": { zh: "右对齐", en: "Right" },
  "config.align_justify": { zh: "两端对齐", en: "Justify" },
  "config.bold_yes": { zh: "加粗", en: "Bold" },
  "config.bold_no": { zh: "正常", en: "Normal" },

  // ── Batch toolbar ──
  "batch.selected": { zh: "已选 {n} 项", en: "{n} selected" },

  // ── Preview ──
  "preview.title": { zh: "格式预览", en: "Preview" },
  "preview.empty": { zh: "上传文档后在此查看格式预览效果", en: "Upload a document to see the preview" },
  "preview.empty_hint": { zh: "或在上方添加文档元素查看示例文字", en: "Or add elements above to see sample text" },
  "preview.example": { zh: "预览示例", en: "Sample Preview" },
  "preview.example_desc": { zh: "上传文档后显示实际段落内容", en: "Shows actual paragraphs after uploading" },

  // ── Submit / Download ──
  "submit.format": { zh: "开始格式化", en: "Format Now" },
  "submit.progress": { zh: "正在格式化文档...", en: "Formatting document..." },
  "submit.download": { zh: "下载成品", en: "Download" },
  "submit.complete": { zh: "格式化完成", en: "Complete" },
  "submit.retry": { zh: "重试", en: "Retry" },
  "submit.filename": { zh: "文件名", en: "File Name" },
  "submit.ready": { zh: "请上传文档或输入文字", en: "Please upload or type text" },
  "submit.tooltip": { zh: "按当前配置格式化文档，生成可下载的 docx 文件", en: "Format the document and generate a downloadable .docx file" },

  // ── Errors ──
  "error.network": { zh: "网络连接失败，请检查网络后重试", en: "Network error. Please check your connection and retry." },
  "error.server": { zh: "服务器处理出错，请稍后重试", en: "Server error. Please try again later." },
  "error.payload": { zh: "文档过大，无法处理", en: "Document too large to process." },
  "error.conflict": { zh: "样式映射冲突", en: "Style mapping conflict." },
  "error.unknown": { zh: "格式化失败，未知错误", en: "Formatting failed due to an unknown error." },
  "error.retry_hint_network": { zh: "请确认网络连接正常，然后点击下方重试按钮", en: "Please check your connection and click Retry below." },
  "error.retry_hint_server": { zh: "可以尝试：1) 稍后重试；2) 检查文档格式是否正确；3) 联系管理员", en: "Try: 1) Retry later; 2) Check document format; 3) Contact admin." },
  "error.retry_hint_payload": { zh: "请尝试缩小文档规模（建议不超过 50MB）", en: "Try a smaller document (under 50MB recommended)." },
  "error.retry_hint_style": { zh: "请检查「格式设置」标签页中的样式映射是否正确", en: "Check the style mappings in the Settings tab." },
  "error.retry_hint_generic": { zh: "请检查配置后重试，或联系管理员", en: "Check your config and retry, or contact admin." },
  "error.close": { zh: "关闭", en: "Close" },

  // ── Preset descriptions ──
  "preset.essay": { zh: "学术论文", en: "Academic Essay" },
  "preset.report": { zh: "商业报告", en: "Business Report" },
  "preset.official": { zh: "政府公文", en: "Official Document" },
  "preset.novel": { zh: "小说/散文", en: "Novel / Prose" },

  // ── Units ──
  "unit.lines": { zh: "行", en: "lines" },
  "unit.pt": { zh: "pt", en: "pt" },
  "unit.cm": { zh: "cm", en: "cm" },
  "unit.mm": { zh: "mm", en: "mm" },
  "unit.char": { zh: "字符", en: "char" },
  "unit.none": { zh: "无", en: "None" },
  "unit.times": { zh: "倍", en: "×" },

  // ── Badges ──
  "badge.h1": { zh: "H1", en: "H1" },
  "badge.h2": { zh: "H2", en: "H2" },
  "badge.h3": { zh: "H3", en: "H3" },
  "badge.body": { zh: "正文", en: "Body" },
  "elem.copy_suffix": { zh: "（副本）", en: " (Copy)" },
  "elem.rename": { zh: "重命名", en: "Rename" },
  "elem.placeholder_label": { zh: "如: 四级标题", en: "e.g. Subheading 4" },
  "elem.placeholder_label_body": { zh: "如: 引用块", en: "e.g. Blockquote" },
  "elem.placeholder_style": { zh: "如: Heading 6, 标题 6", en: "e.g. Heading 6, Subtitle" },
  "elem.placeholder_style_body": { zh: "如: Quote, 引用", en: "e.g. Quote, Block Text" },

  // ── Page margins ──
  "margin.title": { zh: "页面边距", en: "Page Margins" },
  "margin.unit": { zh: "单位: cm", en: "Unit: cm" },
  "margin.top": { zh: "上", en: "Top" },
  "margin.bottom": { zh: "下", en: "Bottom" },
  "margin.left": { zh: "左", en: "Left" },
  "margin.right": { zh: "右", en: "Right" },

  // ── Space presets ──
  "space.none": { zh: "无", en: "None" },
  "space.tiny": { zh: "极小", en: "Tiny" },
  "space.small": { zh: "小", en: "Small" },
  "space.medium": { zh: "中", en: "Medium" },
  "space.large": { zh: "大", en: "Large" },

  // ── Misc ──
  "undo.title": { zh: "撤销 (Ctrl+Z)", en: "Undo (Ctrl+Z)" },
  "redo.title": { zh: "重做 (Ctrl+Shift+Z)", en: "Redo (Ctrl+Shift+Z)" },
  "error.preset_name_missing": { zh: "请输入模板名称", en: "Please enter a preset name" },
  "error.element_name_missing": { zh: "请输入元素名称", en: "Please enter an element name" },
  "confirm.reset": { zh: "重置将恢复默认元素配置，确定继续吗？", en: "Reset will restore default elements. Continue?" },

  // ── Header / Footer ──
  "header.title": { zh: "页眉 / 页码", en: "Header / Page Number" },
  "header.show_header": { zh: "显示页眉", en: "Show Header" },
  "header.text_placeholder": { zh: "输入页眉文字…", en: "Header text…" },
  "header.show_page_number": { zh: "显示页码", en: "Show Page Number" },
  "header.use_chapter": { zh: "自动使用章节标题作为页眉", en: "Auto-use chapter title as header" },
  "header.chapter_hint": { zh: "页眉将自动使用文档中各章节的一级标题，目录页显示「目录」等。", en: "Header auto-matches each section's H1 title; e.g. TOC shows 'Contents'." },
  "heading.hint": { zh: "一级标题 → 二级标题 → 三级标题，依次嵌套", en: "H1 → H2 → H3, in nesting order" },

  // ── Document stats ──
  "stats.title": { zh: "文档统计", en: "Document Stats" },
  "stats.paragraphs": { zh: "段落", en: "Paragraphs" },
  "stats.chars": { zh: "字符", en: "Characters" },
  "stats.words": { zh: "估算字数", en: "Est. Words" },
  "stats.pages": { zh: "预估页数", en: "Est. Pages" },

  // ── Custom fonts ──
  "font.custom": { zh: "自定义字体", en: "Custom Fonts" },
  "font.add": { zh: "添加", en: "Add" },
  "font.placeholder": { zh: "输入字体名称…", en: "Type a font name…" },
  "font.empty": { zh: "暂无自定义字体", en: "No custom fonts yet" },
  "font.hint": { zh: "添加系统中已安装的字体，将显示在所有字体下拉列表中", en: "Add system-installed fonts to appear in all font selectors" },

  // ── Preset import/export ──
  "preset.export": { zh: "导出模板", en: "Export Presets" },
  "preset.import": { zh: "导入模板", en: "Import Presets" },
  "preset.export_all": { zh: "导出全部", en: "Export All" },
  "preset.import_file": { zh: "导入文件", en: "Import File" },
  "preset.import_ok": { zh: "模板导入成功", en: "Presets imported" },
  "preset.import_bad": { zh: "无效的模板文件", en: "Invalid preset file" },

  // ── Theme ──
  "theme.light": { zh: "亮色", en: "Light" },
  "theme.dark": { zh: "暗色", en: "Dark" },
  "theme.toggle": { zh: "切换主题", en: "Toggle theme" },

  // ── Preview header ──
  "preview.header": { zh: "页眉", en: "Header" },
  "preview.page": { zh: "页码", en: "Page" },

  // ── Chat Panel ──
  "chat.title": { zh: "AI 排版助手", en: "AI Format Assistant" },
  "chat.welcome": { zh: "你好！我是排版助手。告诉我你想怎么格式化文档，比如「排成学术论文格式」或「标题用黑体加粗」", en: "Hi! I'm your format assistant. Tell me how you'd like to format your document, e.g. \"Academic essay style\" or \"Bold headings\"" },
  "chat.placeholder": { zh: "输入排版需求…", en: "Describe your formatting…" },
  "chat.empty_hint": { zh: "输入排版需求，AI 帮你配置格式", en: "Describe your formatting needs, AI will configure it for you" },
  "chat.collapse": { zh: "折叠聊天面板", en: "Collapse chat panel" },
  "chat.expand": { zh: "展开聊天面板", en: "Expand chat panel" },
  "chat.input_aria": { zh: "聊天输入", en: "Chat input" },
  "chat.send_aria": { zh: "发送", en: "Send" },
  "chat.message_aria": { zh: "聊天消息", en: "Chat messages" },
  "chat.ai_response": { zh: "已解析你的排版需求，配置已更新到中间面板，你可以手动微调后点击格式化。", en: "I've parsed your formatting needs. The configuration has been updated in the middle panel. You can fine-tune it manually before formatting." },
};

export function t(key: string, lang: Lang, params?: Record<string, string>): string {
  let val = translations[key]?.[lang];
  if (!val) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replace(`{${k}}`, v);
    }
  }
  return val;
}

export function useLocale() {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved === "en" || saved === "zh") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch {}
  }, []);

  const loc = useCallback((key: string, params?: Record<string, string>) => {
    return t(key, lang, params);
  }, [lang]);

  return { lang, setLang, loc };
}
