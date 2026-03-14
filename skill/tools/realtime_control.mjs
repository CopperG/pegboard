import { sendWsMessage } from '../lib/ws-helper.mjs'

/**
 * Realtime control tool - Manage panel realtime data subscriptions.
 * Usage: node realtime_control.mjs '{"action":"startSubscription","panelId":"abc","config":{...}}'
 */

// Tool definition (for documentation)
export const realtimeControlTool = {
  name: "realtime_control",
  description: "管理面板实时数据订阅：启动、停止订阅，或调整刷新间隔。",
  parameters: {
    type: "object",
    required: ["action", "panelId"],
    properties: {
      action: {
        type: "string",
        enum: ["startSubscription", "stopSubscription", "setRefreshInterval"],
        description: "操作类型",
      },
      panelId: {
        type: "string",
        description: "目标面板 ID",
      },
      config: {
        type: "object",
        description: "RealtimeConfig 对象 (startSubscription 时使用)",
        properties: {
          enabled: { type: "boolean" },
          source: { type: "string", enum: ["polling", "websocket", "file_watch"] },
          url: { type: "string" },
          params: { type: "object" },
          interval: { type: "number" },
          maxRetries: { type: "number" },
        },
      },
      interval: {
        type: "number",
        description: "刷新间隔（毫秒）(setRefreshInterval 时使用)",
      },
    },
  },
}

// Execute function — sends realtime control action via WebSocket to the Tauri app
export async function execute(params) {
  const { action, panelId, config, interval } = params

  switch (action) {
    case 'startSubscription': {
      if (!config) {
        throw new Error('config is required for startSubscription')
      }
      const message = {
        type: 'realtime_control',
        action: 'start',
        panelId,
        config,
      }
      await sendWsMessage(message)
      return `已启动面板 ${panelId} 的 ${config.source || 'polling'} 实时订阅`
    }
    case 'stopSubscription': {
      const message = {
        type: 'realtime_control',
        action: 'stop',
        panelId,
      }
      await sendWsMessage(message)
      return `已停止面板 ${panelId} 的实时订阅`
    }
    case 'setRefreshInterval': {
      if (interval === undefined) {
        throw new Error('interval is required for setRefreshInterval')
      }
      const message = {
        type: 'realtime_control',
        action: 'set_interval',
        panelId,
        interval,
      }
      await sendWsMessage(message)
      return `已将面板 ${panelId} 的刷新间隔设置为 ${interval}ms`
    }
    default:
      return `未知操作: ${action}`
  }
}

// CLI entry point
if (process.argv[1]?.endsWith('realtime_control.mjs')) {
  const paramsJson = process.argv[2]
  if (!paramsJson) {
    console.error('Usage: node realtime_control.mjs \'{"action":"startSubscription","panelId":"abc","config":{...}}\'')
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
