import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useConnectionStore } from '@/stores/connection-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useChatStore } from '@/stores/chat-store'
import { deserializeMessage } from '@/lib/ws-protocol'
import type {
  AgentResponse,
  PanelActionMessage,
  StreamStart,
  StreamChunk,
  StreamEnd,
  CanvasControlMessage,
  AppControlMessage,
  RealtimeControlMessage,
} from '@/types/websocket'
import type { PanelMessage } from '@/types/panel-protocol'
import { realtimeManager } from '@/lib/realtime-manager'
import { toast } from 'sonner'

// SECURITY: Sanitize CSS before injecting into the DOM via registerTheme
function sanitizeThemeCSS(css: string): string {
  // Remove potentially dangerous CSS patterns
  const dangerous = [
    /expression\s*\(/gi,           // IE CSS expressions
    /javascript\s*:/gi,            // javascript: URLs
    /url\s*\(\s*['"]?\s*data:/gi,  // data: URLs (can exfiltrate)
    /@import/gi,                   // external imports
    /behavior\s*:/gi,              // IE behaviors
    /-moz-binding/gi,              // Mozilla XBL
    /url\s*\(\s*['"]?\s*https?:/gi, // External URL requests (prevent exfiltration)
  ]
  let sanitized = css
  for (const pattern of dangerous) {
    sanitized = sanitized.replace(pattern, '/* blocked */')
  }
  // Limit CSS size to 100KB
  if (sanitized.length > 100 * 1024) {
    sanitized = sanitized.slice(0, 100 * 1024)
  }
  return sanitized
}

export function useWebSocket() {
  const setStatus = useConnectionStore((s) => s.setStatus)
  const resetReconnectAttempts = useConnectionStore(
    (s) => s.resetReconnectAttempts,
  )
  const createPanel = useCanvasStore((s) => s.createPanel)
  const updatePanel = useCanvasStore((s) => s.updatePanel)
  const patchPanel = useCanvasStore((s) => s.patchPanel)
  const archivePanel = useCanvasStore((s) => s.archivePanel)
  const switchView = useCanvasStore((s) => s.switchView)
  const expandPanel = useCanvasStore((s) => s.expandPanel)
  const focusPanel = useCanvasStore((s) => s.focusPanel)
  const rearrangePanels = useCanvasStore((s) => s.rearrangePanels)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const addMessage = useChatStore((s) => s.addMessage)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const appendToLastMessage = useChatStore((s) => s.appendToLastMessage)

  // Timer refs for reconnection and disconnect debounce
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disconnectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Grace period before showing "disconnected" — handles ephemeral skill connections
  const DISCONNECT_DEBOUNCE_MS = 3000

  useEffect(() => {
    // Listen for WS messages from Rust backend
    const unlistenMsg = listen<string>('ws-message', (event) => {
      const msg = deserializeMessage(event.payload)
      if (!msg) return

      switch (msg.type) {
        case 'response':
          handleAgentResponse(msg as AgentResponse)
          break
        case 'panel_action':
          handlePanelAction(msg as PanelActionMessage)
          break
        case 'stream_start':
          handleStreamStart(msg as StreamStart)
          break
        case 'stream_chunk':
          handleStreamChunk(msg as StreamChunk)
          break
        case 'stream_end':
          handleStreamEnd(msg as StreamEnd)
          break
        case 'canvas_control':
          handleCanvasControl(msg as CanvasControlMessage)
          break
        case 'app_control':
          handleAppControl(msg as AppControlMessage)
          break
        case 'realtime_control':
          handleRealtimeControl(msg as RealtimeControlMessage)
          break
      }
    })

    // Listen for WS status changes
    const unlistenStatus = listen<{ status: string }>(
      'ws-status-change',
      (event) => {
        const { status } = event.payload
        if (status === 'connected') {
          // Cancel any pending disconnect debounce
          if (disconnectDebounceRef.current) {
            clearTimeout(disconnectDebounceRef.current)
            disconnectDebounceRef.current = null
          }
          setStatus('connected')
          resetReconnectAttempts()
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
          }
        } else if (status === 'disconnected') {
          // Debounce: wait before showing disconnected.
          // OpenClaw skill uses ephemeral connections (connect→send→close),
          // so we wait to avoid status flicker.
          if (disconnectDebounceRef.current) {
            clearTimeout(disconnectDebounceRef.current)
          }
          disconnectDebounceRef.current = setTimeout(() => {
            disconnectDebounceRef.current = null
            setStatus('disconnected')
            startReconnect()
          }, DISCONNECT_DEBOUNCE_MS)
        } else if (status === 'reconnecting') {
          setStatus('reconnecting')
        }
      },
    )

    return () => {
      unlistenMsg.then((f) => f())
      unlistenStatus.then((f) => f())
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (disconnectDebounceRef.current) {
        clearTimeout(disconnectDebounceRef.current)
      }
      realtimeManager.stopAll()
    }
  }, []) // stable selectors from zustand, no need in deps

  // ── Agent Response Handler ──────────────────────────────────────────

  function handleAgentResponse(msg: AgentResponse) {
    // Add chat message
    if (msg.chatMessage) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'agent',
        content: msg.chatMessage,
        timestamp: msg.timestamp,
      })
    }
    // Process panel actions
    if (msg.panels) {
      processPanelMessages(msg.panels)
    }
  }

  // ── Panel Action Handler ────────────────────────────────────────────

  function handlePanelAction(msg: PanelActionMessage) {
    processPanelMessages(msg.panels)
  }

  function processPanelMessages(panels: PanelMessage[]) {
    for (const panel of panels) {
      switch (panel.action) {
        case 'create':
          createPanel(panel)
          break
        case 'update':
          if (panel.patch) {
            patchPanel(panel.panelId, panel.patch)
          } else if (panel.data !== undefined) {
            updatePanel(panel.panelId, panel.data)
          }
          // Apply layout if provided with update
          if ((panel as unknown as Record<string, unknown>).layout) {
            const layout = (panel as unknown as Record<string, unknown>).layout as { x?: number; y?: number; w?: number; h?: number }
            const store = useCanvasStore.getState()
            const existing = store.panelLayouts[panel.panelId]
            store.applyAgentLayout([{
              panelId: panel.panelId,
              x: layout.x ?? existing?.x ?? 0,
              y: layout.y ?? existing?.y ?? 0,
              w: layout.w ?? existing?.w ?? 4,
              h: layout.h ?? existing?.h ?? 3,
            }])
          }
          break
        case 'archive':
          archivePanel(panel.panelId)
          break
        case 'delete':
          // Agent delete → archive instead; only user can permanently delete
          archivePanel(panel.panelId)
          break
        case 'resize' as string:
          {
            const p = panel as unknown as { panelId: string; w?: number; h?: number }
            if (p.w !== undefined && p.h !== undefined) {
              useCanvasStore.getState().resizePanel(p.panelId, p.w, p.h)
            }
          }
          break
        case 'changeType' as string:
          {
            const p = panel as unknown as { panelId: string; panelType?: string; data?: unknown; title?: string; subtitle?: string }
            if (p.panelType) {
              useCanvasStore.getState().changePanelType(p.panelId, p.panelType, p.data, p.title, p.subtitle)
            }
          }
          break
        case 'star' as string:
          {
            const p = panel as unknown as { panelId: string; starred?: boolean }
            if (p.starred !== undefined) {
              useCanvasStore.getState().setStar(p.panelId, p.starred)
            }
          }
          break
        case 'setTags' as string:
          {
            const p = panel as unknown as { panelId: string; tags?: string[] }
            if (p.tags !== undefined) {
              useCanvasStore.getState().setTags(p.panelId, p.tags)
            }
          }
          break
        default:
          // Fallback: action missing — route through createPanel which has
          // built-in dedup (converts to update if panelId already exists)
          if (import.meta.env.DEV) console.warn(`[WS] panel missing action, fallback to createPanel:`, panel.panelId)
          createPanel(panel)
          break
      }
    }
  }

  // ── Stream Handlers ─────────────────────────────────────────────────

  function handleStreamStart(msg: StreamStart) {
    addMessage({
      id: msg.messageId,
      role: 'agent',
      content: '',
      timestamp: msg.timestamp,
    })
    setStreaming(true)
  }

  function handleStreamChunk(msg: StreamChunk) {
    appendToLastMessage(msg.content)
  }

  function handleStreamEnd(_msg: StreamEnd) {
    setStreaming(false)
  }

  // ── Canvas Control Handler ──────────────────────────────────────────

  function handleCanvasControl(msg: CanvasControlMessage) {
    switch (msg.action) {
      case 'switchView':
        if (msg.view) switchView(msg.view)
        break
      case 'focusPanel':
        if (msg.panelId) focusPanel(msg.panelId)
        break
      case 'expandPanel':
        if (msg.panelId) expandPanel(msg.panelId)
        break
      case 'rearrangePanels':
        if (msg.arrangement) rearrangePanels(msg.arrangement)
        break
      case 'clearCanvas':
        clearCanvas(msg.keepPinned ?? true)
        break
      case 'setLayout':
        if (msg.layout) useCanvasStore.getState().applyAgentLayout(msg.layout)
        break
    }
  }

  // ── App Control Handler ─────────────────────────────────────────────

  function handleAppControl(msg: AppControlMessage) {
    switch (msg.action) {
      case 'showTyping':
        setStreaming(msg.isTyping ?? false)
        break
      case 'showNotification': {
        const toastType = msg.notificationType || 'info'
        if (toastType === 'success')
          toast.success(msg.title, { description: msg.body })
        else if (toastType === 'error')
          toast.error(msg.title, { description: msg.body })
        else if (toastType === 'warning')
          toast.warning(msg.title, { description: msg.body })
        else toast.info(msg.title, { description: msg.body })
        break
      }
      case 'showProgress':
        toast.info(msg.label ?? 'Progress', { description: `${msg.percent ?? 0}%` })
        break
      case 'setTheme':
        if (msg.theme) {
          // Dispatch event so ThemeProvider syncs React state + handles DOM
          window.dispatchEvent(new CustomEvent('pegboard-theme-change', { detail: msg.theme }))
        }
        break
      case 'registerTheme':
        if (msg.themeName && msg.css) {
          // SECURITY: Validate theme name — only allow safe characters
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(msg.themeName)) {
            console.warn('[ws] Invalid theme name rejected:', msg.themeName)
            break
          }
          // Inject / update <style> element for the custom theme
          const styleId = `custom-theme-${msg.themeName}`
          let styleEl = document.getElementById(styleId)
          if (!styleEl) {
            styleEl = document.createElement('style')
            styleEl.id = styleId
            document.head.appendChild(styleEl)
          }
          // SECURITY: Sanitize CSS before injecting into DOM
          styleEl.textContent = sanitizeThemeCSS(msg.css)
          // Track custom theme name (limit to 20 entries)
          const customThemes: string[] = JSON.parse(localStorage.getItem('pegboard-custom-themes') || '[]')
          if (!customThemes.includes(msg.themeName)) {
            if (customThemes.length >= 20) {
              console.warn('[ws] Custom themes limit reached (20), rejecting new theme:', msg.themeName)
              break
            }
            customThemes.push(msg.themeName)
            localStorage.setItem('pegboard-custom-themes', JSON.stringify(customThemes))
          }
          toast.success('主题已注册', { description: msg.themeName })
        }
        break
      case 'setBadge':
      case 'requestAttention':
        break
    }
  }

  // ── Realtime Control Handler ────────────────────────────────────────

  function handleRealtimeControl(msg: RealtimeControlMessage) {
    switch (msg.action) {
      case 'start':
        if (msg.config) realtimeManager.start(msg.panelId, msg.config)
        break
      case 'stop':
        realtimeManager.stop(msg.panelId)
        break
      case 'set_interval':
        if (msg.interval) realtimeManager.setInterval(msg.panelId, msg.interval)
        break
    }
  }

  // ── Reconnection with Exponential Backoff ───────────────────────────

  const MAX_RECONNECT_ATTEMPTS = 10

  function startReconnect() {
    const attempts = useConnectionStore.getState().reconnectAttempts

    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('disconnected')
      useConnectionStore.getState().setNextReconnectIn(null)
      return
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000)

    useConnectionStore.getState().setNextReconnectIn(delay)
    useConnectionStore.getState().incrementReconnectAttempts()
    setStatus('reconnecting')

    reconnectTimerRef.current = setTimeout(async () => {
      try {
        const status = await invoke<string>('get_ws_status')
        if (status.startsWith('connected')) {
          setStatus('connected')
          resetReconnectAttempts()
        } else if (status.startsWith('idle')) {
          setStatus('connected')
          resetReconnectAttempts()
        } else {
          startReconnect()
        }
      } catch {
        startReconnect()
      }
    }, delay)
  }

  // ── Send Message ────────────────────────────────────────────────────

  async function sendMessage(message: string) {
    await invoke('send_ws_message', { message })
  }

  return { sendMessage }
}
