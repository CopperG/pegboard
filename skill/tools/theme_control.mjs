import { sendWsMessage, sendWsQuery } from '../lib/ws-helper.mjs'

/**
 * Theme control tool - Query, switch, or register themes on PegBoard.
 * Usage:
 *   node theme_control.mjs '{"action":"getTheme"}'
 *   node theme_control.mjs '{"action":"setTheme","theme":"dark"}'
 *   node theme_control.mjs '{"action":"registerTheme","themeName":"ocean","css":".ocean { ... }"}'
 */

// Tool definition (for documentation)
export const themeControlTool = {
  name: "theme_control",
  description: "查询当前主题、切换主题、或注册自定义主题。注册主题时需提供完整 CSS，遵循 CSS 变量规范。",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ["getTheme", "setTheme", "registerTheme"],
        description: "操作类型：getTheme=查询当前主题和可用主题列表，setTheme=切换主题，registerTheme=注册自定义主题",
      },
      theme: {
        type: "string",
        description: "目标主题名称 (setTheme 时必填)。内置主题: light, dark, vintage, doodle, blaze, system。也可使用 registerTheme 注册的自定义主题名",
      },
      themeName: {
        type: "string",
        description: "自定义主题名称 (registerTheme 时必填)。用作 CSS 类名，建议用小写字母+连字符 (如 ocean-breeze)",
      },
      css: {
        type: "string",
        description: "自定义主题 CSS (registerTheme 时必填)。必须以 .themeName { } 包裹 CSS 变量定义，可额外包含组件样式覆盖",
      },
    },
  },
}

// Execute function
export async function execute(params) {
  const { action } = params

  try {
    if (action === 'getTheme') {
      return await getTheme()
    }

    if (action === 'setTheme') {
      if (!params.theme) {
        return JSON.stringify({ ok: false, error: 'setTheme 需要提供 theme 参数' })
      }
      return await setTheme(params.theme)
    }

    if (action === 'registerTheme') {
      if (!params.themeName) {
        return JSON.stringify({ ok: false, error: 'registerTheme 需要提供 themeName 参数' })
      }
      if (!params.css) {
        return JSON.stringify({ ok: false, error: 'registerTheme 需要提供 css 参数' })
      }
      return await registerTheme(params.themeName, params.css)
    }

    return JSON.stringify({ ok: false, error: `未知操作：${action}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return JSON.stringify({ ok: false, error: `主题操作失败：${msg}。请确认 PegBoard 桌面应用是否正在运行。` })
  }
}

async function getTheme() {
  const response = await sendWsQuery(
    { type: 'get_canvas_state' },
    'canvas_state_response',
  )

  const canvasState = response.canvasState || {}

  return JSON.stringify({
    ok: true,
    currentTheme: canvasState.currentTheme || 'system',
    availableThemes: canvasState.availableThemes || [],
  })
}

async function setTheme(theme) {
  await sendWsMessage({
    type: 'app_control',
    action: 'setTheme',
    theme,
  })

  return JSON.stringify({ ok: true, action: 'setTheme', theme })
}

async function registerTheme(themeName, css) {
  await sendWsMessage({
    type: 'app_control',
    action: 'registerTheme',
    themeName,
    css,
  })

  return JSON.stringify({ ok: true, action: 'registerTheme', themeName })
}

// CLI entry point
if (process.argv[1]?.endsWith('theme_control.mjs')) {
  const paramsJson = process.argv[2]
  if (!paramsJson) {
    console.error('Usage:')
    console.error('  node theme_control.mjs \'{"action":"getTheme"}\'')
    console.error('  node theme_control.mjs \'{"action":"setTheme","theme":"dark"}\'')
    console.error('  node theme_control.mjs \'{"action":"registerTheme","themeName":"ocean","css":".ocean { --background: ... }"}\'')
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
