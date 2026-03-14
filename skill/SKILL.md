---
name: PegBoard
description: 洞洞板 — 画布面板管理 Skill v2.0 (WS 9800)
---

# PegBoard Skill v2.0

## 概述

通过 WebSocket (localhost:9800) 管理洞洞板画布上的面板。
提供面板的创建、查询、更新、删除，画布视图控制，布局预设，实时数据订阅，面板交互配置，以及主题切换与自定义主题注册。

**核心能力：** 画布顶部内置 6 个分类 Tab（重要/日常/工作/娱乐/其他/全部），面板通过 `tags` 字段分配到对应 Tab。需要对面板进行分类、分组、归类时，使用 `setTags` + `switchView` 组合即可，这是画布原生的组织方式。

**连接信息：**
- **地址**: `ws://localhost:9800?token=<token>`
- **Token 位置**: `~/.pegboard/config/ws-token.json`

**国际化：** UI 支持中文 (zh-CN) 和英文 (en)，通过浏览器语言自动检测或用户手动切换。

---

## 工具命令 (CLI)

### 创建面板

```bash
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"text","title":"标题","data":{"content":"# 内容\n\n正文"}}'
```

**参数说明：**
- `action`: `"create"` | `"update"` | `"archive"` | `"delete"` | `"resize"` | `"changeType"` | `"star"` | `"setTags"`
- `panelType`: `"text"` | `"table"` | `"list"` | `"chart"` | `"code"` | `"image"` | `"timeline"` | `"kv"` | `"html"`
- `title`: 面板标题
- `size`: `"sm"` | `"md"` | `"lg"` | `"full"` (默认 `"md"`) — 快捷尺寸
- `layout`: `{x, y, w, h}` — 精确布局位置 (create/update 时可选，覆盖 size 的默认尺寸)
- `pinned`: `true` | `false` (默认 `false`，固定到左侧)
- `data`: 面板数据 (结构见下方 Data Schema，用于结构化面板)
- `html`: 自定义 HTML 字符串 (sandbox 渲染，与 data 二选一。**必须内联所有 JS/CSS，禁止外部引用**)
- `interaction`: 交互配置对象 (见下方 "面板交互配置" 章节)
- `tags`: 分类标签数组，决定面板显示在哪些 Tab 下。可选值: `"important"` | `"daily"` | `"work"` | `"entertainment"` | `"other"`。一个面板可同时拥有多个标签。create 时设置初始分类，setTags 时更新分类。
- `w`: 网格宽度 1-18 (resize 时使用)
- `h`: 网格高度 1-18 (resize 时使用)
- `starred`: 布尔值 (star 时使用)

**示例：**
```bash
# 创建文本面板
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"text","title":"会议纪要","data":{"summary":"本次会议讨论了两项议题","content":"# 会议纪要\n\n- 议题 1\n- 议题 2","format":"markdown"}}'

# 创建面板并指定精确位置和大小
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"chart","title":"趋势图","data":{"chartType":"line","data":[{"label":"1月","value":100}],"xAxis":"月份","yAxis":"销售额"},"layout":{"x":0,"y":0,"w":6,"h":5}}'

# 创建日程面板
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"timeline","title":"本周日程","data":{"events":[{"id":"1","title":"周会","date":"2026-03-10T10:00","color":"#3b82f6"}],"viewMode":"week"}}'

# 创建表格面板 (带排序和筛选)
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"table","title":"销售对比","data":{"columns":[{"key":"name","label":"姓名"},{"key":"sales","label":"销售额"}],"rows":[{"name":"张三","sales":"10000"},{"name":"李四","sales":"15000"}]},"interaction":{"sortable":true,"filterable":true}}'

# 创建带勾选的列表面板
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"list","title":"待办事项","data":{"items":[{"id":"1","title":"买牛奶"},{"id":"2","title":"写报告"}]},"interaction":{"checkable":true}}'

# 更新面板
node {baseDir}/tools/panel_control.mjs '{"action":"update","panelId":"panel-abc","data":{"content":"# 更新后的内容"}}'

# 更新面板并调整位置
node {baseDir}/tools/panel_control.mjs '{"action":"update","panelId":"panel-abc","data":{"content":"# 更新"},"layout":{"x":6,"y":0,"w":6,"h":4}}'

# 调整面板大小 (w: 1-18 列, h: 1-18 行)
node {baseDir}/tools/panel_control.mjs '{"action":"resize","panelId":"panel-abc","w":8,"h":5}'

# 更改面板类型 (保留 pinned/starred/tags 等属性，替换 panelType/data)
node {baseDir}/tools/panel_control.mjs '{"action":"changeType","panelId":"panel-abc","panelType":"chart","data":{"chartType":"bar","data":[{"label":"A","value":10}],"xAxis":"名称","yAxis":"数量"}}'

# 创建面板并分配到「工作」和「重要」Tab
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"text","title":"周报","data":{"summary":"本周进展","content":"# 周报","format":"markdown"},"tags":["work","important"]}'

# 设置面板分类标签 (一个面板可同时属于多个 Tab)
node {baseDir}/tools/panel_control.mjs '{"action":"setTags","panelId":"panel-abc","tags":["daily","entertainment"]}'

# 标星/取消标星面板
node {baseDir}/tools/panel_control.mjs '{"action":"star","panelId":"panel-abc","starred":true}'

# 删除面板
node {baseDir}/tools/panel_control.mjs '{"action":"delete","panelId":"panel-abc"}'
```

