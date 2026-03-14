import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { PanelSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import type { PanelProps } from './PanelRegistry'
import type { ImagePanelData } from '@/types/panel-data'

function isImagePanelData(data: unknown): data is ImagePanelData {
  if (data == null || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj['src'] === 'string'
}

// SECURITY: Validate image src to prevent javascript:/vbscript: injection
function isValidImageSrc(src: string): boolean {
  if (!src) return false
  // Block dangerous schemes
  const blocked = [
    /^javascript:/i,
    /^vbscript:/i,
    /^data:(?!image\/)/i,  // data: that's not image
  ]
  if (blocked.some(p => p.test(src))) return false
  // Allow relative paths, blob:, data:image/, https:, http: (for local dev)
  const allowed = [
    /^https?:\/\//i,
    /^blob:/i,
    /^data:image\//i,
    /^\//,           // Absolute paths
    /^\.?\//,        // Relative paths
  ]
  return allowed.some(p => p.test(src)) || !src.includes(':') // no scheme = relative
}

type ImageState = 'loading' | 'loaded' | 'error'

function ImagePreviewOverlay({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  const { t: tCommon } = useTranslation('common')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus the overlay when mounted
  useEffect(() => {
    overlayRef.current?.focus()
  }, [])

  return createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-label={alt || tCommon('image_preview')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-panel-overlay/80 backdrop-blur-sm outline-none"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-panel-overlay-text text-3xl leading-none hover:text-panel-overlay-text/70 transition-colors z-10 rounded focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={onClose}
        aria-label={tCommon('close_preview')}
      >
        &times;
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  )
}

export function ImagePanel({ panelId, data }: PanelProps) {
  const { t } = useTranslation('panels')
  const { t: tCommon } = useTranslation('common')
  const panelData = useMemo<ImagePanelData | null>(() => {
    if (isImagePanelData(data)) return data
    return null
  }, [data])

  const [imageState, setImageState] = useState<ImageState>('loading')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  // Reset state when src changes
  useEffect(() => {
    setImageState('loading')
  }, [panelData?.src, retryKey])

  const handleLoad = useCallback(() => {
    setImageState('loaded')
  }, [])

  const handleError = useCallback(() => {
    setImageState('error')
  }, [])

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1)
  }, [])

  if (!panelData) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('cannot_render', { type: t('image') })}: {t('invalid_data')} (panelId: {panelId})
      </div>
    )
  }

  const { src, caption, alt = '' } = panelData

  // SECURITY: Block dangerous URL schemes
  if (!isValidImageSrc(src)) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-sm text-muted-foreground">
        {t('image_load_error')}: {t('invalid_data')}
      </div>
    )
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Loading skeleton */}
      {imageState === 'loading' && (
        <div className="absolute inset-0">
          <PanelSkeleton type="image" />
        </div>
      )}

      {/* Error state */}
      {imageState === 'error' && (
        <div className="flex items-center justify-center h-full">
          <ErrorState
            title={t('image_load_error')}
            description={alt || undefined}
            retryAction={handleRetry}
            retryLabel={tCommon('retry')}
          />
        </div>
      )}

      {/* Image — fills panel like a photo frame */}
      <img
        key={retryKey}
        src={src}
        alt={alt}
        className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${
          imageState === 'loaded' ? 'opacity-100' : 'opacity-0 absolute'
        }`}
        style={
          imageState !== 'loaded'
            ? { width: 0, height: 0, overflow: 'hidden' }
            : undefined
        }
        onLoad={handleLoad}
        onError={handleError}
        onClick={() => setPreviewOpen(true)}
      />

      {/* Caption — overlay at bottom */}
      {caption && imageState === 'loaded' && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-panel-overlay/60 to-transparent px-3 py-2">
          <p className="text-xs text-panel-overlay-text/90 text-center line-clamp-1">{caption}</p>
        </div>
      )}

      {/* Fullscreen preview overlay */}
      {previewOpen && (
        <ImagePreviewOverlay
          src={src}
          alt={alt}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}
