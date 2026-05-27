# 文档格式化平台 — 开发报告

> 日期: 2026-05-20
> 目标: 构建一个 Web 平台，用户上传 docx 文档，选择或自定义格式，一键输出格式化后的文档

---

## 一、项目架构

```
[浏览器] ←→ [Next.js 前端] ←→ [POST /api/format] ←→ [Python 引擎]
                │                      │                      │
           Tailwind + shadcn      spawn + stdin         python-docx
```

| 层 | 技术 | 文件 |
|---|------|------|
| 前端 | Next.js 16 + Tailwind v4 + shadcn/ui | `src/app/page.tsx` |
| API | Next.js Route Handler, child_process.spawn | `src/app/api/format/route.ts` |
| 引擎 | Python 3.13 + python-docx 1.2.0 | `engine/doc_format_agent.py` |

---

## 二、功能清单

- [x] 拖拽/浏览上传 docx 文件
- [x] 预设模板（学术论文 / 商业报告 / 政府公文 / 小说散文）
- [x] 自定义格式（字体、字号、行间距、首行缩进、对齐方式）
- [x] 一键格式化下载

---

## 三、踩坑记录（7 个错误 → 全部修复）

### 错误 1: GBK 编码 — Python print 特殊字符崩溃

**现象:**
```
UnicodeEncodeError: 'gbk' codec can't encode character '✓'
```

**原因:** Windows 中文系统默认 GBK 编码，Python `print("✓")` 等 Unicode 符号无法编码。

**修复:** 将所有 `✓` → `[OK]`，`✗` → `[ERR]`，`─` → `-`。并添加 `sys.stdout.reconfigure(encoding='utf-8', errors='replace')`。

---

### 错误 2: Windows 命令行传中文参数被 GBK 破坏

**现象:**
```
Cannot convert argument to a ByteString because the character at index 22
has a value of 38754 which is greater than 255
```

**原因:** Node.js `execFile` 在 Windows 上通过命令行传参时，对非 ASCII 字符（如"微软雅黑"）做 ANSI 编码转换，中文被破坏。

**修复:** 放弃命令行传参，改用 **stdin 管道** 传 JSON 数据，绕过命令行编码层。

---

### 错误 3: Python print 输出到管道仍报错

**现象:**
```
UnicodeEncodeError: 'utf-8' codec can't encode character '\udca4': surrogates not allowed
```

**原因:** Node.js spawn 后的 stdout 管道中，`sys.stdout.reconfigure(encoding='utf-8')` 遇到 surrogate 字符仍会报错。

**修复:** API 路径上删除所有 `print()` 调用，使用 `--quiet` 静默模式。`sys.stdout = open(os.devnull, "w", encoding="utf-8", errors="replace")` 兜底。

---

### 错误 4: 上传文件名中文被损坏

**现象:**
```
PackageNotFoundError: Package not found at '...面试准\udca4_完整\udc88.docx'
```

**原因:** 文件原始名称"面试准备_完整版.docx"在 stdin JSON 传输过程中编码错乱，保存的临时文件名已损坏，导致 Python 找不到文件。

**修复:** API 路由中临时文件名改为纯英文 UUID（如 `77bedefb_input.docx`），不再使用原始文件名。

---

### 错误 5: Python stdin 读 JSON 编码错误

**现象:**
```
UnicodeEncodeError: 'utf-8' codec can't encode character '\udcae': surrogates not allowed
```
发生在设置字体名时。

**原因:** `sys.stdin.read()` 使用默认编码（GBK），Node.js 通过 stdin 写入的 UTF-8 JSON 被错误解释，中文出现 surrogate 字符。

**修复:**
- 添加 `sys.stdin.reconfigure(encoding='utf-8')`
- 改用 `sys.stdin.buffer.read().decode("utf-8")` 读原始字节后显式解码

---

### 错误 6: shadcn/ui API 不兼容

**现象:**
```
Property 'asChild' does not exist on type 'IntrinsicAttributes & ButtonProps'
Type 'string | null' is not assignable to type 'SetStateAction<string>'
```

**原因:** shadcn/ui v4 的 Button 不再支持 `asChild`，Select 的 `onValueChange` 签名变为 `(value: string | null) => void`。

**修复:**
- `asChild` 改为原始 HTML label + 按钮样式
- `onValueChange={setFont}` → `onValueChange={(v: string | null) => v && setFont(v)}`