---

### 查询面板

```bash
# 列出所有面板
node {baseDir}/tools/canvas_query.mjs '{"action":"listPanels"}'

# 按类型过滤
node {baseDir}/tools/canvas_query.mjs '{"action":"listPanels","panelType":"timeline"}'

# 获取面板详情
node {baseDir}/tools/canvas_query.mjs '{"action":"getPanelDetail","panelId":"panel-xxx"}'
```

---

### 画布控制

```bash
# 切换分类 Tab (important/daily/work/entertainment/other/all)
node {baseDir}/tools/canvas_control.mjs '{"action":"switchView","view":"work"}'

# 聚焦面板
node {baseDir}/tools/canvas_control.mjs '{"action":"focusPanel","panelId":"panel-xxx"}'

# 清空画布
node {baseDir}/tools/canvas_control.mjs '{"action":"clearCanvas","keepPinned":true}'

# 应用布局预设
node {baseDir}/tools/canvas_control.mjs '{"action":"applyLayout","preset":"grid-2x2"}'

# 精确布局：设置多个面板的位置和大小 (18 列网格，行数无限)
node {baseDir}/tools/canvas_control.mjs '{"action":"setLayout","layout":[{"panelId":"panel-a","x":0,"y":0,"w":9,"h":4},{"panelId":"panel-b","x":9,"y":0,"w":9,"h":4}]}'
```

**精确布局 (`setLayout`)：**

使用 18 列网格坐标系精确控制面板位置和大小。未列出的面板保持原位。

| 字段 | 类型 | 说明 |
|------|------|------|
| `panelId` | string | 面板 ID (必填) |
| `x` | number | 网格列坐标 (0-17) |
| `y` | number | 网格行坐标 (0 起，无上限) |
| `w` | number | 网格宽度 (1-18 列) |
| `h` | number | 网格高度 (1-18 行) |

```
  x=0       x=9
  |         |
  +----9----+----9----+  y=0
  | panel-a | panel-b |  h=4
  |         |         |
  +---------+---------+  y=4
  |      panel-c      |  h=3, w=18
  +--------------------+ y=7
```

**布局预设 (`applyLayout`)：**

| 预设 | 说明 |
|------|------|
| `focus` | 单面板聚焦，最大化显示 |
| `split` | 左右双栏分屏 |
| `grid-2x2` | 2x2 四宫格 |
| `grid-3x3` | 3x3 九宫格 |
| `stack` | 垂直堆叠排列 |
| `kanban` | 看板式多列布局 |

---

### 分类 Tab 系统

画布顶部有 6 个分类 Tab：**重要** / **日常** / **工作** / **娱乐** / **其他** / **全部**。

面板通过 `tags` 字段分配到对应 Tab。一个面板可以有多个 tags，会同时出现在多个 Tab 下。没有 tags 的面板只在「全部」和「其他」Tab 下显示。

