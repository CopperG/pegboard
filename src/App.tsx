import './i18n/config'
import { Sidebar } from '@/components/layout/Sidebar'
import { CanvasTabs } from '@/components/layout/CanvasTabs'
import { Canvas } from '@/components/canvas/Canvas'
import { ChatFloatingBar } from '@/components/chat/ChatFloatingBar'
import { DevMockPanel } from '@/components/dev/DevMockPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { usePersistence } from '@/hooks/usePersistence'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { ThemeProvider, useTheme } from '@/hooks/useTheme'
import { useCanvasStore } from '@/stores/canvas-store'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasView } from '@/types/layout'

const TAB_VIEWS: CanvasView[] = ['important', 'daily', 'work', 'entertainment', 'other', 'all']

/** SVG noise overlay – rendered via JS to avoid CSS parser issues with data URIs */
function NoiseOverlay() {
  const { resolved } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (resolved !== 'doodle') return
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    const size = 128
    cvs.width = size
    cvs.height = size
    const imageData = ctx.createImageData(size, size)
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 255
      imageData.data[i] = v
      imageData.data[i + 1] = v
      imageData.data[i + 2] = v
      imageData.data[i + 3] = 25
    }
    ctx.putImageData(imageData, 0, 0)
  }, [resolved])

  if (resolved !== 'doodle') return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full opacity-[0.06]"
      style={{ imageRendering: 'pixelated', backgroundSize: '128px 128px' }}
    />
  )
}

function AppInner() {
  useWebSocket() // Initialize WS connection bridge
  usePersistence()
  useErrorHandler()
  const { t } = useTranslation('canvas')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])
  const [chatOpen, setChatOpen] = useState(false)
  const toggleChat = useCallback(() => setChatOpen((v) => !v), [])
  const closeChat = useCallback(() => setChatOpen(false), [])

  const navigateView = useCanvasStore((s) => s.navigateView)
  const activeView = useCanvasStore((s) => s.activeView)
  const onPrev = useCallback(() => navigateView('prev'), [navigateView])
  const onNext = useCallback(() => navigateView('next'), [navigateView])

  const { containerRef, swipeHandlers, swipeStyle, dragging, direction, progress } = useSwipeNavigation({
    onPrev,
    onNext,
  })

  // Compute adjacent view labels for peek indicators
  const adjacentLabels = useMemo(() => {
    const idx = TAB_VIEWS.indexOf(activeView)
    const prev = idx > 0 ? TAB_VIEWS[idx - 1]! : null
    const next = idx < TAB_VIEWS.length - 1 ? TAB_VIEWS[idx + 1]! : null
    return {
      prev: prev ? t(prev) : null,
      next: next ? t(next) : null,
    }
  }, [activeView, t])

  // Keyboard shortcuts: Ctrl/Cmd + Left/Right to switch tabs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateView('prev')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateView('next')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigateView])

  return (
    <div className="flex h-dvh bg-background text-foreground" data-app-shell>
      <CanvasTabs sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} chatOpen={chatOpen} onToggleChat={toggleChat} />
      {sidebarOpen && <Sidebar />}
      <main className="flex-1 flex flex-col min-w-0">
        <div
          ref={containerRef}
          className="flex-1 overflow-auto min-h-0 relative"
          {...swipeHandlers}
        >
          <div style={swipeStyle}>
            <Canvas />
          </div>
          {/* Peek indicators for adjacent views during swipe */}
          {dragging && direction === 'left' && adjacentLabels.next && (
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 bg-muted/80 backdrop-blur text-sm text-foreground px-3 py-1.5 rounded-full"
              style={{ opacity: progress, transition: 'opacity 60ms ease-out' }}
            >
              {adjacentLabels.next} &rarr;
            </span>
          )}
          {dragging && direction === 'right' && adjacentLabels.prev && (
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 bg-muted/80 backdrop-blur text-sm text-foreground px-3 py-1.5 rounded-full"
              style={{ opacity: progress, transition: 'opacity 60ms ease-out' }}
            >
              &larr; {adjacentLabels.prev}
            </span>
          )}
        </div>
      </main>
      <ChatFloatingBar open={chatOpen} onClose={closeChat} />
      {import.meta.env.DEV && <DevMockPanel />}
      <Toaster position="top-right" />
      <NoiseOverlay />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
