import { sendWsMessage } from './ws-helper.mjs'

/**
 * Panel control tool - Create, update, archive, or delete panels on PegBoard canvas.
 * Usage: node panel_control.mjs '{"action":"create","panelType":"text","title":"标题","data":{"content":"内容"}}'
 */

// Tool definition (for documentation)
export const panelControlTool = {
  name: "panel_control",
  description: "在画布上创建、更新、归档或删除面板。创建时必须提供 panelType+data 或 html 其一。可通过 tags 指定面板所属分类 Tab。",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ["create", "update", "archive", "delete", "resize", "changeType", "star", "setTags"],
        description: "操作类型",
      },
      panelId: {
        type: "string",
        description: "面板唯一 ID。create 时可选 (自动生成), 其他操作必填",
      },
      panelType: {
        type: "string",
        enum: ["text", "table", "list", "chart", "code", "image", "timeline", "kv", "html"],
        description: "面板类型。使用固定面板轨道时必填",
      },
      pinned: {
        type: "boolean",
        description: "是否固定到左侧固定区，默认 false",
      },
      title: {
        type: "string",
        description: "面板标题",
      },
      subtitle: {
        type: "string",
        description: "面板副标题 (可选)",
      },
      size: {
        type: "string",
        enum: ["sm", "md", "lg", "full"],
        description: "面板尺寸，默认 md",
      },
      data: {
        type: "object",
        description: "面板数据，结构取决于 panelType。各类型顶层字段: text→{summary,content,format}, table→{columns,rows}, list→{items}, chart→{chartType,data,xAxis,yAxis}, code→{language,code}, image→{src}, timeline→{events,viewMode}, kv→{items,columns?}。详见 panel_types.json 中的 dataExample",
      },
      html: {
        type: "string",
        description: "自定义 HTML 内容 (临时面板轨道)",
      },
      css: {
        type: "string",
        description: "自定义 CSS 样式 (配合 html 使用)",
      },
      patch: {
        type: "array",
        description: "JSON Patch 数组 (action=update 时的增量更新)",
      },
      meta: {
        type: "object",
        description: "元数据 (source, ttl, priority)",
      },
      w: {
        type: "number",
        description: "网格宽度 1-18 列 (resize 时使用)",
      },
      h: {
        type: "number",
        description: "网格高度 1-18 行 (resize 时使用)",
      },
      starred: {
        type: "boolean",
        description: "是否标星 (star 时使用)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "面板分类标签。可选值: important, daily, work, entertainment, other。一个面板可有多个标签。create 时设置初始分类，setTags 时更新分类。",
      },
      layout: {
        type: "object",
        description: "布局位置 {x, y, w, h}，create/update 时可选指定面板位置和大小",
        properties: {
          x: { type: "number", description: "网格列坐标 (0-17)" },
          y: { type: "number", description: "网格行坐标 (0+)" },
          w: { type: "number", description: "网格宽度 (1-18)" },
          h: { type: "number", description: "网格高度 (1-18)" },
        },
      },
    },
  },
}

// Execute function — sends panel action via WebSocket to the Tauri app
export async function execute(params) {
  const panelId = params.panelId || `panel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  // Validate resize parameters
  if (params.action === 'resize') {
    if (!params.panelId) return JSON.stringify({ ok: false, error: 'panelId is required for resize' })
    if (params.w === undefined || params.h === undefined) return JSON.stringify({ ok: false, error: 'w and h are required for resize' })
    if (params.w < 1 || params.w > 18 || params.h < 1 || params.h > 18) return JSON.stringify({ ok: false, error: 'w and h must be between 1 and 18' })
  }

  // Validate changeType parameters
  if (params.action === 'changeType') {
    if (!params.panelId) return JSON.stringify({ ok: false, error: 'panelId is required for changeType' })
    if (!params.panelType) return JSON.stringify({ ok: false, error: 'panelType is required for changeType' })
  }

  // Validate star parameters
  if (params.action === 'star') {
    if (!params.panelId) return JSON.stringify({ ok: false, error: 'panelId is required for star' })
    if (params.starred === undefined) return JSON.stringify({ ok: false, error: 'starred is required for star' })
  }

  // Validate setTags parameters
  if (params.action === 'setTags') {
    if (!params.panelId) return JSON.stringify({ ok: false, error: 'panelId is required for setTags' })
    if (!Array.isArray(params.tags)) return JSON.stringify({ ok: false, error: 'tags array is required for setTags' })
  }

  const panelPayload = {
    action: params.action,
    panelId,
    panelType: params.panelType,
    pinned: params.pinned ?? false,
    zone: params.pinned ? 'left' : 'right',
    title: params.title,
    subtitle: params.subtitle,
    size: params.size ?? 'md',
    data: params.data,
    html: params.html,
    css: params.css,
    patch: params.patch,
    meta: params.meta,
  }

  // Add tags for create/setTags
  if (params.tags !== undefined) {
    panelPayload.tags = params.tags
  }

  // Add resize fields
  if (params.action === 'resize') {
    panelPayload.w = params.w
    panelPayload.h = params.h
  }

  // Add star field
  if (params.action === 'star') {
    panelPayload.starred = params.starred
  }

  // Add layout field for create/update
  if (params.layout && (params.action === 'create' || params.action === 'update')) {
    panelPayload.layout = params.layout
  }

  const message = {
    type: 'panel_action',
    panels: [panelPayload],
  }

  await sendWsMessage(message)

  return JSON.stringify({ ok: true, action: params.action, panelId })
}

// CLI entry point
if (process.argv[1]?.endsWith('panel_control.mjs')) {
  const paramsJson = process.argv[2]
  if (!paramsJson) {
    console.error('Usage: node panel_control.mjs \'{"action":"create","panelType":"text","title":"标题","data":{"content":"内容"}}\'')
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
