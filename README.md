<div align="center">

# Pegboard

**A universal canvas for AI agents to mount anything — like a pegboard on your wall.**

AI agent calls tools. Panels appear. Data visualized. No manual UI work.

[![Version](https://img.shields.io/badge/Version-v0.1.0-orange)](https://github.com/CopperG/pegboard)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Ready-blueviolet)](https://claude.com/claude-code)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Ready-green)](https://github.com/nicepkg/openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | [中文](README_zh.md)

</div>

---

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

> **Agent compatibility status**
>
> - **Skill (panel control)**: universal — any agent that can run the skill scripts can control panels (Claude Code, OpenClaw, ...).
> - **Chat conversations**: currently focused on **Claude Code** (via claude-bridge, see below).
> - **OpenClaw channel mode**: only compatible with the **legacy OpenClaw** channel protocol; the new OpenClaw version is not supported yet.
> - Chat integration for other agents is planned but not yet developed.

### Use with Claude Code

Pegboard works with [Claude Code](https://claude.com/claude-code) out of the box.

1. Install the skill so Claude Code can control panels:

```bash
cp -r skill/ ~/.claude/skills/pegboard
```

2. Start the chat bridge so messages typed in Pegboard's chat bar reach Claude Code.

The easiest way: **click the bridge status light in the bottom toolbar** (next to the connection dot). Pegboard spawns and manages the bridge process for you, and kills it on app exit so it never lingers. Click again to stop it.

To run the bridge yourself instead:

```bash
node claude-bridge/index.mjs
# or install it as a launchd agent (auto-start, auto-restart, 24/7):
./claude-bridge/install-launchd.sh
```

The bridge requires **Node >= 22** (it uses the global `WebSocket`). It keeps
one persistent `claude` process alive (streaming JSON in/out), forwards each
chat message as a turn, and streams the reply back to the chat bar. Panel tool calls are made by Claude Code itself through the skill scripts.
Sessions survive bridge restarts within 24 hours.

**Do not run the bridge and the OpenClaw channel plugin at the same time** —
both consume the same chat messages and you will get two interleaved replies.

Configuration (env vars):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PEGBOARD_CLAUDE_BIN` | `claude` | Claude Code binary |
| `PEGBOARD_CLAUDE_ALLOWED_TOOLS` | `Skill(pegboard),Bash(node <skills>/pegboard/scripts/*),Read` | `--allowedTools` value, passed as one argument. The default is scoped to the skill scripts; widen to `Bash(node:*)` (permits arbitrary node code) only if you need it |
| `PEGBOARD_CLAUDE_FLAGS` | (empty) | Extra misc CLI flags, space-separated (do not put `--allowedTools` here) |
| `PEGBOARD_CLAUDE_CWD` | `$HOME` | Working directory for the agent |
| `PEGBOARD_CLAUDE_TIMEOUT_MS` | `600000` | Per-turn timeout |

If you only need panel control from an interactive Claude Code session
(no chat bar), installing the skill alone is enough.

### Install the OpenClaw Channel Plugin (optional, legacy OpenClaw only — do not combine with claude-bridge)

**Note: the channel plugin currently only works with the legacy OpenClaw channel mode; the new OpenClaw version is not supported yet.** For chat conversations, the Claude Code bridge above is the recommended path.

The `channel-adapter/` directory contains an OpenClaw channel plugin that bridges the WebSocket connection between the agent and Pegboard. Install it if your setup requires a dedicated channel:

```bash
cp -r channel-adapter/ <openclaw-plugins-dir>/pegboard
```

If not installed, you can tell the agent to connect to Pegboard directly — it will read the token from `~/.pegboard/config/ws-token.json` and establish the WebSocket connection.

## How It Works

1. **Pegboard starts** — WS server listens on `:9800`, writes auth token to `~/.pegboard/config/ws-token.json`
2. **Your agent connects** — claude-bridge or the OpenClaw channel plugin reads the token and establishes a persistent WebSocket connection
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

## More Features

- **Edit in place** — Double-click a text panel to edit its Markdown directly; saves are conflict-safe (a banner warns if the agent changed the panel mid-edit, and you choose how to resolve)
- **Checkable items** — Lists and timeline events have checkboxes; checked state lives in the panel data, survives restarts, and is reported back to the agent
- **Panel interactions** — Tables support sorting/filtering; drag panels onto tabs to categorize (or change category from the panel actions menu), drag to sidebar to pin/archive
- **Last-updated time** — Panel headers show a relative "updated X ago" timestamp (hover for the absolute time)
- **Chat multi-layout** — Full-screen, bottom bar, and floating window modes; file uploads support images/audio/documents (50 MB per file limit)
- **Agent theme control** — The `theme_control` tool lets agents query/switch themes and register custom theme CSS via WebSocket

## What's New in v0.1.0

The first tagged release. Highlights:

- **Claude Code integration** — the zero-dependency `claude-bridge/` daemon keeps one persistent `claude` process alive and streams replies into the chat bar. Start/stop it with one click from the bottom toolbar, or install it as a launchd agent for 24/7 operation. Sessions survive bridge restarts within 24 hours.
- **Editable panels** — double-click text panels to edit Markdown with conflict-safe saves; check off list and timeline items and the agent sees the change.
- **Panel quality of life** — relative last-updated time in headers, category switching from the actions menu, interaction and realtime config persist across app restarts.
- **Reliability** — per-client message queues in the WS server (slow clients no longer lose messages), stream chunks routed by `messageId` with an inactivity watchdog, daily snapshots no longer race the state load.
- **Test infrastructure** — Vitest + Testing Library covering both the frontend (jsdom) and the bridge (node).

## License

MIT
