<div align="center">

# OpenClaw 洞洞板 Pegboard

**AI 的万能洞洞板 —— 让 Agent 自主生成任何面板化内容到你的桌面画布。**

Agent 调用工具，面板自动生成，数据即时可视化。无需手动搭建 UI。

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Ready-green)](https://github.com/nicepkg/openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | [中文](README_zh.md)

</div>

---

<p align="center">
  <img src="docs/screenshots/light.png" width="32%" alt="浅色主题" />
  <img src="docs/screenshots/dark.png" width="32%" alt="深色主题" />
  <img src="docs/screenshots/system.png" width="32%" alt="跟随系统" />
</p>

## 洞洞板是什么？

想象一块挂在墙上的洞洞板（pegboard），你可以在上面挂工具、置物架、挂钩、收纳盒——任何东西。洞洞板把这个概念搬到了桌面上，但挂载的是 **AI 生成的内容**。

当 AI Agent 需要向你展示数据——表格、图表、代码片段、时间线——它只需调用一个工具，面板就会出现在画布上。Agent 自主地创建、排列、更新面板。你的工作空间自然而然地"长"出来。

**洞洞板不是仪表盘搭建工具。** 它是一个活的画布，由 AI Agent 实时填充内容。

```
你："分析一下销售数据，给我看趋势"

Agent 思考中...
  → 创建一个表格面板展示原始数据
  → 创建一个图表面板展示趋势线
  → 创建一个文本面板总结关键洞察
  → 将摘要固定到侧边栏

所有面板瞬间出现在你的画布上。
```

## 核心理念

- **AI 优先的 UI** —— 面板由 Agent 创建，而不是从组件库里拖拽
- **万能画布** —— 9 种结构化面板 + 自由 HTML 沙箱，什么都能挂
- **实时响应** —— WebSocket 驱动，Agent 思考的同时流式更新
- **多标签画布** —— 6 个分类视图（重要、日常、工作、娱乐、其他、全部），基于标签过滤
- **持久化** —— 画布状态自动保存到磁盘，支持每日快照回滚
- **丰富主题** —— 5 套内置主题 + 跟随系统，支持自定义主题
- **原生桌面** —— Tauri v2 构建，快速且轻量

## 面板类型

| 类型 | 说明 |
|------|------|
| **Text** | Markdown 富文本，支持目录、摘要、全屏 |
| **Table** | 结构化表格，支持排序 |
| **Chart** | 折线图、柱状图、饼图、面积图、散点图 (Recharts) |
| **List** | 带图标、徽章、副标题的列表 |
| **Code** | Shiki 语法高亮，行号，一键复制 |
| **Image** | 支持 Data URI、本地路径、URL 图片 |
| **Timeline** | 日历事件与时间表 |
| **KV** | 键值对 + 状态指示器 |
| **HTML** | 自定义 HTML/CSS/JS，iframe 沙箱隔离 |

## Agent 工具集

| 工具 | 用途 |
|------|------|
| `canvas_query` | 查询面板列表、获取面板详情，支持按类型过滤 |
| `panel_control` | 创建 / 更新 / 补丁 / 归档 / 删除 / 调整大小 / 加星 / 设置标签 |
| `canvas_control` | 切换视图、聚焦/展开面板、重排、清空画布、应用布局预设 |
| `realtime_control` | 启动/停止数据订阅，设置刷新间隔（轮询、WebSocket、文件监听） |

Agent 每次收到消息时都会看到画布快照，了解屏幕上已有的内容，再决定接下来创建什么。

## 快速开始

### 前置条件

- [Rust](https://rustup.rs/) + [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- [OpenClaw](https://github.com/nicepkg/openclaw) 已安装

### 启动应用

```bash
git clone https://github.com/user/pegboard.git
cd pegboard
pnpm install
pnpm tauri dev
```

### 安装 Skill

将 `skill/` 目录复制到 OpenClaw 的 skills 目录，让 Agent 获得控制洞洞板面板的能力：

```bash
cp -r skill/ <openclaw-skills-dir>/pegboard
```

### 安装 Channel 插件（可选）

`channel-adapter/` 目录包含一个 OpenClaw channel 插件，用于桥接 Agent 和洞洞板之间的 WebSocket 连接。如果你的部署需要专用 channel，可以安装它：

```bash
cp -r channel-adapter/ <openclaw-plugins-dir>/pegboard
```

如果不安装，也可以直接告诉 Agent 连接洞洞板 —— 它会自动读取 `~/.pegboard/config/ws-token.json` 中的 token 并建立 WebSocket 连接。

## 工作原理

1. **洞洞板启动** —— WS 服务器监听 `:9800`，认证 token 写入 `~/.pegboard/config/ws-token.json`
2. **OpenClaw 连接** —— Channel 插件读取 token，建立持久 WebSocket 连接
3. **你发消息** —— 按 `⌘J`，输入消息，经 WS 转发至 Agent
4. **Agent 响应** —— 流式回复文字，同时调用 Skill 工具创建/更新面板
5. **画布更新** —— 面板实时出现、重排、更新
6. **状态持久化** —— 自动保存至 `~/.pegboard/current/`，支持每日快照

## 聊天

浮动聊天栏（`⌘J`）支持：

- **@ 提及** —— 输入 `@` 引用面板标题，为 Agent 提供上下文
- **文件附件** —— 通过回形针按钮添加文件，或从剪贴板粘贴图片
- **语音录制** —— 使用麦克风按钮录制语音消息
- **流式显示** —— 实时查看 Agent 的回复
- **可拖拽** —— 自由拖动聊天栏到屏幕任意位置

## 主题

5 套内置主题：**light**（浅色）、**dark**（深色）、**vintage**（复古）、**doodle**（涂鸦）、**blaze**（烈焰） —— 另有 **system**（跟随系统）。支持运行时添加自定义主题。

## 更多特性

- **面板交互增强** —— 表格支持排序/筛选，列表支持勾选；拖拽面板到标签页可分类，拖到侧边栏可置顶/归档
- **聊天多布局** —— 全屏、底栏、浮动窗口三种模式；文件上传支持图片/音频/文档（单文件 50MB 限制）
- **Agent 主题控制** —— 新增 `theme_control` 工具，Agent 可查询/切换主题，也可通过 WebSocket 注册自定义主题 CSS

## License

MIT
