import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useCanvasStore } from '@/stores/canvas-store'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import type { PanelMessage } from '@/types/panel-protocol'

function randomHex(): string {
  return Math.random().toString(16).slice(2, 6)
}

const TEXT_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'text',
  title: 'TextPanel 优化演示',
  subtitle: 'compact layout',
  size: 'md',
  pinned: false,
  zone: 'right',
  tags: ['important'],
  data: {
    summary: '紧凑排版 · 底部渐变 · 精细 Markdown',
    content: [
      '# 洞洞板 TextPanel',
      '',
      '## 设计目标',
      '',
      '信息密度优先 — 在有限面板空间内展示**最大化的可读内容**，同时保持视觉舒适。',
      '',
      '## 核心改进',
      '',
      '### 紧凑排版',
      '- 段间距 `my-1.5`，标题间距 `mt-3 mb-1.5`',
      '- H1 → `text-base`，H2 → `text-sm`，H3 → `text-xs`',
      '- 正文 `13px` + `leading-relaxed`',
      '',
      '### 代码块',
      '',
      '```typescript',
      'interface GridConfig {',
      '  cols: 18        // 18列精细网格',
      '  rowHeight: 50   // 50px行高',
      '  margin: [10, 10]',
      '}',
      '```',
      '',
      '### 引用',
      '',
      '> 好的设计是尽可能少的设计。 — Dieter Rams',
      '',
      '### 表格',
      '',
      '| 属性 | 旧值 | 新值 |',
      '|------|------|------|',
      '| 网格列数 | 12 | **18** |',
      '| 行高 | 60px | **50px** |',
      '| 间距 | 12px | **10px** |',
      '',
      '---',
      '',
      '*双击标题栏可展开完整内容。底部渐变遮罩暗示内容溢出。*',
    ].join('\n'),
    format: 'markdown',
    wordCount: 186,
  },
}

const TABLE_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'table',
  title: '示例数据表',
  size: 'md',
  pinned: false,
  zone: 'right',
  data: {
    columns: [
      { key: 'name', label: '名称', align: 'left' },
      { key: 'value', label: '数值', align: 'right', format: 'number' },
      { key: 'change', label: '变化', align: 'right', format: 'percent' },
    ],
    rows: [
      { name: '产品 A', value: 12500, change: 0.153 },
      { name: '产品 B', value: 8300, change: -0.042 },
      { name: '产品 C', value: 23100, change: 0.287 },
      { name: '产品 D', value: 5600, change: 0.01 },
      { name: '产品 E', value: 17800, change: -0.085 },
    ],
    footer: { name: '合计', value: 67300, change: 0.065 },
  },
}

const LIST_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'list',
  title: '示例列表',
  size: 'sm',
  pinned: false,
  zone: 'right',
  data: {
    items: [
      {
        id: '1',
        title: '待办事项 1',
        subtitle: '高优先级',
        badge: { text: '紧急', color: 'red' },
      },
      {
        id: '2',
        title: '待办事项 2',
        subtitle: '进行中',
        badge: { text: '进行中', color: 'yellow' },
      },
      {
        id: '3',
        title: '待办事项 3',
        subtitle: '已完成',
        badge: { text: '完成', color: 'green' },
      },
      {
        id: '4',
        title: '待办事项 4',
        subtitle: '待评审',
        badge: { text: '评审', color: 'blue' },
      },
      {
        id: '5',
        title: '待办事项 5',
        subtitle: '已归档',
        badge: { text: '归档', color: 'gray' },
      },
    ],
  },
}

const CHART_LINE_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'chart',
  title: '示例线图',
  size: 'md',
  pinned: false,
  zone: 'right',
  data: {
    chartType: 'line',
    xAxis: 'month',
    data: [
      { label: '1月', value: 120, series: '销售额' },
      { label: '2月', value: 190, series: '销售额' },
      { label: '3月', value: 300, series: '销售额' },
      { label: '4月', value: 250, series: '销售额' },
      { label: '5月', value: 420, series: '销售额' },
      { label: '1月', value: 40, series: '利润' },
      { label: '2月', value: 80, series: '利润' },
      { label: '3月', value: 150, series: '利润' },
      { label: '4月', value: 100, series: '利润' },
      { label: '5月', value: 200, series: '利润' },
    ],
  },
}

