import { sendWsMessage } from '../lib/ws-helper.mjs'

/**
 * Canvas control tool - Control canvas view: switch view mode, focus panel, expand panel, rearrange panels, clear canvas.
 * Usage: node canvas_control.mjs '{"action":"switchView","view":"all"}'
 */

// Tool definition (for documentation)
export const canvasControlTool = {
  name: "canvas_control",
  description: "控制画布视图：切换视图模式、聚焦面板、展开面板、重排面板、清空画布。",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ["switchView", "focusPanel", "expandPanel", "rearrangePanels", "clearCanvas", "applyLayout", "setLayout"],
        description: "操作类型",
      },
      view: {
        type: "string",
        enum: ["important", "daily", "work", "entertainment", "other", "all"],
        description: "分类视图 Tab (switchView 时使用)。对应分类: 重要/日常/工作/娱乐/其他/全部",
      },
      panelId: {
        type: "string",
        description: "目标面板 ID (focusPanel/expandPanel 时使用)",
      },
      arrangement: {
        type: "array",
        description: "面板排列 [{panelId, position}] (rearrangePanels 时使用)",
      },
      keepPinned: {
        type: "boolean",
        description: "清空画布时是否保留固定面板，默认 true",
      },
      preset: {
        type: "string",
        enum: ["focus", "split", "grid-2x2", "grid-3x3", "stack", "kanban"],
        description: "布局预设 ID (applyLayout 时使用)",
      },
      layout: {
        type: "array",
        description: "面板布局数组 [{panelId, x, y, w, h}] (setLayout 时使用)。18 列网格，行数无限。未列出的面板保持原位。",
        items: {
          type: "object",
          required: ["panelId", "x", "y", "w", "h"],
          properties: {
            panelId: { type: "string", description: "面板 ID" },
            x: { type: "number", description: "网格列坐标 (0-17)" },
            y: { type: "number", description: "网格行坐标 (0+)" },
            w: { type: "number", description: "网格宽度 (1-18)" },
            h: { type: "number", description: "网格高度 (1-18)" },
          },
        },
      },
    },
  },
}

// Execute function — sends canvas control action via WebSocket to the Tauri app
export async function execute(params) {
  const message = {
    type: 'canvas_control',
    action: params.action,
  }

  // Attach optional parameters based on action
  if (params.view !== undefined) message.view = params.view
  if (params.panelId !== undefined) message.panelId = params.panelId
  if (params.arrangement !== undefined) message.arrangement = params.arrangement
  if (params.keepPinned !== undefined) message.keepPinned = params.keepPinned
  if (params.preset !== undefined) message.preset = params.preset
  if (params.layout !== undefined) message.layout = params.layout

  return sendWsMessage(message)
}

// CLI entry point
if (process.argv[1]?.endsWith('canvas_control.mjs')) {
  const paramsJson = process.argv[2]
  if (!paramsJson) {
    console.error('Usage: node canvas_control.mjs \'{"action":"switchView","view":"all"}\'')
    process.exit(1)
  }
  
  try {
    const params = JSON.parse(paramsJson)
    const result = await execute(params)
    console.log(result)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}
