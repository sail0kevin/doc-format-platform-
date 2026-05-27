# 开发日志

## 2026-05-22

### ReferenceError: loc is not defined

**现象：** 运行时 ElementPanel 组件抛出 `ReferenceError: loc is not defined`，页面白屏。

**错误原因：** 作用域问题。

在 `page.tsx` 中，`loc` 通过 `useLocale()` 钩子在 `Home` 组件内部解构：

```ts
const { lang, setLang, loc } = useLocale();
```

而 `BatchToolbar`、`ElementPanel`、`PreviewSection` 三个子组件是定义在 `Home` **外部**的独立函数组件。它们自身的函数作用域中不存在 `loc`。

将子组件 JSX 中的中文字符串（如 `"删除"`、`"字体"`、`"正文"` 等）批量替换为 `loc("elem.delete")`、`loc("config.font")`、`loc("badge.body")` 后，这些组件内部的 `loc()` 调用找不到定义，导致 ReferenceError。

**解决方案：** 将 `loc` 作为 prop 传入子组件：

1. 在子组件的类型签名中添加 `loc` 参数：
   ```
   loc: (key: string, params?: Record<string, string>) => string;
   ```

2. 在 `Home` 中调用子组件时通过 prop 传递：
   ```tsx
   <BatchToolbar ... loc={loc} />
   <ElementPanel ... loc={loc} />
   <PreviewSection ... loc={loc} />
   ```

**涉及的组件：**
- `BatchToolbar`（行 434）— 批量编辑工具栏
- `ElementPanel`（行 488）— 单个文档元素编辑面板
- `PreviewSection`（行 622）— 格式预览区域

**教训：**
- 重构 i18n 时，不能只替换 JSX 中的字符串字面量，必须确保目标作用域中存在 `loc` 函数。
- 对于 `Home` 外部定义的子组件，需要通过 prop 显式传入 `loc`；`Home` 内部的闭包（如 `showError`）则天然可以访问到。

---

## 2026-05-26 ~ 2026-05-27

### 模型切换：MiMo-V2.5

从 DeepSeek V4 Flash 切换到 MiMo-V2.5，响应时间从 36~58s 降到 4.5s。

配置 (`.env.local`)：
```
LLM_PROVIDER=openai
OPENAI_API_KEY=tp-c6qpgf0g608fp1yjjxetbc6b0op43o6mh90lzyjdit8wrims
OPENAI_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
OPENAI_MODEL=mimo-v2.5
```

### 文字协议回退

MiMo 不支持原生 tool_calls，添加了从模型回复文本中提取 JSON 工具调用的回退机制：
- `extractToolCallsFromText()` — 正则提取 `{"name":"...","arguments":{...}}` 格式
- `stripToolCallsFromText()` — 从回复中移除工具调用 JSON，保留纯文字

### Agent 人设："小排"

系统提示词改为专业排版助手"小排"，具备：
- 分析文档结构、配置格式的专业能力
- 明确的行动准则（"不要只回复'好的我已了解'然后不做事"）
- 工具调用 JSON 格式说明（兼容文字协议）

### 工具集扩展（共12个）

新增工具：
- `cleanup_elements` — 清理未使用的元素
- `update_label` — 修改元素名称
- `set_paragraph_style` — 修改段落样式类型
- `update_header` — 控制页眉/页码设置
- `set_margins` — 调整页边距

### 预览界面优化

- WPS/Excel 风格白色 A4 纸张 + 阴影
- 左侧彩色侧边条标记元素类型（一级标题/二级标题/三级标题/正文）
- 点击左侧标签可弹出下拉菜单切换段落类型
- 标题检测优化：`^\d+\.\d+` 识别为三级标题

### 文件处理

- 安装 mammoth.js，上传 .docx 后自动提取文字给 Agent 上下文
- "另存为"功能：使用 File System Access API 让用户选择保存位置
- 文件命名输入：格式化前可先给输出文件命名

### Bug 修复

- **重复 key**：Agent 创建元素时 ID 加随机后缀
- **Python bold 报错**：字符串 "true"/"false" 转布尔值
- **兜底消息**：从"操作完成"改为"收到，正在处理…"
