import { useMemo, useCallback, type ReactNode, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useCanvasStore } from '@/stores/canvas-store'
import { useChatStore } from '@/stores/chat-store'
import type { ChatMessage as ChatMessageType } from '@/types/store'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: ChatMessageType
}

// Regex for [emoji title] panel reference tags
const TAG_REGEX = /\[([^\]]+)\]/g

/**
 * Parse text content for `[emoji title]` references,
 * returning an array of text segments and clickable chip elements.
 *
 * SECURITY: Tag content extracted by the regex is rendered via React JSX
 * ({tagContent} inside <button>), which auto-escapes HTML entities.
 * No dangerouslySetInnerHTML is used, so this is safe against XSS injection.
 */
function parseTagsInline(
  text: string,
  onPanelClick: (title: string) => void,
): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Reset regex state
  TAG_REGEX.lastIndex = 0

  while ((match = TAG_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const tagContent = match[1]!
    const matchIndex = match.index

    parts.push(
      <button
        key={`tag-${matchIndex}`}
        type="button"
        className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs cursor-pointer hover:bg-primary/20 transition-colors inline-flex items-center"
        onClick={() => onPanelClick(tagContent)}
      >
        {tagContent}
      </button>,
    )

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

/**
 * Create custom markdown components that parse [emoji title] tags
 * within text nodes of paragraphs, list items, etc.
 */
function useMarkdownComponents(onPanelClick: (title: string) => void) {
  return useMemo(() => {
    // Helper: process children to find and replace [tag] patterns in strings
    function processChildren(children: ReactNode): ReactNode {
      if (typeof children === 'string') {
        const parsed = parseTagsInline(children, onPanelClick)
        return parsed.length === 1 ? parsed[0] : <>{parsed}</>
      }
      if (Array.isArray(children)) {
        return children.map((child, i) => {
          if (typeof child === 'string') {
            const parsed = parseTagsInline(child, onPanelClick)
            return parsed.length === 1 ? (
              <span key={i}>{parsed[0]}</span>
            ) : (
              <span key={i}>{parsed}</span>
            )
          }
          return child
        })
      }
      return children
    }

    const components: ComponentProps<typeof ReactMarkdown>['components'] = {
      p: ({ children, ...props }) => (
        <p {...props} className="mb-2 last:mb-0">
          {processChildren(children)}
        </p>
      ),
      li: ({ children, ...props }) => (
        <li {...props}>{processChildren(children)}</li>
      ),
      strong: ({ children, ...props }) => (
        <strong {...props} className="font-semibold">
          {processChildren(children)}
        </strong>
      ),
      em: ({ children, ...props }) => (
        <em {...props}>{processChildren(children)}</em>
      ),
      // Style code blocks
      pre: ({ children, ...props }) => (
        <pre
          {...props}
          className="bg-background/50 rounded-md p-3 overflow-x-auto text-xs my-2"
        >
          {children}
        </pre>
      ),
      code: ({ children, className, ...props }) => {
        // Inline code vs block code
        const isBlock = className?.startsWith('language-')
        if (isBlock) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        }
        return (
          <code
            className="bg-background/50 px-1.5 py-0.5 rounded text-xs"
            {...props}
          >
            {children}
          </code>
        )
      },
      // Style headings
      h1: ({ children, ...props }) => (
        <h1 {...props} className="text-base font-bold mb-1">
          {processChildren(children)}
        </h1>
      ),
      h2: ({ children, ...props }) => (
        <h2 {...props} className="text-sm font-bold mb-1">
          {processChildren(children)}
        </h2>
      ),
      h3: ({ children, ...props }) => (
        <h3 {...props} className="text-sm font-semibold mb-1">
          {processChildren(children)}
        </h3>
      ),
      // Style lists
      ul: ({ children, ...props }) => (
        <ul {...props} className="list-disc list-inside mb-2 space-y-0.5">
          {children}
        </ul>
      ),
      ol: ({ children, ...props }) => (
        <ol {...props} className="list-decimal list-inside mb-2 space-y-0.5">
          {children}
        </ol>
      ),
      // Style blockquotes
      blockquote: ({ children, ...props }) => (
        <blockquote
          {...props}
          className="border-l-2 border-primary/30 pl-3 my-2 italic text-muted-foreground"
        >
          {children}
        </blockquote>
      ),
      // Style tables
      table: ({ children, ...props }) => (
        <div className="overflow-x-auto my-2">
          <table
            {...props}
            className="min-w-full text-xs border-collapse"
          >
            {children}
          </table>
        </div>
      ),
      th: ({ children, ...props }) => (
        <th
          {...props}
          className="border border-border/50 px-2 py-1 bg-muted/50 text-left font-medium"
        >
          {children}
        </th>
      ),
      td: ({ children, ...props }) => (
        <td {...props} className="border border-border/50 px-2 py-1">
          {children}
        </td>
      ),
      // Style links
      a: ({ children, href, ...props }) => (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {children}
        </a>
      ),
    }

    return components
  }, [onPanelClick])
}

/**
 * Parse user message content with [emoji title] tags (no markdown)
 */
function useParsedContent(
  content: string,
  onPanelClick: (title: string) => void,
): ReactNode[] {
  return useMemo(() => {
    return parseTagsInline(content, onPanelClick)
  }, [content, onPanelClick])
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Blinking cursor shown at end of streaming messages */
function StreamingCursor() {
  return (
    <span className="inline-block w-1.5 h-4 bg-foreground motion-safe:animate-pulse ml-0.5 align-text-bottom" />
  )
}

/** Thinking indicator shown when stream just started (empty content) */
function ThinkingIndicator() {
  const { t } = useTranslation('chat')
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="text-sm">{t('thinking')}</span>
      <span className="flex gap-0.5">
        <span
          className="inline-block w-1 h-1 rounded-full bg-muted-foreground motion-safe:animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="inline-block w-1 h-1 rounded-full bg-muted-foreground motion-safe:animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="inline-block w-1 h-1 rounded-full bg-muted-foreground motion-safe:animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </span>
    </div>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const panels = useCanvasStore((s) => s.panels)
  const focusPanel = useCanvasStore((s) => s.focusPanel)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const messages = useChatStore((s) => s.messages)

  const isLastMessage = messages.length > 0 && messages[messages.length - 1]?.id === message.id
  const isStreamingThis = isStreaming && isLastMessage && message.role === 'agent'

  const handlePanelClick = useCallback(
    (tagContent: string) => {
      const panel = panels.find((p) => {
        const normalizedTag = tagContent.trim()
        const normalizedTitle = p.title.trim()
        return (
          normalizedTitle === normalizedTag ||
          normalizedTag.includes(normalizedTitle) ||
          normalizedTitle.includes(normalizedTag)
        )
      })
      if (panel) {
        focusPanel(panel.panelId)
      }
    },
    [panels, focusPanel],
  )

  const parsedUserContent = useParsedContent(
    message.content,
    handlePanelClick,
  )

  const markdownComponents = useMarkdownComponents(handlePanelClick)

  const isUser = message.role === 'user'

  return (
    <div
      className={cn('flex w-full mb-3', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted rounded-bl-md',
        )}
      >
        {isUser ? (
          // User messages: plain text with tag parsing
          <div className="whitespace-pre-wrap break-words">{parsedUserContent}</div>
        ) : isStreamingThis && message.content === '' ? (
          // Agent thinking indicator (stream just started, no content yet)
          <ThinkingIndicator />
        ) : (
          // Agent messages: markdown rendering with tag parsing
          <div className="break-words prose-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
            {isStreamingThis && <StreamingCursor />}
          </div>
        )}
        <div
          className={cn(
            'text-[10px] mt-1.5 select-none',
            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground',
          )}
        >
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  )
}
