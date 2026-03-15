---
name: pegboard
description: 洞洞板 (PegBoard) 画布面板管理。通过 WebSocket (localhost:9800) 创建、更新、查询、删除画布面板，控制画布视图和布局，管理实时数据订阅，以及切换/注册主题。当 Agent 需要在洞洞板画布上操作面板（包括文本、表格、列表、图表、代码、图片、时间轴、键值对、HTML sandbox 共 9 种类型），或需要控制画布分类 Tab、布局预设、主题切换时使用此 Skill。
---

# PegBoard Skill

通过 WebSocket (localhost:9800) 管理洞洞板画布上的面板。

**连接**: `ws://localhost:9800?token=<token>`，Token 位于 `~/.pegboard/config/ws-token.json`

**核心能力**: 画布顶部 6 个分类 Tab（重要/日常/工作/娱乐/其他/全部），面板通过 `tags` 字段分配到对应 Tab。

**详细参考**: 面板 Data Schema 见 [panel-schemas.md](references/panel-schemas.md)，HTML Sandbox 规范见 [html-sandbox.md](references/html-sandbox.md)，主题 CSS 规范见 [theme-spec.md](references/theme-spec.md)。

---

## 面板控制 (panel_control)

```bash
node {baseDir}/scripts/panel_control.mjs '<JSON>'
```

**参数:**
- `action`: `"create"` | `"update"` | `"archive"` | `"delete"` | `"resize"` | `"changeType"` | `"star"` | `"setTags"`
- `panelType`: `"text"` | `"table"` | `"list"` | `"chart"` | `"code"` | `"image"` | `"timeline"` | `"kv"` | `"html"`
- `title`: 面板标题
- `panelId`: 面板 ID (create 时自动生成, 其他操作必填)
- `size`: `"sm"` | `"md"` | `"lg"` | `"full"` (默认 `"md"`)
- `layout`: `{x, y, w, h}` — 精确布局 (覆盖 size)
- `pinned`: `true` | `false` (默认 `false`)
- `data`: 面板数据 (结构见 [panel-schemas.md](references/panel-schemas.md))
- `html`: 自定义 HTML 字符串 (sandbox 渲染，与 data 二选一，必须内联所有 JS/CSS)
- `interaction`: 交互配置 (见 [panel-schemas.md](references/panel-schemas.md))
- `tags`: 分类标签数组: `"important"` | `"daily"` | `"work"` | `"entertainment"` | `"other"`
- `w`/`h`: 网格宽高 1-18 (resize 时使用)
- `starred`: 布尔值 (star 时使用)

**示例:**

```bash
# 创建文本面板
node {baseDir}/scripts/panel_control.mjs '{"action":"create","panelType":"text","title":"会议纪要","data":{"summary":"讨论两项议题","content":"# 会议纪要\n\n- 议题 1\n- 议题 2","format":"markdown"}}'

# 创建图表 + 精确位置
node {baseDir}/scripts/panel_control.mjs '{"action":"create","panelType":"chart","title":"趋势图","data":{"chartType":"line","data":[{"label":"1月","value":100}],"xAxis":"月份","yAxis":"销售额"},"layout":{"x":0,"y":0,"w":6,"h":5}}'

# 创建日程面板
node {baseDir}/scripts/panel_control.mjs '{"action":"create","panelType":"timeline","title":"本周日程","data":{"events":[{"id":"1","title":"周会","date":"2026-03-10T10:00","color":"#3b82f6"}],"viewMode":"week"}}'

# 创建带交互的表格
node {baseDir}/scripts/panel_control.mjs '{"action":"create","panelType":"table","title":"销售对比","data":{"columns":[{"key":"name","label":"姓名"},{"key":"sales","label":"销售额"}],"rows":[{"name":"张三","sales":"10000"}]},"interaction":{"sortable":true,"filterable":true}}'

# 创建带勾选的列表
node {baseDir}/scripts/panel_control.mjs '{"action":"create","panelType":"list","title":"待办事项","data":{"items":[{"id":"1","title":"买牛奶"},{"id":"2","title":"写报告"}]},"interaction":{"checkable":true}}'

# 创建面板并分类到「工作」和「重要」Tab
node {baseDir}/scripts/panel_control.mjs '{"action":"create","panelType":"text","title":"周报","data":{"summary":"本周进展","content":"# 周报","format":"markdown"},"tags":["work","important"]}'

# 更新面板
node {baseDir}/scripts/panel_control.mjs '{"action":"update","panelId":"panel-abc","data":{"content":"# 更新后的内容"}}'

# 更新面板并调整位置
node {baseDir}/scripts/panel_control.mjs '{"action":"update","panelId":"panel-abc","data":{"content":"# 更新"},"layout":{"x":6,"y":0,"w":6,"h":4}}'

# 调整面板大小
node {baseDir}/scripts/panel_control.mjs '{"action":"resize","panelId":"panel-abc","w":8,"h":5}'

# 更改面板类型
node {baseDir}/scripts/panel_control.mjs '{"action":"changeType","panelId":"panel-abc","panelType":"chart","data":{"chartType":"bar","data":[{"label":"A","value":10}],"xAxis":"名称","yAxis":"数量"}}'

# 设置分类标签
node {baseDir}/scripts/panel_control.mjs '{"action":"setTags","panelId":"panel-abc","tags":["daily","entertainment"]}'

# 标星/取消标星
node {baseDir}/scripts/panel_control.mjs '{"action":"star","panelId":"panel-abc","starred":true}'

# 删除面板
node {baseDir}/scripts/panel_control.mjs '{"action":"delete","panelId":"panel-abc"}'
```

