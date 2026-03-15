import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'
import type { PanelProps } from './PanelRegistry'

interface TocEntry {
  level: number
  text: string
  id: string
}

interface TextPanelData {
  summary?: string
  content: string
  format?: 'markdown' | 'plaintext'
  wordCount?: number
  toc?: TocEntry[]
}

function isTextPanelData(data: unknown): data is TextPanelData {
  if (data == null || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj['content'] === 'string'
}

/** Parse headings from markdown content to generate TOC */
export function parseTocFromContent(content: string): TocEntry[] {
  const entries: TocEntry[] = []
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1]!.length
    const text = match[2]!.trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, '-')
      .replace(/^-|-$/g, '')
    entries.push({ level, text, id })
  }
  return entries
}

/** Custom rehype plugin to add IDs to headings for anchor navigation */
function rehypeHeadingIds() {
  return (tree: { children: unknown[] }) => {
    visitHeadings(tree)
  }
}

function visitHeadings(node: unknown) {
  if (
    node != null &&
    typeof node === 'object' &&
    'type' in node &&
    (node as { type: string }).type === 'element'
  ) {
    const el = node as {
      type: string
      tagName: string
      properties?: Record<string, unknown>
      children?: unknown[]
    }
    if (/^h[1-6]$/.test(el.tagName)) {
      const text = extractText(el)
      const id = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, '-')
        .replace(/^-|-$/g, '')
      el.properties = { ...el.properties, id }
    }
    if (el.children) {
      for (const child of el.children) {
        visitHeadings(child)
      }
    }
  }
  if (
    node != null &&
    typeof node === 'object' &&
    'children' in node &&
    Array.isArray((node as { children: unknown[] }).children)
  ) {
    for (const child of (node as { children: unknown[] }).children) {
      visitHeadings(child)
    }
  }
}

function extractText(node: unknown): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'object' && 'value' in node) {
    return String((node as { value: unknown }).value)
  }
  if (typeof node === 'object' && 'children' in node) {
    return (
      (node as { children: unknown[] }).children?.map(extractText).join('') ??
      ''
    )
  }
  return ''
}

function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'text-foreground',
        'prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1.5',
        'prose-h1:text-base prose-h2:text-sm prose-h3:text-xs',
        'prose-p:text-[13px] prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-foreground',
        'prose-strong:text-foreground',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary/30 prose-blockquote:not-italic prose-blockquote:pl-3 prose-blockquote:my-2',
        'prose-code:text-foreground prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-muted/30 prose-pre:rounded-lg prose-pre:my-2 prose-pre:text-xs',
        'prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:text-[13px]',
        'prose-hr:my-3 prose-hr:border-border/50',
        'prose-img:rounded-lg prose-img:my-2',
        'prose-table:text-xs',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeHeadingIds]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function TocNavBar({
  toc,
  direction = 'horizontal',
  onNavigate,
}: {
  toc: TocEntry[]
  direction?: 'horizontal' | 'vertical'
  onNavigate: (id: string) => void
}) {
  if (toc.length === 0) return null

  if (direction === 'vertical') {
    return (
      <nav className="space-y-1 text-sm">
        {toc.map((entry) => (
          <button
            key={entry.id}
            className="block w-full text-left px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 truncate transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            style={{ paddingLeft: `${(entry.level - 1) * 12 + 8}px` }}
            onClick={() => onNavigate(entry.id)}
          >
            {entry.text}
          </button>
        ))}
      </nav>
    )
  }

  return (
    <nav className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 border-t bg-muted/30">
      {toc.map((entry) => (
        <button
          key={entry.id}
          className="shrink-0 text-xs px-2 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={() => onNavigate(entry.id)}
        >
          {entry.text}
        </button>
      ))}
    </nav>
  )
}

// ── TextPanel (main) ────────────────────────────────────────────────
export function TextPanel({ data, panelId }: PanelProps) {
  const { t } = useTranslation('panels')

  // Safely cast / validate data
  const panelData: TextPanelData | null = useMemo(() => {
    if (isTextPanelData(data)) return data
    return null
  }, [data])

  if (!panelData) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('cannot_render', { type: t('text') })}: {t('invalid_data')} (panelId: {panelId})
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div>
        {/* Optional metadata line */}
        {(panelData.wordCount != null || panelData.summary) && (
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            {panelData.wordCount != null && (
              <span>{t('words_count', { count: panelData.wordCount })}</span>
            )}
            {panelData.summary && (
              <span className="truncate">{panelData.summary}</span>
            )}
          </div>
        )}
        {/* Content */}
        {panelData.format === 'plaintext' ? (
          <pre className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">{panelData.content}</pre>
        ) : (
          <MarkdownRenderer content={panelData.content} />
        )}
      </div>
      {/* Bottom fade hint */}
      <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none" style={{ background: 'linear-gradient(to top, var(--card), transparent)' }} />
    </div>
  )
}
