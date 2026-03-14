import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { useCanvasStore } from '@/stores/canvas-store'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LayoutTemplate, Trash2, FolderInput } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TemplateMeta } from '@/types/template'

// Placeholder color from template name hash
function nameColor(name: string): string {
  const colors = [
    'panel-badge-blue',
    'panel-badge-green',
    'panel-badge-yellow',
    'panel-badge-red',
    'panel-badge-gray',
    'panel-badge-blue',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return colors[Math.abs(hash) % colors.length]!
}

function TemplateCard({
  meta,
  onDelete,
}: {
  meta: TemplateMeta
  onDelete: (name: string) => void
}) {
  const { t } = useTranslation('sidebar')
  const [showDelete, setShowDelete] = useState(false)

  return (
    <div
      className="group relative rounded-lg border border-border/60 p-3 hover:border-border transition-colors"
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Preview or placeholder */}
      {meta.preview ? (
        <div className="w-full h-20 rounded-md overflow-hidden mb-2 bg-muted">
          <img
            src={`data:image/png;base64,${meta.preview}`}
            alt={meta.displayName}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className={cn(
            'w-full h-20 rounded-md flex items-center justify-center mb-2 text-2xl font-bold',
            nameColor(meta.name),
          )}
        >
          {meta.displayName.charAt(0)}
        </div>
      )}

      <div className="text-sm font-medium truncate">{meta.displayName}</div>
      <div className="text-xs text-muted-foreground truncate mt-0.5">
        {meta.description}
      </div>

      {/* Delete button on hover */}
      {showDelete && (
        <button
          type="button"
          className="absolute top-2 right-2 p-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          title={t('delete_template')}
          aria-label={t('delete_template')}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(meta.name)
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

function TemplateManagerContent() {
  const { t } = useTranslation('sidebar')
  const { t: tCommon } = useTranslation('common')
  const [templates, setTemplates] = useState<TemplateMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [importPath, setImportPath] = useState('')
  const setStoreTemplates = useCanvasStore((s) => s.setTemplates)

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const json: string = await invoke('scan_templates')
      const list: TemplateMeta[] = JSON.parse(json)
      setTemplates(list)
      setStoreTemplates(list.map((t) => t.name))
    } catch (err) {
      console.error('Failed to scan templates:', err)
    } finally {
      setLoading(false)
    }
  }, [setStoreTemplates])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleDelete = async (name: string) => {
    try {
      await invoke('delete_template', { name })
      toast.success(t('template_deleted'))
      loadTemplates()
    } catch (err) {
      toast.error(t('delete_failed', { error: String(err) }))
    }
  }

  const handleImport = async () => {
    const path = importPath.trim()
    if (!path) {
      toast.warning(t('import_path_required'))
      return
    }
    try {
      await invoke('import_template', { path })
      toast.success(t('template_imported'))
      setImportPath('')
      loadTemplates()
    } catch (err) {
      toast.error(t('import_failed', { error: String(err) }))
    }
  }

  return (
    <div className="flex flex-col h-full">
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {tCommon('loading')}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 py-12">
          <LayoutTemplate className="w-8 h-8 opacity-40" />
          <span>{t('no_templates')}</span>
          <span className="text-xs">{t('builtin_available')}</span>
        </div>
      ) : (
        <ScrollArea className="flex-1 px-4 pb-2">
          <div className="grid grid-cols-2 gap-3">
            {templates.map((meta) => (
              <TemplateCard
                key={meta.name}
                meta={meta}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Import section */}
      <div className="shrink-0 border-t border-border/50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={importPath}
            onChange={(e) => setImportPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleImport()
            }}
            placeholder={t('template_path')}
            className="flex-1 h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button variant="outline" size="xs" onClick={handleImport}>
            <FolderInput className="w-3 h-3 mr-1" />
            {t('import_template')}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {t('template_path_hint')}
        </p>
      </div>
    </div>
  )
}

export { TemplateManagerContent }

export function TemplateManagerButton({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation('sidebar')

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-xs" title={t('template_manage')}>
            <LayoutTemplate className="w-4 h-4" />
          </Button>
        }
      />
      {!collapsed && (
        <span className="text-xs text-muted-foreground ml-2">{t('templates')}</span>
      )}
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{t('templates_title')}</SheetTitle>
          <SheetDescription>{t('templates_desc')}</SheetDescription>
        </SheetHeader>
        <TemplateManagerContent />
      </SheetContent>
    </Sheet>
  )
}
