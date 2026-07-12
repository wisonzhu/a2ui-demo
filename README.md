# A2UI + AG-UI Demo

AI Agent UI framework with standard protocols. DeepSeek generates UI from natural language.

## Architecture

```
用户输入 "一个用户注册表单"
         │
         ▼
┌─────────────────────────────────────┐
│         DeepSeek API (LLM)          │  ← 标准 A2UI prompt
│  → 返回 surfaceUpdate JSON          │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│      server/server.js (Node.js)     │
│                                     │
│  ┌─ POST /a2ui/generate ──────┐    │
│  │ DeepSeek → A2UI JSON        │    │
│  │ Chart → matplotlib → PNG    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─ POST /agui/stream ────────┐    │
│  │ DeepSeek stream → SSE      │    │
│  └─────────────────────────────┘    │
└──────────────┬──────────────────────┘
               │ localhost:3456
      ┌────────┼────────┐
      ▼        ▼        ▼
  ┌──────┐ ┌──────┐ ┌──────────┐
  │ Web  │ │ AG-UI│ │ Desktop  │
  │ A2UI │ │ Chat │ │ Tauri    │
  └──────┘ └──────┘ └──────────┘
```

## 组件渲染流程

```
A2UI JSON (DeepSeek生成)
        │
        ▼
┌──────────────────┐
│   renderA2UI()   │  ← 渲染引擎核心（app.html）
│                  │
│ 1. 解析 components[] 数组
│ 2. 建立 id→component 索引
│ 3. 从 root 开始递归渲染
│ 4. 根据 component 类型分发：
│    ┌─────────────────────────────────┐
│    │ Text      → <span>/<h1>/<h2>   │
│    │ TextField → <label> + <input>  │
│    │ Button    → <button onclick>   │
│    │ Column    → <div flex column>  │
│    │ Row       → <div flex row>     │
│    │ Card      → <div border>       │
│    │ Table     → <table>            │
│    │ Modal     → <dialog>           │
│    │ Tabs      → <button> + <div>   │
│    │ Chart     → <img base64>       │
│    └─────────────────────────────────┘
│ 5. 处理数据绑定 (path → formData)
│ 6. 处理 action 回调 (submit 等)
└──────────────────┘
```

## 交互逻辑

```
┌───────────────────────────────────────────────┐
│              交互数据流                         │
│                                               │
│  A2UI JSON:                                   │
│  {"TextField": {"text": {"path": "/name"}}}   │
│         │                                     │
│         ▼ 渲染时绑定                            │
│  <input oninput="formData.name = this.value"> │
│         │                                     │
│         ▼ 用户输入"张三"                         │
│  formData = {name: "张三"}                     │
│         │                                     │
│         ▼ 点击提交按钮                           │
│  A2UI JSON:                                   │
│  {"Button": {"action": {"name": "submit"}}}   │
│         │                                     │
│         ▼ handleSubmit()                       │
│  读取 formData → 显示 "Submitted: name=张三"    │
└───────────────────────────────────────────────┘
```

## 扩展组件

### 添加新组件只需两步：

**1. 在 DeepSeek prompt 中注册**（server/server.js system prompt）

```javascript
// 已有：Text, TextField, Button, Table, Modal, Chart...
// 新增组件：
"NEW_COMPONENT: ProgressBar(value+max+label)"
```

**2. 在渲染引擎中添加渲染逻辑**（app.html renderA2UI 函数）

```javascript
// 在 switch(type) 中添加：
case 'ProgressBar':
  var val = props.value || 0;
  var max = props.max || 100;
  var pct = Math.round(val / max * 100);
  return '<div style="margin:.5rem 0">' +
    '<label>' + resolveValue(props.label) + ' ' + pct + '%</label>' +
    '<div style="background:#30363d;border-radius:4px;height:12px;width:100%">' +
    '<div style="background:#238636;border-radius:4px;height:12px;width:' + pct + '%"></div>' +
    '</div></div>';
```

完成后 DeepSeek 就能自动生成进度条了。添加一次，永久生效。

### 支持的 Action 类型

```javascript
// 1. 表单提交（已实现）
{"Button": {"action": {"name": "submit"}}}
→ handleSubmit() 读取 formData，显示结果

// 2. 可扩展 Action
{"Button": {"action": {"name": "reset"}}}    → 清空表单
{"Button": {"action": {"name": "navigate", "url": "/next"}}} → 跳转
{"Button": {"action": {"name": "api_call"}}}  → 调后端接口
```

## Quick Start

### 1. Start Backend

```bash
cd a2ui-demo
export DEEPSEEK_API_KEY=sk-xxx
node server/server.js
# → Server on http://localhost:3456
```

### 2. Web App

```bash
open http://localhost:3456/app.html
```

### 3. AG-UI Chat

```bash
open http://localhost:3456/agui.html
```

### 4. Desktop App (Tauri)

```bash
cd desktop && cargo tauri dev
```

### 5. CLI

```bash
python3 /tmp/a2ui.py "一个柱状图显示各季度销售额"
```

## Project Structure

```
├── server/server.js       # Node.js backend
├── app.html               # A2UI Web app
├── agui.html              # AG-UI streaming chat
├── desktop/               # Tauri v2 desktop
│   └── src-tauri/         # Rust shell
└── package.json           # npm deps
```

## Components

| 类别 | 组件 |
|------|------|
| 表单 | TextField, Button, MultipleChoice, Checkbox, Slider, DateTimeInput |
| 布局 | Column, Row, Card, Tabs, Divider |
| 展示 | Text(H1/H2), Table, Image |
| 弹窗 | Modal |
| 图表 | Bar, Line, Pie (matplotlib渲染) |

## 标准协议

- **A2UI v0.8**: `surfaceUpdate.components[]` → `beginRendering`
- **AG-UI v0.0.57**: SSE streaming events