const CHART_BAR_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'chart',
  title: '示例柱图',
  size: 'md',
  pinned: false,
  zone: 'right',
  data: {
    chartType: 'bar',
    xAxis: 'quarter',
    data: [
      { label: 'Q1', value: 3200, series: '收入' },
      { label: 'Q2', value: 4100, series: '收入' },
      { label: 'Q3', value: 3800, series: '收入' },
      { label: 'Q4', value: 5200, series: '收入' },
      { label: 'Q1', value: 2100, series: '支出' },
      { label: 'Q2', value: 2800, series: '支出' },
      { label: 'Q3', value: 2500, series: '支出' },
      { label: 'Q4', value: 3100, series: '支出' },
    ],
  },
}

const CODE_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'code',
  title: '示例代码',
  size: 'md',
  pinned: false,
  zone: 'right',
  data: {
    language: 'typescript',
    filename: 'example.ts',
    code: `interface User {\n  id: string\n  name: string\n  email: string\n}\n\nfunction greet(user: User): string {\n  return \`Hello, \${user.name}!\`\n}\n\nconst user: User = {\n  id: '1',\n  name: 'Alice',\n  email: 'alice@example.com',\n}\n\nconsole.log(greet(user))`,
  },
}

const IMAGE_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'image',
  title: '示例图片',
  size: 'sm',
  pinned: false,
  zone: 'right',
  data: {
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iIzMzODhmZiIgcng9IjEyIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IndoaXRlIiBmb250LXNpemU9IjIwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuMzVlbSI+U2FtcGxlPC90ZXh0Pjwvc3ZnPg==',
    alt: '示例 SVG 图片',
  },
}

const TIMELINE_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'timeline',
  title: '示例时间轴',
  size: 'md',
  pinned: false,
  zone: 'right',
  data: {
    viewMode: 'day',
    events: [
      { id: 'evt-1', date: '2025-01-15T09:00:00', title: '项目启动', description: '召开项目启动会议', color: '#3b82f6' },
      { id: 'evt-2', date: '2025-02-01T14:00:00', title: '原型评审', description: '完成 UI 原型设计评审', color: '#f59e0b' },
      { id: 'evt-3', date: '2025-03-10T10:00:00', title: '发布上线', description: '正式发布 v1.0', color: '#22c55e' },
    ],
  },
}

const KV_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'kv',
  title: 'KV 面板优化演示',
  size: 'sm',
  pinned: false,
  zone: 'right',
  tags: ['work'],
  data: {
    items: [
      { key: '名称', value: 'PegBoard' },
      { key: '版本', value: 'v2.0.0' },
      { key: '状态', value: '运行中', type: 'status', status: 'success' },
      { key: '框架', value: 'Tauri v2 + React 19' },
      { key: '网格', value: '18', type: 'number' },
      { key: '文档', value: 'docs.pegboard.dev', type: 'link' },
    ],
  },
}

const HTML_TEMPLATE: PanelMessage = {
  action: 'create',
  panelId: '',
  panelType: 'text' as PanelMessage['panelType'],
  title: '示例 HTML',
  size: 'md',
  pinned: false,
  zone: 'right',
  html: '<div class="card"><h2>Hello HTML</h2><p>This panel is rendered in a sandbox iframe.</p><button onclick="this.textContent=\'Clicked!\'">Click me</button></div>',
  css: '.card { padding: 20px; font-family: sans-serif; } .card h2 { color: #3388ff; margin-bottom: 8px; } button { margin-top: 12px; padding: 6px 16px; border-radius: 6px; border: 1px solid #ccc; cursor: pointer; }',
}

function injectTemplate(template: PanelMessage, prefix: string): PanelMessage {
  return {
    ...template,
    panelId: `${prefix}-${randomHex()}`,
  }
}

const THEME_CYCLE: Array<'light' | 'dark' | 'vintage' | 'doodle' | 'blaze' | 'system'> = ['light', 'dark', 'vintage', 'doodle', 'blaze', 'system']
const THEME_LABELS: Record<string, string> = {
  light: '浅色',
  dark: '深色',
  vintage: '典藏',
  doodle: '涂鸦',
  blaze: '橙黑',
  system: '系统',
}

