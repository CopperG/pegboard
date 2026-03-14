import { sendWsQuery } from '../lib/ws-helper.mjs'

/**
 * Canvas query tool - List panels or get panel details.
 * Usage: 
 *   node canvas_query.mjs '{"action":"listPanels"}'
 *   node canvas_query.mjs '{"action":"getPanelDetail","panelId":"panel-xxx"}'
 */

// Tool definition (for documentation)
export const canvasQueryTool = {
  name: "canvas_query",
  description: "查询画布上的面板信息。listPanels 返回所有面板概要 (可按类型过滤)；getPanelDetail 返回指定面板的完整数据。",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ["listPanels", "getPanelDetail"],
        description: "查询类型：listPanels=列出面板概要，getPanelDetail=获取面板完整数据",
      },
      panelType: {
        type: "string",
        enum: ["text", "table", "list", "chart", "code", "image", "timeline", "kv", "html"],
        description: "按面板类型过滤 (仅 listPanels 时使用，可选)",
      },
      panelId: {
        type: "string",
        description: "目标面板 ID (getPanelDetail 时必填)",
      },
    },
  },
}

// Execute function
export async function execute(params) {
  const { action, panelType, panelId } = params

  try {
    if (action === 'listPanels') {
      return await listPanels(panelType)
    }

    if (action === 'getPanelDetail') {
      if (!panelId) {
        return JSON.stringify({ error: 'getPanelDetail 需要提供 panelId' })
      }
      return await getPanelDetail(panelId)
    }

    return JSON.stringify({ error: `未知操作：${action}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return JSON.stringify({ error: `画布查询失败：${msg}。请确认 PegBoard 桌面应用是否正在运行。` })
  }
}

async function listPanels(filterType) {
  const response = await sendWsQuery(
    { type: 'get_canvas_state' },
    'canvas_state_response',
  )

  const canvasState = response.canvasState || {}
  const pinnedPanels = canvasState.pinnedPanels || []
  const transientPanels = canvasState.transientPanels || []

  const allPanels = [
    ...pinnedPanels.map((p) => ({ ...p, pinned: true })),
    ...transientPanels.map((p) => ({ ...p, pinned: false })),
  ]

  const filtered = filterType
    ? allPanels.filter((p) => p.type === filterType)
    : allPanels

  return JSON.stringify({
    panels: filtered,
    total: filtered.length,
    archivedCount: canvasState.archivedCount || 0,
    activeView: canvasState.activeView || 'all',
  })
}

async function getPanelDetail(panelId) {
  const response = await sendWsQuery(
    { type: 'get_panel_detail', panelId },
    'panel_detail_response',
  )

  if (response.error) {
    return JSON.stringify({ error: response.error, panelId })
  }

  return JSON.stringify({ panelId, panel: response.panel })
}

// CLI entry point
if (process.argv[1]?.endsWith('canvas_query.mjs')) {
  const paramsJson = process.argv[2]
  if (!paramsJson) {
    console.error('Usage:')
    console.error('  node canvas_query.mjs \'{"action":"listPanels"}\'')
    console.error('  node canvas_query.mjs \'{"action":"getPanelDetail","panelId":"panel-xxx"}\'')
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