| Tab | 对应 tag 值 | 说明 |
|-----|------------|------|
| 重要 | `"important"` | 重要面板 |
| 日常 | `"daily"` | 日常生活相关 |
| 工作 | `"work"` | 工作相关 |
| 娱乐 | `"entertainment"` | 娱乐内容 |
| 其他 | `"other"` 或无 tags | 未分类面板 |
| 全部 | — | 显示所有面板 |

**创建时指定分类：**
```bash
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"list","title":"待办事项","tags":["daily","important"],"data":{"items":[{"id":"1","title":"买菜"}]}}'
```

**修改已有面板的分类：**
```bash
node {baseDir}/tools/panel_control.mjs '{"action":"setTags","panelId":"panel-abc","tags":["work"]}'
```

**切换到指定 Tab：**
```bash
node {baseDir}/tools/canvas_control.mjs '{"action":"switchView","view":"work"}'
```

**批量分类已有面板：**

当用户要求"把面板按类型/内容分类"时，正确做法是给每个面板打标签，而不是创建新面板：

```bash
# 1. 先查看画布上所有面板
node {baseDir}/tools/canvas_query.mjs '{"action":"listPanels"}'

# 2. 根据面板内容，逐个设置分类标签
node {baseDir}/tools/panel_control.mjs '{"action":"setTags","panelId":"panel-weather","tags":["daily"]}'
node {baseDir}/tools/panel_control.mjs '{"action":"setTags","panelId":"panel-tokens","tags":["work"]}'
node {baseDir}/tools/panel_control.mjs '{"action":"setTags","panelId":"panel-sysmon","tags":["work","important"]}'

# 3. 切换到目标 Tab 查看分类结果
node {baseDir}/tools/canvas_control.mjs '{"action":"switchView","view":"work"}'
```

> **注意：** 分类 Tab 的 5 个标签值 (`important`/`daily`/`work`/`entertainment`/`other`) 是固定的，不支持自定义标签名。如果面板不属于任何标签，它只会出现在「全部」和「其他」Tab 下。

---

### 实时数据订阅

```bash
# 启动轮询订阅 (每 5 秒刷新)
node {baseDir}/tools/realtime_control.mjs '{"action":"startSubscription","panelId":"panel-xxx","config":{"enabled":true,"source":"polling","url":"https://api.example.com/data","interval":5000,"maxRetries":3}}'

# 停止订阅
node {baseDir}/tools/realtime_control.mjs '{"action":"stopSubscription","panelId":"panel-xxx"}'

# 调整刷新间隔
node {baseDir}/tools/realtime_control.mjs '{"action":"setRefreshInterval","panelId":"panel-xxx","interval":10000}'
```

**参数说明：**
- `action`: `"startSubscription"` | `"stopSubscription"` | `"setRefreshInterval"`
- `panelId`: 目标面板 ID (必填)
- `config`: RealtimeConfig 对象 (startSubscription 时必填)
  - `enabled`: 是否启用
  - `source`: `"polling"` | `"websocket"` | `"file_watch"` — 数据源类型
  - `url`: 数据源 URL
  - `params`: 额外请求参数
  - `interval`: 刷新间隔 (毫秒)
  - `maxRetries`: 最大重试次数
- `interval`: 刷新间隔毫秒数 (setRefreshInterval 时必填)

---

### 主题控制

```bash
# 查询当前主题和可用主题列表
node {baseDir}/tools/theme_control.mjs '{"action":"getTheme"}'

# 切换到内置主题
node {baseDir}/tools/theme_control.mjs '{"action":"setTheme","theme":"dark"}'

# 注册自定义主题并切换
node {baseDir}/tools/theme_control.mjs '{"action":"registerTheme","themeName":"ocean","css":".ocean { --background: oklch(0.95 0.02 230); --foreground: oklch(0.20 0.02 230); --card: oklch(0.97 0.015 230); --card-foreground: oklch(0.20 0.02 230); --primary: oklch(0.60 0.15 230); --primary-foreground: oklch(0.98 0.005 230); }"}'
node {baseDir}/tools/theme_control.mjs '{"action":"setTheme","theme":"ocean"}'
```

