<div align="center">

# OpenClaw Pegboard

**A universal canvas for AI agents to mount anything — like a pegboard on your wall.**

AI agent calls tools. Panels appear. Data visualized. No manual UI work.

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Ready-green)](https://github.com/nicepkg/openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | [中文](README_zh.md)

</div>

---

<p align="center">
  <img src="docs/screenshots/light.png" width="32%" alt="Light Theme" />
  <img src="docs/screenshots/dark.png" width="32%" alt="Dark Theme" />
  <img src="docs/screenshots/system.png" width="32%" alt="System Theme" />
</p>

## What is Pegboard?

Think of a real pegboard — the kind you hang on a wall. You can mount anything: tools, shelves, hooks, containers. Pegboard brings this concept to your desktop, but for **AI-generated content**.

When an AI agent needs to show you something — a table, a chart, a code snippet, a timeline — it simply calls a tool. A panel appears on your canvas. The agent arranges, updates, and manages panels autonomously. You watch your workspace come alive.

**Pegboard is not a dashboard builder.** It's a living surface that your AI agent populates in real time.

```
You: "Analyze the sales data and show me the trends"

Agent thinking...
  → creates a Table panel with raw data
  → creates a Chart panel with trend lines
  → creates a Text panel with key insights
  → pins the summary to the sidebar

All panels appear on your canvas instantly.
```

## Core Ideas

- **AI-first UI** — Panels are created by agents, not dragged from a palette
- **Universal surface** — 9 structured panel types + freeform HTML sandbox
- **Real-time** — WebSocket-driven, streaming updates as the agent thinks
- **Multi-tab canvas** — 6 category views (important, daily, work, entertainment, other, all) with tag-based filtering
- **Persistent** — Canvas state auto-saves to disk with daily snapshots
- **Themeable** — 5 built-in themes + system mode, with custom theme support
- **Native desktop** — Tauri v2, fast and lightweight

## Panel Types

| Type | Description |
|------|-------------|
| **Text** | Markdown with TOC, summaries, fullscreen |
| **Table** | Structured columns & rows with sorting |
| **Chart** | Line, bar, pie, area, scatter (Recharts) |
| **List** | Items with icons, badges, subtitles |
| **Code** | Syntax-highlighted with Shiki |
| **Image** | Images via data URI, local path, or URL |
| **Timeline** | Calendar events and schedules |
| **KV** | Key-value pairs with status indicators |
| **HTML** | Custom HTML/CSS/JS in an isolated iframe sandbox |

## Agent Tools

| Tool | Purpose |
|------|---------|
| `canvas_query` | List panels, get panel details, filter by type |
| `panel_control` | Create / update / patch / archive / delete / resize / star / tag panels |
| `canvas_control` | Switch views, focus/expand panels, rearrange, clear canvas, apply layout presets |
| `realtime_control` | Start/stop data subscriptions, set refresh intervals (polling, websocket, file watch) |

The agent sees a snapshot of your canvas with every message, so it knows what's already on screen before deciding what to create next.

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) + [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- [OpenClaw](https://github.com/nicepkg/openclaw) installed

### Run the app

```bash
git clone https://github.com/user/pegboard.git
cd pegboard
pnpm install
pnpm tauri dev
```

### Install the Skill

Copy the `skill/` directory to your OpenClaw skills folder so the agent can control Pegboard panels:

```bash
cp -r skill/ <openclaw-skills-dir>/pegboard
```

### Install the Channel Plugin (optional)

The `channel-adapter/` directory contains an OpenClaw channel plugin that bridges the WebSocket connection between the agent and Pegboard. Install it if your setup requires a dedicated channel:

```bash
cp -r channel-adapter/ <openclaw-plugins-dir>/pegboard
```

If not installed, you can tell the agent to connect to Pegboard directly — it will read the token from `~/.pegboard/config/ws-token.json` and establish the WebSocket connection.

## How It Works

1. **Pegboard starts** — WS server listens on `:9800`, writes auth token to `~/.pegboard/config/ws-token.json`
2. **OpenClaw connects** — Channel plugin reads the token and establishes a persistent WebSocket connection
3. **You chat** — Press `⌘J`, type a message. It flows through WS to the agent
4. **Agent responds** — Streams text back to the chat bar, and calls Skill tools to create/update panels
5. **Canvas updates** — Panels appear, rearrange, and update in real time
6. **State persists** — Auto-saved to `~/.pegboard/current/` with daily snapshots

## Chat

The floating chat bar (`⌘J`) supports:

- **@ mentions** — Type `@` to reference panels by title, giving the agent context
- **File attachments** — Attach files via the paperclip button or paste images from clipboard
- **Audio recording** — Record voice messages with the mic button
- **Streaming** — See the agent's response as it streams in real time
- **Draggable** — Reposition the chat bar anywhere on screen

## Themes

5 built-in themes: **light**, **dark**, **vintage**, **doodle**, **blaze** — plus **system** (follows OS preference). Custom themes can be added at runtime.

## Templates

4 built-in layout templates for common use cases:

- **Dashboard Card** — Summary cards layout
- **Kanban** — Kanban board layout
- **Report** — Report-style document layout
- **Timeline Vertical** — Vertical timeline layout

Templates can be imported, managed, and applied via the settings panel or agent tools.

## License

MIT