---

## 画布查询 (canvas_query)

```bash
# 列出所有面板
node {baseDir}/scripts/canvas_query.mjs '{"action":"listPanels"}'

# 按类型过滤
node {baseDir}/scripts/canvas_query.mjs '{"action":"listPanels","panelType":"timeline"}'

# 获取面板详情
node {baseDir}/scripts/canvas_query.mjs '{"action":"getPanelDetail","panelId":"panel-xxx"}'
```

---

## 画布控制 (canvas_control)

```bash
# 切换分类 Tab
node {baseDir}/scripts/canvas_control.mjs '{"action":"switchView","view":"work"}'

# 聚焦面板
node {baseDir}/scripts/canvas_control.mjs '{"action":"focusPanel","panelId":"panel-xxx"}'

# 清空画布 (保留固定面板)
node {baseDir}/scripts/canvas_control.mjs '{"action":"clearCanvas","keepPinned":true}'

# 应用布局预设
node {baseDir}/scripts/canvas_control.mjs '{"action":"applyLayout","preset":"grid-2x2"}'

# 精确布局：多面板定位 (18 列网格)
node {baseDir}/scripts/canvas_control.mjs '{"action":"setLayout","layout":[{"panelId":"panel-a","x":0,"y":0,"w":9,"h":4},{"panelId":"panel-b","x":9,"y":0,"w":9,"h":4}]}'
```

**精确布局 (`setLayout`)** — 18 列网格，未列出的面板保持原位：

```
  x=0       x=9
  |         |
  +----9----+----9----+  y=0
  | panel-a | panel-b |  h=4
  +---------+---------+  y=4
  |      panel-c      |  h=3, w=18
  +-------------------+  y=7
```

**布局预设 (`applyLayout`):**

| 预设 | 说明 |
|------|------|
| `focus` | 单面板聚焦 |
| `split` | 左右双栏 |
| `grid-2x2` | 四宫格 |
| `grid-3x3` | 九宫格 |
| `stack` | 垂直堆叠 |
| `kanban` | 看板式多列 |

---

## 分类 Tab 系统

画布顶部 6 个分类 Tab：

| Tab | tag 值 | 说明 |
|-----|--------|------|
| 重要 | `"important"` | 重要面板 |
| 日常 | `"daily"` | 日常生活 |
| 工作 | `"work"` | 工作相关 |
| 娱乐 | `"entertainment"` | 娱乐内容 |
| 其他 | `"other"` 或无 tags | 未分类 |
| 全部 | — | 所有面板 |

面板可同时拥有多个 tags。没有 tags 的面板只在「全部」和「其他」下显示。5 个标签值是固定的，不支持自定义。

**批量分类已有面板:**

```bash
# 1. 查看所有面板
node {baseDir}/scripts/canvas_query.mjs '{"action":"listPanels"}'
# 2. 逐个设置标签
node {baseDir}/scripts/panel_control.mjs '{"action":"setTags","panelId":"panel-weather","tags":["daily"]}'
node {baseDir}/scripts/panel_control.mjs '{"action":"setTags","panelId":"panel-tokens","tags":["work"]}'
# 3. 切换到目标 Tab
node {baseDir}/scripts/canvas_control.mjs '{"action":"switchView","view":"work"}'
```

---

## 实时数据订阅 (realtime_control)