---

### 错误 7: 软链接在 Windows Git Bash 下不生效

**现象:** `ln -s` 创建的不是真正的 symlink，而是拷贝。

**原因:** Windows Git Bash 的 `ln -s` 在权限不足时回退为复制。

**修复:** 使用 PowerShell 的 `New-Item -Type Junction` 创建 Windows 原生的目录联结（Junction），不需要管理员权限。

---

## 四、v2.0 升级 — 分层格式化引擎

> 日期: 2026-05-20  
> 目标: 将单一格式配置升级为分层结构，支持文档各级元素的独立设置

### 架构变化

**v1.0**: 5 个通用选项（字体/字号/行距/缩进/对齐），全文统一应用  
**v2.0**: 4 个文档元素 × 各自独立设置 + 页面边距

```
配置结构 (v2.0):
{
  elements: {
    title:    { font, size, bold, align, color, line_spacing, space_before, space_after },
    subtitle: { font, size, bold, align, color, line_spacing, space_before, space_after },
    heading:  { font, size, bold, align, color, line_spacing, space_before, space_after },
    body:     { font, size, bold, align, color, line_spacing, space_before, space_after, first_line_indent }
  },
  page: { margin_top, margin_bottom, margin_left, margin_right }
}
```

### 段落识别机制

Python 引擎通过 Word 段落样式名自动识别元素类型：

| Word 样式 | 映射类型 | 中文样式名 |
|-----------|---------|------------|
| Heading 1 | title | 标题 1 |
| Heading 2 | subtitle | 标题 2 |
| Heading 3-5 | heading | 标题 3-5 |
| Normal | body | 正文 |

### 前端改造

- `ElementPanel` 子组件：每个元素类型一个可折叠面板
- 每个面板包含：字体/字号/颜色/粗体/对齐/行距/段前距/段后距
- body 面板额外包含：首行缩进
- 页面边距独立区域：上/下/左/右
- 预设模板已更新为分层配置（学术论文/商业报告/政府公文/小说散文）

### 验证结果

创建含 Heading 1-5 + Normal 的测试文档，API 格式化后检查输出：
- 页面边距: 2.5cm / 2.5cm / 3.0cm / 3.0cm ✓
- Title (Heading 1): 黑体 26pt bold center, line_sp=1.5 ✓
- Subtitle (Heading 2): 微软雅黑 18pt center ✓
- Heading (Heading 3-5): 黑体 16pt bold left ✓
- Body (Normal): 楷体 14pt justify, indent=0.74cm, line_sp=2.0 ✓
- API 返回 200，文件大小正常 ✓

---

## 五、v2.1 升级 — 4 项体验增强

> 日期: 2026-05-20

### 5.1 中文字号体系
- 前端新增 `CN_SIZES` 常量（初号~八号→pt 映射）
- `SizeSelect` 组件：下拉显示 `二号 (22pt)` 等中文名+pt 值
- 底层存储不变，始终存 pt 字符串
- `ptToCn()` 反向查询当前 pt 对应的中文名

### 5.2 间距单位可选
- `SpacingField` 子组件：每个间距输入框旁加单位下拉
- 段前距/段后距：pt / cm / mm
- 首行缩进：cm / mm / 字符
- 存储层始终用 pt/cm，提交前 `unitToPt`/`unitToCm` 转换
- UI 展示时 `ptToUnit`/`cmToUnit` 反向转换

### 5.3 文档原文预览
- 新增 `POST /api/preview` 端点
- Python `--preview` 模式：读取 docx 段落，返回 `[{text, style, element, index}]` JSON
- 前端上传文件后自动调用 `/api/preview`
- 预览区显示实际段落文本（最多 60 段），左侧样式标签+元素标签，右侧格式渲染
- **正文段落自动合并**：相邻 body 类型段落合并显示，标签显示 `正文 ×3`
- 无文件时退化为示例文字预览

### 5.4 文字输入转 Word
- 上传 Card 顶部模式切换：`文件上传 | 文字输入`
- 文字模式：textarea 输入，每行一个段落
- API `POST /api/format` 接收 `text` 字段替代 `file`
- Python `--text` 模式：`create_doc_from_text()` → 每行一个 Normal 段落 → 格式化
- 下载返回标准 docx

