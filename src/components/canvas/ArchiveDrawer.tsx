import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '@/stores/canvas-store'
import { getPanelIcon } from '@/lib/panel-icons'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Archive } from 'lucide-react'

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ArchiveDrawer() {
  const { t } = useTranslation('sidebar')
  const archivedPanels = useCanvasStore((s) => s.archivedPanels)
  const restorePanel = useCanvasStore((s) => s.restorePanel)
  const deleteArchivedPanel = useCanvasStore((s) => s.deleteArchivedPanel)

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-xs" title={t('archive_panels')}>
            <Archive className="w-4 h-4" />
          </Button>
        }
      />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{t('archive_panels')}</SheetTitle>
        </SheetHeader>

        {archivedPanels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-12">
            {t('no_archived')}
          </div>
        ) : (
          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="space-y-2">
              {[...archivedPanels]
                .sort(
                  (a, b) =>
                    new Date(b.archivedAt).getTime() -
                    new Date(a.archivedAt).getTime(),
                )
                .map((panel) => (
                  <div
                    key={panel.panelId}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    {/* Icon + info */}
                    <span className="text-muted-foreground shrink-0">
                      {getPanelIcon(panel.panelType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {panel.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(panel.archivedAt)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => restorePanel(panel.panelId)}
                      >
                        {t('restore')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => deleteArchivedPanel(panel.panelId)}
                      >
                        {t('delete_permanently')}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