**参数说明：**
- `action`: `"getTheme"` | `"setTheme"` | `"registerTheme"`
- `theme`: 目标主题名称 (setTheme 时必填)
- `themeName`: 自定义主题名称 (registerTheme 时必填)，用作 CSS 类名，建议小写字母+连字符
- `css`: 完整主题 CSS (registerTheme 时必填)

**内置主题：**

| 主题 | 风格 |
|------|------|
| light | 默认浅色 (霜白) |
| dark | 碳纤维深色 (青色点缀) |
| vintage | 档案馆 (衬线字体、亚麻纸纹理) |
| doodle | 手绘涂鸦风 |
| blaze | 火焰 |
| system | 跟随系统 (light/dark) |

**自定义主题 CSS 规范：**

注册自定义主题时，CSS 必须以 `.themeName { }` 包裹，内部定义 CSS 变量。必须定义的核心变量：

```css
.my-theme {
  --background: ...;         /* 页面背景 */
  --foreground: ...;         /* 主要文字 */
  --card: ...;               /* 面板背景 */
  --card-foreground: ...;    /* 面板文字 */
  --primary: ...;            /* 主色调 (按钮、链接) */
  --primary-foreground: ...; /* 主色调上的文字 */
  --secondary: ...;          /* 次要背景 */
  --secondary-foreground: ...;
  --muted: ...;              /* 柔和背景 */
  --muted-foreground: ...;   /* 柔和文字 */
  --accent: ...;             /* 强调背景 */
  --accent-foreground: ...;
  --border: ...;             /* 边框 */
  --input: ...;              /* 输入框背景 */
  --ring: ...;               /* 焦点环 */
  --radius: ...;             /* 圆角大小 */
  --chart-1: ...;            /* 图表配色 1 */
  --chart-2: ...;            /* 图表配色 2 */
  --chart-3: ...;            /* 图表配色 3 */
  --chart-4: ...;            /* 图表配色 4 */
  --chart-5: ...;            /* 图表配色 5 */
  --sidebar: ...;            /* 侧边栏背景 */
  --sidebar-foreground: ...; /* 侧边栏文字 */
}
```

可额外添加组件样式覆盖（面板 `[data-panel]`、侧边栏、画布背景 `[data-app-shell]` 等），参考内置主题 CSS 文件结构。推荐使用 oklch 色值以保证色彩一致性。

---

## 可用面板类型

| 类型 | 用途 | 示例 |
|------|------|------|
| text | 富文本/Markdown | 文档、报告、长文阅读 |
| table | 行列数据 | 统计表、对比分析 |
| list | 条目列表 | 搜索结果、待办事项 |
| chart | 数据图表 | 趋势分析、KPI |
| code | 代码块 | 代码片段、配置文件 |
| image | 图片 | 截图、图表图片 |
| timeline | 时间轴 | 日程、项目进度 |
| kv | 键值摘要 | 状态概览、快速事实 |
| html | 自定义 HTML (sandbox) | 小游戏、自定义可视化、交互式组件 |

---

## 双轨渲染：结构化 vs HTML Sandbox

PegBoard 有两种渲染轨道：

1. **结构化渲染** (`data` 字段) — 使用 `panelType` 对应的 React 组件渲染结构化数据
2. **HTML Sandbox 渲染** (`html` 字段) — 在 iframe 沙箱中渲染自定义 HTML

**规则：`html` 字段优先于 `panelType`。** 只要消息包含 `html` 字段，就走 sandbox 渲染，忽略 panelType 对应的 React 组件。

### 何时使用 html 面板

**优先使用原生能力：** 在考虑 HTML 面板之前，先确认需求是否能通过结构化面板类型（text/table/list/chart/code/image/timeline/kv）和画布原生功能（分类 Tab、布局预设、精确布局）满足。HTML 面板适用于原生能力确实无法覆盖的场景：

- 需要自定义交互（游戏、拖拽、动画等）
- 需要自定义样式布局（8 种结构化类型无法满足）
- 需要 Canvas/SVG 绑定等浏览器 API

### HTML 面板创建方式

```bash
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"html","title":"贪吃蛇","size":"lg","html":"<div id=\"game\">...</div><script>/* 游戏逻辑 */</script>","css":"#game { width: 100%; }"}'
```