export function DevMockPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createPanel = useCanvasStore((s) => s.createPanel)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const { theme, setTheme } = useTheme()
  const streamingRef = useRef(false)

  // Cmd+Shift+D toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        setIsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleInject = useCallback(() => {
    setError(null)
    try {
      const parsed = JSON.parse(jsonInput) as PanelMessage
      if (!parsed.panelId || !parsed.action) {
        setError('JSON 必须包含 panelId 和 action 字段')
        return
      }
      createPanel(parsed)
      setJsonInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '无效的 JSON')
    }
  }, [jsonInput, createPanel])

  const handleQuickCreate = useCallback(
    (template: PanelMessage, prefix: string) => {
      const msg = injectTemplate(template, prefix)
      createPanel(msg)
    },
    [createPanel],
  )

  const handleCycleTheme = useCallback(() => {
    const idx = THEME_CYCLE.indexOf(theme as typeof THEME_CYCLE[number])
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]!
    setTheme(next)
  }, [theme, setTheme])

  const handleStreamSimulation = useCallback(async () => {
    if (streamingRef.current) return
    streamingRef.current = true

    const panelId = `dev-stream-${randomHex()}`

    try {
      // stream_start
      await invoke('send_ws_message', {
        message: JSON.stringify({
          action: 'create',
          panelId,
          panelType: 'text',
          title: '流式内容',
          size: 'md',
          pinned: false,
          zone: 'right',
          data: {
            content: '',
            format: 'markdown',
            streaming: true,
          },
        }),
      })

      const chunks = [
        '# 流式演示\n\n',
        '这是**第一段**内容，正在逐步加载...\n\n',
        '- 数据加载完成\n- 分析完成\n- 结果输出完成\n\n> 流式传输结束。',
      ]

      for (let i = 0; i < chunks.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        await invoke('send_ws_message', {
          message: JSON.stringify({
            action: 'update',
            panelId,
            panelType: 'text',
            pinned: false,
            zone: 'right',
            data: {
              content: chunks.slice(0, i + 1).join(''),
              format: 'markdown',
              streaming: i < chunks.length - 1,
            },
          }),
        })
      }
    } catch (err) {
      console.error('[DevMockPanel] Stream simulation error:', err)
    } finally {
      streamingRef.current = false
    }
  }, [])

  const handleClearCanvas = useCallback(() => {
    clearCanvas(true)
  }, [clearCanvas])

  // Read canvas state for preview (select stable refs, derive snapshot via useMemo)
  const panels = useCanvasStore((s) => s.panels)
  const activeLayout = useCanvasStore((s) => s.activeLayout)
  const archivedPanels = useCanvasStore((s) => s.archivedPanels)

  const canvasState = useMemo(() => {
    const pinnedPanels = panels
      .filter((p) => p.pinned)
      .map((p) => ({ id: p.panelId, type: p.panelType, title: p.title, size: p.size }))
    const transientPanels = panels
      .filter((p) => !p.pinned)
      .map((p) => ({ id: p.panelId, type: p.panelType, title: p.title }))
    return { pinnedPanels, transientPanels, layoutMode: activeLayout, archivedCount: archivedPanels.length }
  }, [panels, activeLayout, archivedPanels])

  if (!isOpen) return null

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-h-[calc(100vh-2rem)] bg-background border rounded-lg shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-semibold">Dev Mock Panel</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsOpen(false)}
        >
          ×
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* JSON Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Panel Protocol JSON
          </label>
          <textarea
            className="w-full h-32 p-2 text-xs font-mono bg-muted border rounded resize-y"
            placeholder='{"action":"create","panelId":"...","panelType":"text",...}'
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
          {error && (
            <div className="text-xs text-red-500">{error}</div>
          )}
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={handleInject}
          >
            注入
          </Button>
        </div>

        {/* Quick Create Buttons */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            快速创建
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(TEXT_TEMPLATE, 'dev-text')}
            >
              文本
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(TABLE_TEMPLATE, 'dev-table')}
            >
              表格
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(LIST_TEMPLATE, 'dev-list')}
            >
              列表
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(CHART_LINE_TEMPLATE, 'dev-chart-line')}
            >
              线图
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(CHART_BAR_TEMPLATE, 'dev-chart-bar')}
            >
              柱图
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(CODE_TEMPLATE, 'dev-code')}
            >
              代码
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(IMAGE_TEMPLATE, 'dev-image')}
            >
              图片
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(TIMELINE_TEMPLATE, 'dev-timeline')}
            >
              时间轴
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(KV_TEMPLATE, 'dev-kv')}
            >
              KV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickCreate(HTML_TEMPLATE, 'dev-html')}
            >
              HTML
            </Button>
          </div>
        </div>

        {/* Utility Buttons */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            工具
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCycleTheme}
            >
              🎨 切换主题 ({THEME_LABELS[theme]})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStreamSimulation}
            >
              📡 模拟流式
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCanvas}
            >
              🗑️ 清空画布
            </Button>
          </div>
        </div>

        {/* Canvas State Preview */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Canvas State
          </div>
          <pre className="p-2 bg-muted rounded text-xs overflow-auto max-h-48 font-mono">
            {JSON.stringify(canvasState, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
