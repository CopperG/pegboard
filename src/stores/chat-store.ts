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

    appendToLastMessage: (content: string) =>
      set((state) => {
        // Find the last agent message and append content to it
        for (let i = state.messages.length - 1; i >= 0; i--) {
          if (state.messages[i]!.role === 'agent') {
            state.messages[i]!.content += content
            break
          }
        }
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
