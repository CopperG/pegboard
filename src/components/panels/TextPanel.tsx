import { useMemo, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PanelProps } from './PanelRegistry'
import { useCanvasStore, selectPanelInteraction } from '@/stores/canvas-store'

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
      .replace(/[^\w一-鿿]+/g, '-')
      .replace(/^-|-$/g, '')
    entries.push({ level, text, id })
  }
  return entries
}

/** Mixed CJK/latin word count: CJK chars count individually, latin runs count per word */
export function countWords(content: string): number {
  const cjk = (content.match(/[一-鿿]/g) ?? []).length
  const latinWords = content
    .replace(/[一-鿿]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return cjk + latinWords
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
        .replace(/[^\w一-鿿]+/g, '-')
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
  const { t: tCommon } = useTranslation('common')

  const interaction = useCanvasStore(selectPanelInteraction(panelId))
  const editable = interaction?.editable ?? false

  // Safely cast / validate data
  const panelData: TextPanelData | null = useMemo(() => {
    if (isTextPanelData(data)) return data
    return null
  }, [data])

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  // Snapshot at edit start — detects external (agent) changes during the edit session
  const baseContentRef = useRef('')

  const startEdit = useCallback(() => {
    if (!editable || !panelData) return
    baseContentRef.current = panelData.content
    setDraft(panelData.content)
    setEditing(true)
  }, [editable, panelData])

  const cancelEdit = useCallback(() => setEditing(false), [])

  const loadLatest = useCallback(() => {
    if (!panelData) return
    baseContentRef.current = panelData.content
    setDraft(panelData.content)
  }, [panelData])

  const saveEdit = useCallback(() => {
    const newContent = draft
    if (newContent === baseContentRef.current) {
      setEditing(false)
      return
    }

    // Merge against FRESH store data: only content is replaced, derived fields recomputed,
    // everything else (summary, format) preserved — prevents stale-copy overwrites
    const store = useCanvasStore.getState()
    const panel = store.panels.find((p) => p.panelId === panelId)
    if (panel && panel.data && typeof panel.data === 'object') {
      const fresh = panel.data as TextPanelData
      const next: TextPanelData = { ...fresh, content: newContent }
      if (fresh.toc !== undefined) next.toc = parseTocFromContent(newContent)
      if (fresh.wordCount !== undefined) next.wordCount = countWords(newContent)
      store.updatePanel(panelId, next)
    }

    invoke('send_ws_message', {
      message: JSON.stringify({
        type: 'panel_user_action',
        action: 'edit_value',
        panelId,
        payload: { field: 'content', newValue: newContent },
        timestamp: new Date().toISOString(),
      }),
    }).catch(console.error)

    setEditing(false)
  }, [draft, panelId])

  // Agent pushed new content while the user is editing.
  // null-guard: panelData may be null (malformed update) while editing — treat as not changed.
  const externallyChanged = editing && panelData != null && panelData.content !== baseContentRef.current

  if (editing) {
    return (
      <div className="flex flex-col h-full gap-2" data-no-drag>
        {externallyChanged && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs shrink-0">
            <span className="flex-1">{t('content_changed_externally')}</span>
            <button
              type="button"
              className="underline underline-offset-2 hover:text-primary shrink-0"
              onClick={loadLatest}
            >
              {t('load_latest')}
            </button>
          </div>
        )}
        <textarea
          autoFocus
          className="flex-1 w-full resize-none rounded-md border bg-background p-2 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-primary/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              cancelEdit()
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              saveEdit()
            }
          }}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground mr-auto">
            {t('edit_shortcuts_hint')}
          </span>
          <Button variant="ghost" size="sm" onClick={cancelEdit}>
            {tCommon('cancel')}
          </Button>
          <Button size="sm" onClick={saveEdit}>
            {tCommon('save')}
          </Button>
        </div>
      </div>
    )
  }

  if (!panelData) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('cannot_render', { type: t('text') })}: {t('invalid_data')} (panelId: {panelId})
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div
        className={`h-full overflow-y-auto ${editable ? 'cursor-text' : ''}`}
        title={editable ? t('double_click_to_edit') : undefined}
        onDoubleClick={editable ? startEdit : undefined}
      >
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