**关键约束：**
- **必须用 `html` 字段**，不是 `data.content` — 放到 `data.content` 会被当作纯文本显示
- **`panelType` 设为 `"html"`**（用于分类和 emoji 标识）
- **HTML 必须完全内联** — 所有 CSS、JS、资源都必须写在 `html` 字符串内
- **禁止 `<iframe src="file://...">` 或任何外部 URL** — sandbox 不允许加载外部资源
- **禁止 `<iframe>` 嵌套** — html 字段本身就会被渲染到 iframe 中，不要再嵌套 iframe
- 可选：通过 `css` 字段传入额外样式，会注入到 sandbox 的 `<style>` 标签

### 错误示范 ❌

```json
{
  "panelType": "text",
  "title": "贪吃蛇",
  "data": { "content": "<iframe src='file:///path/to/snake.html'></iframe>" }
}
```
↑ 这会把 HTML 标签当纯文本显示，不会渲染。

### 正确示范 ✅

```json
{
  "panelType": "html",
  "title": "贪吃蛇",
  "size": "lg",
  "html": "<canvas id='game' width='400' height='400'></canvas><script>/* 所有游戏逻辑内联在这里 */</script>",
  "css": "body { margin: 0; display: flex; justify-content: center; }"
}
```

---

## 面板 Data Schema

> 标注 **必填** 的字段缺失会导致渲染异常。未标注的字段为可选。

### TextPanel
```json
{
  "summary": "文档摘要",          // 必填
  "content": "# 标题\n\n正文内容...", // 必填
  "format": "markdown"            // 必填: "markdown" | "plaintext"
}
```

### TablePanel
```json
{
  "columns": [                    // 必填
    { "key": "name", "label": "名称" },
    { "key": "age", "label": "年龄" }
  ],
  "rows": [                       // 必填
    { "name": "张三", "age": "28" },
    { "name": "李四", "age": "32" }
  ]
}
```

### ListPanel
```json
{
  "items": [                      // 必填
    {
      "id": "1", "title": "第一项", "subtitle": "说明",
      "badge": { "text": "新", "color": "blue" }  // badge 是对象: { text, color }
    },
    { "id": "2", "title": "第二项", "subtitle": "说明" }
  ],
  "emptyText": "暂无数据"
}
```

### ChartPanel
```json
{
  "chartType": "line",
  "data": [                       // 必填: { label, value, series? }
    { "label": "1 月", "value": 4000 },
    { "label": "2 月", "value": 5200 },
    { "label": "3 月", "value": 4800 }
  ],
  "xAxis": "月份",                // 必填: X 轴标签
  "yAxis": "销售额"               // 必填: Y 轴标签
}
```

### CodePanel
```json
{
  "language": "typescript",       // 必填
  "code": "const greeting = 'Hello';\nconsole.log(greeting);", // 必填
  "highlightLines": [2],
  "copyable": true,
  "filename": "example.ts"
}
```

### ImagePanel
```json
{
  "src": "data:image/png;base64,iVBOR...", // 必填
  "caption": "示例图片",
  "alt": "示例"
}
```

### TimelinePanel
```json
{
  "events": [                     // 必填
    {
      "id": "1",
      "title": "周会",
      "date": "2026-03-10T10:00",
      "endDate": "2026-03-10T11:00",
      "color": "#3b82f6"
    },
    {
      "id": "2",
      "title": "产品评审",
      "date": "2026-03-10T14:00",
      "endDate": "2026-03-10T15:30",
      "color": "#10b981"
    }
  ],
  "viewMode": "week"              // 必填: "day" | "week" | "month"
}
```

### KVPanel
```json
{
  "items": [                      // 必填
    { "key": "状态", "value": "运行中", "type": "status", "status": "success" },
    { "key": "版本", "value": "1.2.3", "type": "text" },
    { "key": "响应时间", "value": "45ms", "type": "text" }
  ],
  "columns": 2
}
```

---

## 尺寸选择指南

**快捷尺寸 (`size`)：** 简单预设，自动决定网格列数和行数。

| 尺寸 | 用途 | 典型场景 |
|------|------|----------|
| sm | 摘要卡片 | KV 概览、简短列表、状态卡 |
| md | 标准展示 | 表格、图表、代码片段、一般列表 |
| lg | 详细内容 | 长文档、复杂表格、多系列图表 |
| full | 全屏分析 | 大型数据仪表盘、完整报告 |

