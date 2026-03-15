# Theme Specification

## 内置主题

| 主题 | 风格 |
|------|------|
| light | 默认浅色 (霜白) |
| dark | 碳纤维深色 (青色点缀) |
| vintage | 档案馆 (衬线字体、亚麻纸纹理) |
| doodle | 手绘涂鸦风 |
| blaze | 火焰 |
| system | 跟随系统 (light/dark) |

## 自定义主题 CSS 规范

注册自定义主题时，CSS 必须以 `.themeName { }` 包裹，内部定义 CSS 变量。

### 必须定义的核心变量

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

可额外添加组件样式覆盖（面板 `[data-panel]`、侧边栏、画布背景 `[data-app-shell]` 等）。推荐使用 oklch 色值以保证色彩一致性。

## 示例：注册并切换自定义主题

```bash
# 注册
node {baseDir}/scripts/theme_control.mjs '{"action":"registerTheme","themeName":"ocean","css":".ocean { --background: oklch(0.95 0.02 230); --foreground: oklch(0.20 0.02 230); --card: oklch(0.97 0.015 230); --card-foreground: oklch(0.20 0.02 230); --primary: oklch(0.60 0.15 230); --primary-foreground: oklch(0.98 0.005 230); }"}'

# 切换
node {baseDir}/scripts/theme_control.mjs '{"action":"setTheme","theme":"ocean"}'
```