```bash
# 启动轮询订阅
node {baseDir}/scripts/realtime_control.mjs '{"action":"startSubscription","panelId":"panel-xxx","config":{"enabled":true,"source":"polling","url":"https://api.example.com/data","interval":5000,"maxRetries":3}}'

# 停止订阅
node {baseDir}/scripts/realtime_control.mjs '{"action":"stopSubscription","panelId":"panel-xxx"}'

# 调整刷新间隔
node {baseDir}/scripts/realtime_control.mjs '{"action":"setRefreshInterval","panelId":"panel-xxx","interval":10000}'
```

**config 字段:** `enabled` (bool), `source` ("polling"|"websocket"|"file_watch"), `url`, `params` (object), `interval` (ms), `maxRetries`

---

## 主题控制 (theme_control)

```bash
# 查询当前主题和可用主题
node {baseDir}/scripts/theme_control.mjs '{"action":"getTheme"}'

# 切换主题
node {baseDir}/scripts/theme_control.mjs '{"action":"setTheme","theme":"dark"}'

# 注册自定义主题
node {baseDir}/scripts/theme_control.mjs '{"action":"registerTheme","themeName":"ocean","css":".ocean { --background: oklch(0.95 0.02 230); ... }"}'
```

内置主题: light, dark, vintage, doodle, blaze, system。自定义主题 CSS 规范见 [theme-spec.md](references/theme-spec.md)。

---

## 面板类型速查

| 类型 | 用途 | data 关键字段 |
|------|------|--------------|
| text | 富文本/Markdown | summary, content, format |
| table | 行列数据 | columns, rows |
| list | 条目列表 | items |
| chart | 数据图表 | chartType, data, xAxis, yAxis |
| code | 代码块 | language, code |
| image | 图片 | src |
| timeline | 时间轴 | events, viewMode |
| kv | 键值摘要 | items, columns? |
| html | 自定义 HTML | 用 `html` 字段而非 `data` |

完整 Data Schema 见 [panel-schemas.md](references/panel-schemas.md)。HTML Sandbox 详细规范见 [html-sandbox.md](references/html-sandbox.md)。

---

## 尺寸选择指南

| 尺寸 | 用途 | 典型场景 |
|------|------|----------|
| sm | 摘要卡片 | KV 概览、简短列表 |
| md | 标准展示 | 表格、图表、代码 |
| lg | 详细内容 | 长文档、复杂表格 |
| full | 全屏分析 | 大型仪表盘 |

**各类型默认尺寸 (18 列网格, 行高 50px):**

| 类型 | 默认 w | 默认 h |
|------|--------|--------|
| html | 6 | 6 |
| chart/table/timeline | 6 | 5 |
| text/code | 5 | 5 |
| list/image/kv | 4 | 5 |

`layout: {x, y, w, h}` 可在 create/update 时精确控制位置。`resize` 只调整 w/h 不改变 x/y。

---

## canvasState 解读

channel-adapter 每轮注入画布状态：

```json
{
  "pinnedPanels": [
    { "id": "panel-xxx", "type": "list", "title": "待办", "size": "md", "dataSummary": "3 items", "layout": {"x":0,"y":0,"w":4,"h":5}, "starred": true, "tags": ["daily"] }
  ],
  "transientPanels": [...],
  "activeView": "all",
  "archivedCount": 2,
  "currentTheme": "dark",
  "availableThemes": ["light","dark","vintage","doodle","blaze","system"],
  "templates": ["dashboard-card", "report", "kanban", "timeline-vertical"]
}
```

- `pinnedPanels`/`transientPanels`: 面板概要 (不含完整数据，需用 `getPanelDetail` 查看)
- `error` 字段: 面板数据格式无效时出现，应 update 修正
- `activeView`: 当前分类 Tab
- `templates`: 可用 UI 模板 (见 [html-sandbox.md](references/html-sandbox.md))

**策略:** 根据画布已有面板数量决定新面板尺寸 (画布已满时优先 sm)

---

## 面板复用策略 (必须遵守)

**核心原则：更新已有面板，不要重复创建。**

### 操作流程

1. **先检查 canvasState** 中的 pinnedPanels 和 transientPanels
2. **已有同类/同名面板** → `action: "update"` + 该面板的 `panelId`
3. **确认没有相关面板** → 才用 `action: "create"`

### 判断规则

| 情况 | 操作 |
|------|------|
| 有同类面板，需刷新 | `update` + panelId |
| 有同类面板，内容完全不同 | 先 `archive` 旧面板，再 `create` |
| 没有相关面板 | `create` |

**避免泛滥:** 同一轮次不要创建超过 3 个面板，优先合并展示。
