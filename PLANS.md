# 开发计划

## AI Agent 系统（已实现 ✓）

### 当前架构

```
src/lib/agent/
  tools/           # 12个工具
    apply-preset.ts
    add-element.ts
    remove-element.ts
    update-config.ts
    update-header.ts
    set-margins.ts
    update-label.ts
    cleanup-elements.ts
    set-paragraph-style.ts
    suggest-format.ts
    undo.ts / redo.ts
    index.ts         # 工具注册
  llm/
    client.ts        # API 路由客户端
    types.ts         # LLM 消息类型定义
  engine/
    agent-engine.ts  # ReAct 循环引擎
    system-prompt.ts # "小排"人设提示词
    types.ts         # Agent 配置类型
```

### 模型配置

- **当前模型**: MiMo-V2.5（响应 ~4.5s）
- **API**: OpenAI 兼容接口 (https://token-plan-cn.xiaomimimo.com/v1)
- **回退机制**: 文字协议提取 JSON 工具调用（兼容不支持原生 tool_calls 的模型）

### 已实现功能

1. **ReAct 循环** — Thought → Action → Observation 多轮推理
2. **12个排版工具** — 预设切换、元素管理、样式配置、页眉边距等
3. **"小排"人设** — 专业排版助手，主动执行指令
4. **文件内容可见** — mammoth.js 提取 .docx 文字给 Agent 上下文
5. **段落类型切换** — 预览区点击可切换标题/正文类型
6. **智能标题检测** — 3-pass 算法识别一级/二级/三级标题

---

## 下一步计划

### 短期优化

- [ ] 优化 Agent 响应速度（流式输出）
- [ ] 增加工具调用成功率监控
- [ ] 完善错误处理和用户反馈

### 中期功能

- [ ] 用户系统（登录、历史记录）
- [ ] 更多预设模板（公文、商业报告、简历等）
- [ ] 批量文档处理

### 长期目标

- [ ] 多语言文档支持
- [ ] 协作编辑
- [ ] API 开放平台
