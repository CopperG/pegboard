import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Languages } from 'lucide-react'

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
] as const

export function LanguageSwitch({ collapsed }: { collapsed: boolean }) {
  const { t, i18n } = useTranslation('settings')

  return (
    <Popover>
      <PopoverTrigger
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        title={t('language')}
      >
        <Languages className="w-4 h-4" />
        {!collapsed && <span className="text-xs">{t('language')}</span>}
      </PopoverTrigger>
      <PopoverContent side="right" sideOffset={8} align="end" className="w-40 p-1.5">
        <div className="text-xs font-medium text-muted-foreground px-2 py-1">{t('language')}</div>
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
              i18n.language === opt.value
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted/60 text-foreground',
            )}
            onClick={() => i18n.changeLanguage(opt.value)}
          >
            <span>{opt.flag}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
