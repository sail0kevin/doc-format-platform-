# doc-format-platform

AI 驱动的文档格式化平台 — 用自然语言描述排版需求，AI 自动配置格式并生成规范 Word 文档。

## 技术栈
- Next.js 16 (App Router) + TypeScript + Tailwind v4
- shadcn/ui 组件库
- MiMo-V2.5 AI 模型（OpenAI 兼容 API）
- Python 3.13 + python-docx — 文档处理核心

## 项目结构
```
doc-format-platform/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← 主页面（三段式布局）
│   │   ├── api/
│   │   │   ├── format/route.ts   ← 格式化 API
│   │   │   ├── preview/route.ts  ← 文档预览 API
│   │   │   └── agent/route.ts    ← AI Agent API
│   │   └── globals.css
│   ├── components/
│   │   └── chat/                 ← AI 聊天面板组件
│   └── lib/
│       ├── agent/
│       │   ├── engine/           ← ReAct 循环引擎
│       │   ├── tools/            ← 12 个排版工具
│       │   └── llm/              ← LLM 客户端
│       └── lang.ts               ← 中英文翻译
├── engine/
│   └── doc_format_agent.py       ← Python 格式化引擎
├── UPDATE.md                     ← 版本更新日志
├── DEVLOG.md                     ← 开发日志
├── DEV_REPORT.md                 ← 开发报告
└── CLAUDE.md
```

## 启动命令
npm run dev (需要 Node: G:\software\nodejs)

## AI 模型配置
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=你的API密钥
OPENAI_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
OPENAI_MODEL=mimo-v2.5
```
