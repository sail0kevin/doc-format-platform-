# doc-format-platform

文档格式化 Web 平台 — 上传 docx，选择/自定义格式，一键下载成品。

## 技术栈
- Next.js 16 (App Router) + TypeScript + Tailwind v4
- shadcn/ui 组件库
- Python 3.13 + python-docx — 文档处理核心

## 项目结构
```
doc-format-platform/
├── src/app/
│   ├── page.tsx              ← 主页面（上传/配置/下载）
│   ├── api/format/route.ts   ← 格式化 API（接收文件→调 Python→返回成品）
│   └── globals.css
├── engine/
│   └── doc_format_agent.py   ← Python 格式化引擎
├── DEV_REPORT.md             ← 开发报告（含所有错误记录）
└── CLAUDE.md
```

## 启动命令
npm run dev (需要 Node: G:\software\nodejs)
