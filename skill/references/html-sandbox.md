# HTML Sandbox 规范

## 双轨渲染

PegBoard 有两种渲染轨道：

1. **结构化渲染** (`data` 字段) — 使用 `panelType` 对应的 React 组件
2. **HTML Sandbox 渲染** (`html` 字段) — iframe 沙箱渲染自定义 HTML

**规则：`html` 字段优先于 `panelType`。** 只要消息包含 `html` 字段，就走 sandbox 渲染。

## 何时使用 HTML 面板

优先使用原生结构化面板（text/table/list/chart/code/image/timeline/kv）。HTML 面板仅用于：
- 自定义交互（游戏、拖拽、动画）
- 自定义样式布局（8 种结构化类型无法满足）
- Canvas/SVG 绑定等浏览器 API

## 创建方式

```bash
node {baseDir}/scripts/panel_control.mjs '{"action":"create","panelType":"html","title":"贪吃蛇","size":"lg","html":"<canvas id=\"game\" width=\"400\" height=\"400\"></canvas><script>/* 游戏逻辑 */</script>","css":"body { margin: 0; display: flex; justify-content: center; }"}'
```

## 关键约束

- **必须用 `html` 字段**，不是 `data.content`（放到 data.content 会被当纯文本）
- **`panelType` 设为 `"html"`**
- **HTML 必须完全内联** — 所有 CSS/JS/资源写在 `html` 字符串内
- **禁止外部资源** — 无 `<script src>`, `<link href>`, `<iframe src>`
- **禁止 iframe 嵌套** — html 字段本身渲染到 iframe 中
- 可选 `css` 字段传入额外样式

## 设计约束

### 允许
- Tailwind CSS 类名（sandbox 已注入）
- 内联样式
- SVG 图标
- CSS 动画

### 配色 — 使用 CSS 变量跟随主题

| 变量 | 用途 |
|------|------|
| `var(--color-background)` | 背景 |
| `var(--color-foreground)` | 前景文字 |
| `var(--color-muted)` | 次要背景 |
| `var(--color-muted-foreground)` | 次要文字 |
| `var(--color-primary)` | 主色 |
| `var(--color-border)` | 边框 |
| `var(--color-card)` | 卡片背景 |
| `var(--color-popover)` | 弹出层背景 |
| `var(--color-accent)` | 强调色 |

### 禁止
- 外部 CDN 资源
- `<form>` 提交 / `<a>` 外部链接
- `window.location` 跳转
- `localStorage` / `sessionStorage`
- `fetch()` / `XMLHttpRequest`

### 结构要求
- 简洁 HTML，max 5 层嵌套
- 合理使用 flex/grid 布局

## UI 模板

可用模板（通过 `canvasState.templates` 获取列表）：

| 模板 | 描述 | 适用场景 |
|------|------|----------|
| dashboard-card | 数字指标展示卡片 | KPI 仪表盘、数据概览 |
| report | 标题+表格+摘要 | 数据报表、分析总结 |
| kanban | 多列看板卡片 | 任务管理、流程可视化 |
| timeline-vertical | 纵向时间轴 | 事件记录、项目进度 |

模板文件位于 `assets/templates/<name>/`，包含 `meta.json`, `template.html`, `style.css`。Agent 可参考模板设计创建 HTML 面板，也可自由创建全新设计。