**各面板类型默认尺寸 (18 列网格，行高 50px)：**

| 类型 | 默认宽 (w) | 默认高 (h) |
|------|-----------|-----------|
| html | 6 | 6 |
| chart | 6 | 5 |
| table | 6 | 5 |
| timeline | 6 | 5 |
| text | 5 | 5 |
| code | 5 | 5 |
| list | 4 | 5 |
| image | 4 | 5 |
| kv | 4 | 5 |

**精确尺寸 (`layout`)：** 在 create/update 时传入 `layout: {x, y, w, h}` 可精确控制面板在 18 列网格上的位置和大小。`w`/`h` 范围 1-18。与 `size` 可共存，`layout` 优先用于布局定位。

**面板缩放 (`resize`)：** 使用 `action: "resize"` 只调整已有面板的 `w`/`h`，不改变 `x`/`y`。

---

## 面板交互配置 (`interaction`)

创建或更新面板时可通过 `interaction` 字段启用用户交互能力。不同面板类型支持不同交互选项：

| 字段 | 类型 | 适用面板 | 说明 |
|------|------|----------|------|
| `sortable` | boolean | table | 启用表格列排序（用户点击表头切换升/降序） |
| `filterable` | boolean | table | 启用表格列筛选（用户可按列值过滤行） |
| `checkable` | boolean | list | 启用列表项勾选框（用户可勾选/取消条目） |
| `editable` | boolean | kv | 启用键值对内联编辑（用户可直接修改 value） |

### 用户交互产生的消息

当用户在面板上执行交互操作时，前端会通过 WebSocket 发送 `panel_user_action` 消息：

```json
{
  "type": "panel_user_action",
  "action": "check_item",
  "panelId": "panel-xxx",
  "payload": { "itemId": "1", "checked": true },
  "timestamp": "2026-03-10T12:00:00Z"
}
```

```json
{
  "type": "panel_user_action",
  "action": "edit_value",
  "panelId": "panel-xxx",
  "payload": { "key": "状态", "oldValue": "运行中", "newValue": "已停止" },
  "timestamp": "2026-03-10T12:00:00Z"
}
```

可用的 `action` 值：`pin` | `unpin` | `archive` | `restore` | `close` | `check_item` | `edit_value` | `status_change`

---

## 附件支持 (`attachments`)

用户消息 (UserMessage) 可携带附件，通过前端上传后附加到消息中。

```json
{
  "type": "user_message",
  "content": "请分析这张图片",
  "canvasState": { ... },
  "attachments": [
    {
      "type": "image",
      "name": "screenshot.png",
      "path": "/tmp/pegboard/uploads/screenshot.png",
      "size": 204800,
      "mimeType": "image/png"
    }
  ],
  "timestamp": "2026-03-10T12:00:00Z"
}
```

**附件类型：**
- `image` — 图片文件 (png, jpg, webp 等)
- `file` — 通用文件 (pdf, csv, xlsx 等)
- `audio` — 音频文件 (mp3, wav, m4a 等)

**附件字段：**
- `type`: `"image"` | `"file"` | `"audio"`
- `name`: 文件名
- `path`: 本地文件路径
- `size`: 文件大小 (字节)
- `mimeType`: MIME 类型

---

## canvasState 解读

channel-adapter 每轮消息会注入当前画布状态，结构:

```json
{
  "pinnedPanels": [
    { "id": "panel-xxx", "type": "list", "title": "待办事项", "size": "md", "dataSummary": "3 items: 买牛奶，写报告，...", "layout": {"x":0,"y":0,"w":4,"h":5}, "starred": true, "tags": ["daily"] }
  ],
  "transientPanels": [
    { "id": "panel-yyy", "type": "table", "title": "销售对比", "size": "md", "dataSummary": "5 rows", "layout": {"x":4,"y":0,"w":6,"h":5}, "tags": ["work"] }
  ],
  "activeView": "all",
  "archivedCount": 2,
  "currentTheme": "dark",
  "availableThemes": ["light","dark","vintage","doodle","blaze","system"],
  "templates": ["dashboard-card", "report", "kanban", "timeline-vertical"]
}
```

