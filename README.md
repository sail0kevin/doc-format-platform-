# Doc Format Platform — 文档格式化平台

AI 驱动的 Word 文档格式化工具。用自然语言描述排版需求，AI 助手自动配置格式并生成规范文档。

## 功能

### AI 排版助手

- **自然语言交互** — 告诉 AI "排成学术论文格式"，自动完成配置
- **智能分析** — AI 理解文档结构，自动识别标题层级
- **主动执行** — 说"删除多余的标题"，AI 立刻操作，不废话
- **12 个排版工具** — 预设切换、元素管理、样式配置、页眉边距等

### 格式化引擎

- **双输入模式** — 上传 docx 文件或直接输入文字
- **智能标题检测** — 3-Pass 算法自动识别一级/二级/三级标题
- **预设模板** — 学术论文、商业报告、政府公文、小说散文
- **自定义配置** — 字体、字号（中文体系 + pt）、颜色、间距、对齐、首行缩进
- **动态元素管理** — 增删、拖拽排序、复制、批量编辑
- **页面设置** — 页边距、页眉文字、自动章节页眉、页码
- **格式预览** — WPS 风格 A4 纸张实时预览，左侧标记元素类型
- **段落类型切换** — 点击预览标签可切换标题/正文类型
- **撤销/重做** — Ctrl+Z / Ctrl+Shift+Z
- **另存为** — 选择保存位置，自定义文件名

### 通用

- **中英文双语** — 完整界面国际化
- **暗色/亮色主题** — 手动切换，持久化偏好
- **自定义模板** — 保存常用配置，支持导入/导出 JSON

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 + TypeScript + Tailwind CSS v4 + shadcn/ui |
| AI Agent | MiMo-V2.5 + ReAct 循环 + 12 工具集 |
| 后端引擎 | Python 3.13 + python-docx |
| 部署 | Node.js + Python 双运行时 |

## 快速开始

```bash
# 1. 安装依赖
npm install
pip install python-docx

# 2. 配置 AI 模型（可选，不配置则无 AI 功能）
cp .env.example .env.local
# 编辑 .env.local，填入 API Key

# 3. 启动开发服务器
npm run dev

# 4. 打开浏览器
# http://localhost:3000
```

## 项目结构

```
├── src/
│   ├── app/
│   │   ├── page.tsx              # 主页面
│   │   ├── layout.tsx            # 根布局
│   │   ├── globals.css           # 全局样式
│   │   └── api/
│   │       ├── format/route.ts   # 格式化 API
│   │       ├── preview/route.ts  # 文档预览 API
│   │       └── agent/route.ts    # AI Agent API
│   ├── components/
│   │   └── chat/                 # AI 聊天面板组件
│   └── lib/
│   ├── agent/
│   │   ├── engine/               # Agent 引擎（ReAct 循环）
│   │   ├── tools/                # 12 个排版工具
│   │   └── llm/                  # LLM 客户端
│   └── lang.ts                   # 中英文翻译
├── engine/
│   └── doc_format_agent.py       # 文档格式化引擎
├── UPDATE.md                     # 版本更新日志
└── README.md
```

## 工作原理

1. **上传文档** — 支持 .docx 文件上传或直接粘贴文字
2. **AI 分析** — Agent 读取文档内容，理解结构和排版需求
3. **自动配置** — AI 调用工具设置格式（或手动配置）
4. **实时预览** — WPS 风格 A4 纸张查看效果
5. **生成输出** — 生成格式化后的 .docx 文件，支持另存为

## 更新日志

详见 [UPDATE.md](./UPDATE.md)

## License

MIT
