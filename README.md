# A2UI + AG-UI Demo

AI Agent UI framework with standard A2UI (Agent-to-User Interface) and AG-UI (Agent-User Interaction) protocols. Backend powered by DeepSeek.

## Structure

```
├── server/server.js     # Node.js backend (DeepSeek API + A2UI generation + matplotlib charts)
├── app.html             # A2UI interactive web app (form/table/modal/tabs/chart)
├── agui.html            # AG-UI streaming chat (SSE events)
├── a2ui-interactive.html # A2UI interactive demo
├── desktop/             # Tauri v2 desktop app
│   ├── src-tauri/       # Rust backend
│   ├── index.html       # Desktop UI
│   └── .cargo/          # Cargo mirror config (China)
└── /tmp/a2ui.py         # CLI script (generate A2UI → HTML)
```

## Quick Start

### 1. Start server

```bash
cd ~/projects/ag-ui-demo
DEEPSEEK_API_KEY=sk-xxx node server/server.js
```

### 2. Web App

```
open http://localhost:3456/app.html
```

- Left: input prompt → Generate UI
- Right: rendered interactive form/table/modal/tabs/chart
- Settings panel for model/API config

### 3. AG-UI Chat

```
open http://localhost:3456/agui.html
```

### 4. Desktop App

```bash
cd desktop
npm install
cargo tauri dev
```

### 5. CLI

```bash
python3 /tmp/a2ui.py "一个用户注册表单"
# Opens /tmp/a2ui_result.html in browser
```

## Components

Text, TextField, Button, MultipleChoice, Checkbox, Slider, DateTimeInput, Card, Column, Row, Table, Modal, Tabs, Chart(bar/line/pie), Divider

## Protocols

- **A2UI v0.8**: `surfaceUpdate` + `beginRendering` messages
- **AG-UI**: SSE streaming with RUN_STARTED/TEXT_MESSAGE_CONTENT/TEXT_MESSAGE_END events