> canvasState 中的面板只包含概要，不含完整数据。
> 如需查看具体内容，使用 `canvas_query { action: "getPanelDetail", panelId: "..." }`。

**字段说明：**
- `pinnedPanels` / `transientPanels`: 面板概要列表
  - `id`, `type`, `title`, `size`, `dataSummary`: 基础信息
  - `layout`: 面板在 18 列网格上的位置和大小 `{x, y, w, h}`
  - `starred`: 是否标星
  - `tags`: 分类标签数组
  - `error`: 当面板数据格式无效导致渲染异常时，该字段会包含错误描述 (如 `"missing items array"`)。收到带 error 的面板时，应使用 update 修正其 data。
- `activeView`: 当前分类 Tab (important/daily/work/entertainment/other/all)
- `archivedCount`: 已归档面板数量
- `currentTheme`: 当前主题名称
- `availableThemes`: 所有可用主题 (内置 + 自定义注册的)
- `templates`: 可用 UI 模板名称列表 (见 "UI 模板" 章节)

**策略:**
- 根据画布上已有面板数量决定新面板尺寸 (画布已满时优先 sm)

---

## ⚠️ 面板复用策略 (必须严格遵守)

**核心原则：更新已有面板，不要重复创建。**

每轮消息都会注入 canvasState，其中每个面板都有 `id` 字段（如 `"id": "panel-xxx"`）。你必须利用这个 id 来更新面板，而不是每次都 create 新面板。

### 操作流程

1. **先检查 canvasState**：查看 pinnedPanels 和 transientPanels 列表
2. **如果已有同类/同名面板** → 用 `action: "update"` + 该面板的 `panelId`
3. **只有确认画布上没有相关面板时** → 才用 `action: "create"`

### 正确示范 ✅

canvasState 中已有 `{ "id": "panel-abc", "type": "kv", "title": "Token 用量" }`，要更新它：

```bash
node {baseDir}/tools/panel_control.mjs '{"action":"update","panelId":"panel-abc","data":{"items":[{"key":"输入","value":"245k"}]}}'
```

### 错误示范 ❌

canvasState 中已有 "Token 用量" 面板，但你没用它的 id，而是再 create 一个：

```bash
# 错！这会创建重复面板，因为没有传已有面板的 panelId
node {baseDir}/tools/panel_control.mjs '{"action":"create","panelType":"kv","title":"Token 用量","data":{...}}'
```

### 判断规则

| canvasState 中有同类面板？ | 操作 |
|---|---|
| 有，且内容需刷新 | `action: "update"`, `panelId` 设为 canvasState 中的 `id` |
| 有，但内容完全不同需替换 | 先 `action: "archive"` 旧面板，再 `action: "create"` 新面板 |
| 没有 | `action: "create"` (无需传 panelId，自动生成) |

### 避免泛滥
- 同一对话轮次中不要创建超过 3 个面板，优先合并展示

---

## HTML Sandbox 设计约束

参见 config/design_system.md。关键约束:
- HTML 必须完全自包含，所有 JS/CSS 内联
- 禁止外部资源加载（无 `<script src>`、`<link href>`、`<iframe src>`）
- 禁止 `file://` 协议引用
- 可使用 Tailwind CSS 类名（sandbox 已注入）
- 遵循设计系统配色 (CSS 变量)
- 结构简洁，max 5 层嵌套

---

## UI 模板

PegBoard 支持第三方 UI 设计模板。模板提供预设的 HTML/CSS 设计，Agent 在创建 HTML 面板时可以参考。

### 可用模板

| 模板 | 描述 | 适用场景 |
|------|------|----------|
| dashboard-card | 数字指标展示卡片 | KPI 仪表盘、数据概览 |
| report | 标题+表格+摘要 | 数据报表、分析总结 |
| kanban | 多列看板卡片 | 任务管理、流程可视化 |
| timeline-vertical | 纵向时间轴 | 事件记录、项目进度 |

### 使用方式

模板仅提供设计参考。Agent 可以：
1. 直接参考模板的 HTML 结构和 CSS 样式来创建 `html` 面板
2. 根据需要自由修改模板设计
3. 创建全新的 HTML 设计（不使用模板）

模板列表会通过 `canvasState.templates` 字段传递。