### 5.5 UI 交互增强 (v2.0 已有)
- 动态元素管理（增删/拖拽排序/复制/批量编辑）
- 自定义预设模板（保存/加载/重命名/删除）
- localStorage 自动保存/恢复
- RadioGroup 预设/自定义模式切换

---

## 六、已修复 Bug

### Bug 1: SSR Hydration Mismatch (2026-05-20)
**现象:** RadioGroup 预高亮错误项，控制台报 hydration error
**原因:** `useState` 初始值依赖 `localStorage`，SSR 时 `localStorage` 不可用 → 服务端默认 `"preset"`，客户端读到 `"custom"` → HTML 不一致
**修复:** 所有 localStorage 依赖的状态初始化为硬编码默认值，`useEffect` 首次挂载后 hydrate

### Bug 2: TypeScript 编译错误 ×6 (2026-05-20)
- 缺失 `@/components/ui/textarea` → 新建 Textarea 组件
- Select `onValueChange` 类型不匹配 (Base UI v5) → 添加 null 检查包装
- `textAlign` string 不能赋给 `TextAlign` → `as React.CSSProperties["textAlign"]`
- 隐式 any 参数 → 显式类型注解

---

## 七、项目当前结构

```
G:\projects\doc-format-platform\
├── src/app/
│   ├── page.tsx              ← 主页面（v2.1 全功能）
│   ├── api/format/route.ts   ← 格式化 API（支持 file + text）
│   ├── api/preview/route.ts  ← 文档预览 API（新增）
│   └── globals.css
├── src/components/ui/
│   ├── button.tsx, card.tsx, input.tsx, select.tsx
│   ├── radio-group.tsx, separator.tsx, slider.tsx
│   └── textarea.tsx          ← 新建
├── engine/
│   └── doc_format_agent.py   ← Python 引擎 v2.1 (+preview +text)
├── CLAUDE.md
├── DEV_REPORT.md             ← 本报告
└── package.json
```

## 六、安装的 Skill

| Skill | 用途 | 位置 |
|-------|------|------|
| LangChain Skills (12个) | Agent 开发（LangGraph、Deep Agents 等） | G:\aiAgent\skills\ |
| Impeccable | 前端 UI 设计 | G:\aiAgent\skills\ |
| Vercel React Best Practices | Next.js 性能优化 | G:\aiAgent\skills\ |
| Vercel Web Design Guidelines | 可访问性 + UX 规则 | G:\aiAgent\skills\ |

## 七、启动方式

```bash
cd G:\projects\doc-format-platform
npm run dev
# 需要 Node.js: G:\software\nodejs
```

打开 http://localhost:3000

---

## 八、v3.0 升级 — AI Agent 系统

> 日期: 2026-05-26 ~ 2026-05-27
> 目标: 集成 AI Agent，支持自然语言排版指令

### 架构

```
[用户] ←→ [ChatPanel] ←→ [AgentEngine (ReAct)] ←→ [MiMo-V2.5]
                              ↓
                         [12个工具] ←→ [Python 引擎]
```

### 模型配置

- **模型**: MiMo-V2.5（响应 ~4.5s，比 DeepSeek V4 Flash 快 8x）
- **API**: OpenAI 兼容接口
- **回退**: 文字协议提取 JSON 工具调用

### 工具集（12个）

| 工具 | 功能 |
|------|------|
| apply_preset | 切换预设模板 |
| add_element | 添加文档元素 |
| remove_element | 删除元素 |
| update_config | 修改元素样式 |
| update_header | 控制页眉/页码 |
| set_margins | 调整页边距 |
| update_label | 修改元素名称 |
| cleanup_elements | 清理未使用元素 |
| set_paragraph_style | 修改段落类型 |
| suggest_format | 建议格式 |
| undo / redo | 撤销/重做 |

### 预览增强

- WPS 风格白色 A4 纸张 + 阴影
- 左侧彩色侧边条标记元素类型
- 点击标签可切换段落类型
- 智能标题检测：中文数字=二级，小节数字=三级

### 文件处理

- mammoth.js 提取 .docx 文字给 Agent 上下文
- File System Access API 实现"另存为"
- 格式化前可自定义输出文件名

### Bug 修复

- 重复 key：Agent 元素 ID 加随机后缀
- Python bold：字符串转布尔值
- 兜底消息：改为"收到，正在处理…"
