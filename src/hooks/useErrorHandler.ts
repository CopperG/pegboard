import { useEffect, useRef } from 'react'
import { useCanvasStore } from '@/stores/canvas-store'
import { toast } from 'sonner'

export function useErrorHandler() {
  const panelCount = useCanvasStore((s) => s.panels.length)
  const warningShown = useRef(false)

  // Panel count warning (>20 panels)
  useEffect(() => {
    if (panelCount > 20 && !warningShown.current) {
      warningShown.current = true
      toast.warning('画布面板较多', {
        description: '建议归档不需要的面板以保持性能',
      })
    }
    if (panelCount <= 20) {
      warningShown.current = false
    }
  }, [panelCount])
}
