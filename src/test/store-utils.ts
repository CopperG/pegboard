import { useCanvasStore } from '@/stores/canvas-store'

const initialState = useCanvasStore.getState()

export function resetCanvasStore() {
  useCanvasStore.setState(initialState, true)
}
