import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatStore, ChatMessage } from '@/types/store'

export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    messages: [],
    isStreaming: false,

    addMessage: (msg: ChatMessage) =>
      set((state) => {
        state.messages.push(msg)
      }),

    appendToMessage: (id: string, content: string) =>
      set((state) => {
        const msg = state.messages.find((m) => m.id === id)
        if (msg) msg.content += content
      }),

    setStreaming: (val: boolean) =>
      set((state) => {
        state.isStreaming = val
      }),

    clearMessages: () =>
      set((state) => {
        state.messages = []
      }),
  })),
)
