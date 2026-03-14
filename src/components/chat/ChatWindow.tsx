import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '@/stores/chat-store'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ChatWindowProps {
  mode: 'full' | 'bottom' | 'floating'
}

/** Floating overlay panel used by both `bottom` and `floating` modes */
function FloatingChatOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('chat')
  const messages = useChatStore((s) => s.messages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute bottom-16 right-4 w-[400px] h-[500px] bg-background border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-medium">{t('chat_title')}</span>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <span className="text-xs">&#x25BC;</span>
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t('start_conversation')}
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput />
    </motion.div>
  )
}

/** Full-screen chat mode (layout: chat) */
function FullChat() {
  const { t } = useTranslation('chat')
  const messages = useChatStore((s) => s.messages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1 max-w-2xl mx-auto">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-16">
              {t('start_conversation')}
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="max-w-2xl mx-auto w-full">
        <ChatInput />
      </div>
    </div>
  )
}

/** Bottom bar mode (layout: workspace) */
function BottomBarChat() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative">
      <AnimatePresence>
        {expanded && (
          <FloatingChatOverlay onClose={() => setExpanded(false)} />
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="h-14 border-t border-border bg-background flex items-center gap-2 px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(expanded && 'bg-muted')}
        >
          <span className="text-sm">{expanded ? '\u25BC' : '\u25B2'}</span>
        </Button>
        <div className="flex-1">
          <ChatInput compact />
        </div>
      </div>
    </div>
  )
}

/** Floating bubble mode (layout: dashboard) */
function FloatingBubbleChat() {
  const [expanded, setExpanded] = useState(false)
  const messages = useChatStore((s) => s.messages)
  const [lastSeenCount, setLastSeenCount] = useState(messages.length)

  // Track unread messages when collapsed
  const unreadCount = expanded ? 0 : messages.length - lastSeenCount

  // When closing the overlay, mark all messages as seen
  const handleClose = () => {
    setExpanded(false)
    setLastSeenCount(messages.length)
  }

  // When opening, mark as seen
  const handleOpen = () => {
    setExpanded(true)
    setLastSeenCount(messages.length)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {expanded && <FloatingChatOverlay onClose={handleClose} />}
      </AnimatePresence>

      {!expanded && (
        <button
          type="button"
          onClick={handleOpen}
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center relative"
        >
          <span className="text-lg" role="img" aria-label="chat">
            &#x1F4AC;
          </span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}

export function ChatWindow({ mode }: ChatWindowProps) {
  switch (mode) {
    case 'full':
      return <FullChat />
    case 'bottom':
      return <BottomBarChat />
    case 'floating':
      return <FloatingBubbleChat />
  }
}
