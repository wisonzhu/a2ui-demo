# A2UI + AG-UI Demo

AI Agent UI framework with standard protocols. DeepSeek generates UI from natural language.

## Architecture

```
┌──────────────┐     ┌─────────────────────────────────┐
│   DeepSeek   │────▶│  server/server.js (Node.js)     │
│   (大模型)    │     │  ┌─────────────────────────┐   │
└──────────────┘     │  │ POST /a2ui/generate     │   │
                     │  │ → 生成A2UI JSON          │   │
┌──────────────┐     │  │ → matplotlib渲染图表     │   │
│   DeepSeek   │────▶│  │   (柱/饼/折线+中文)     │   │
│   (stream)   │     │  ├─────────────────────────┤   │
└──────────────┘     │  │ POST /agui/stream       │   │
                     │  │ → SSE流式事件            │   │
                     │  └─────────────────────────┘   │
                     └──────────────┬──────────────────┘
                                    │ localhost:3456
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐  ┌────────────┐  ┌──────────────┐
              │ app.html │  │ agui.html  │  │  desktop/    │
              │ A2UI Web │  │ AG-UI Chat │  │  Tauri App   │
              └──────────┘  └────────────┘  └──────────────┘
```

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Python 3 (for chart rendering, needs matplotlib)
- Rust + Cargo (for desktop app only)

### 1. Install & Start Backend

```bash
cd a2ui-demo

# Set DeepSeek API key (get from https://platform.deepseek.com)
export DEEPSEEK_API_KEY=sk-xxxxxxxx

# Start server
node server/server.js
# → Server on http://localhost:3456
```

### 2. Web App (A2UI)

```bash
open http://localhost:3456/app.html
```

- **Left panel**: Type what UI you want → "Generate UI"
- **Right panel**: Rendered interactive form/table/modal/tabs/chart
- Quick buttons: 柱状图, 饼图, 表格, 弹窗, 标签页

### 3. Streaming Chat (AG-UI)

```bash
open http://localhost:3456/agui.html
```

- Type a question → DeepSeek streams answer
- Left: AG-UI event stream (RUN_STARTED → TEXT_MESSAGE_CONTENT → END)
- Right: Real-time streaming text

### 4. Desktop App (Tauri)

```bash
cd desktop
npm install          # first time only
cargo tauri dev      # starts Vite + Rust → native window
```

Or already compiled:
```bash
open desktop/src-tauri/target/debug/tauri-demo
```

### 5. CLI One-shot

```bash
python3 /tmp/a2ui.py "一个用户注册表单，包含姓名、邮箱、手机号"
# → Generates /tmp/a2ui_result.html and opens in browser
```

## Project Structure

```
├── server/
│   └── server.js          # Node.js backend
│       ├── /a2ui/generate # DeepSeek → A2UI JSON + chart images
│       └── /agui/stream   # DeepSeek → SSE event stream
├── app.html               # A2UI Web (form/table/modal/tabs/chart)
├── agui.html              # AG-UI streaming chat
├── a2ui-interactive.html  # A2UI lightweight demo
├── package.json           # Frontend deps (vite)
├── .npmrc                 # npm mirror (China)
├── desktop/
│   ├── index.html         # Desktop UI
│   ├── src-tauri/         # Tauri v2 Rust code
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── src/main.rs
│   └── .cargo/config.toml # Cargo mirror (ustc)
└── README.md
```

## Supported Components

| Type | Components |
|------|-----------|
| Form | TextField, Button, MultipleChoice, Checkbox, Slider, DateTimeInput |
| Layout | Column, Row, Card, Tabs, Divider |
| Display | Text(H1/H2), Table, Image |
| Dialog | Modal (trigger + title + content) |
| Chart | bar, line, pie (matplotlib + Chinese font) |

## Protocols

- **A2UI v0.8**: `surfaceUpdate.components[]` → `beginRendering`
- **AG-UI v0.0.57**: SSE with RUN_STARTED/TEXT_MESSAGE_CONTENT/TEXT_MESSAGE_END
