import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '@/stores/chat-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_MESSAGE_LENGTH = 50000

interface ChatInputProps {
  compact?: boolean // true for workspace bottom bar mode
}

export function ChatInput({ compact = false }: ChatInputProps) {
  const { t } = useTranslation('chat')
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sendMessage = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      console.warn('[chat] Message too long, truncating')
    }

    const content = trimmed.length > MAX_MESSAGE_LENGTH
      ? trimmed.slice(0, MAX_MESSAGE_LENGTH)
      : trimmed

    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    })

    setValue('')

    // Re-focus the input after sending
    if (compact) {
      inputRef.current?.focus()
    } else {
      textareaRef.current?.focus()
    }
  }, [value, compact])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const isEmpty = value.trim().length === 0

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('input_placeholder_compact')}
          className="flex-1 h-8 px-3 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
        />
        <Button
          size="sm"
          disabled={isEmpty}
          onClick={sendMessage}
          className={cn(isEmpty && 'opacity-50')}
        >
          {t('send')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-border">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('input_placeholder_with_hint')}
        rows={1}
        className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring/50 resize-none placeholder:text-muted-foreground"
        style={{ fieldSizing: 'content' } as React.CSSProperties}
      />
      <Button
        size="default"
        disabled={isEmpty}
        onClick={sendMessage}
        className={cn(isEmpty && 'opacity-50')}
      >
        {t('send')}
      </Button>
    </div>
  )
}
