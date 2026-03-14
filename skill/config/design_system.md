# HTML 面板设计约束

## 允许
- Tailwind CSS 类名
- 内联样式
- SVG 图标
- CSS 动画

## 配色
跟随系统主题，使用 CSS 变量 (Tailwind v4 OKLCH 格式):
- `var(--color-background)` — 背景
- `var(--color-foreground)` — 前景文字
- `var(--color-muted)` — 次要背景
- `var(--color-muted-foreground)` — 次要文字
- `var(--color-primary)` — 主色
- `var(--color-border)` — 边框
- `var(--color-card)` — 卡片背景
- `var(--color-popover)` — 弹出层背景
- `var(--color-accent)` — 强调色

## 禁止
- 外部 CDN 资源 (script, link, img src=https://)
- `<form>` 提交
- `<a>` 外部链接
- `window.location` 跳转
- `localStorage` / `sessionStorage`
- `fetch()` / `XMLHttpRequest`

## 结构要求
- 简洁 HTML 结构
- 避免深层嵌套 (max 5 层)
- 合理使用 flex/grid 布局
