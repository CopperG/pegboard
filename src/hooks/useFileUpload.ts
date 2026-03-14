import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import type { Attachment } from '@/types/websocket'

const MAX_SINGLE_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100 MB

const ALLOWED_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  // Audio
  'wav', 'webm', 'mp3', 'm4a',
  // Documents
  'pdf', 'txt', 'md', 'csv', 'json', 'xlsx',
  // Code
  'js', 'ts', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'rb', 'sh',
])

function getExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? (parts[parts.length - 1] ?? '').toLowerCase() : ''
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/bmp', 'image/avif',
])

function getAttachmentType(mimeType: string): 'image' | 'audio' | 'file' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

export function useFileUpload() {
  const { t } = useTranslation('common')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0)

  const validateFile = useCallback(
    (file: File): string | null => {
      const ext = getExtension(file.name)
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return t('unsupported_file') + `: .${ext}`
      }
      // Validate MIME type for image uploads
      if (file.type.startsWith('image/') && !ALLOWED_IMAGE_TYPES.has(file.type)) {
        console.warn('[upload] Blocked image with disallowed MIME type:', file.type)
        return t('unsupported_file') + `: ${file.type}`
      }
      if (file.size > MAX_SINGLE_FILE_SIZE) {
        return t('file_too_large', { max: 50 })
      }
      if (totalSize + file.size > MAX_TOTAL_SIZE) {
        return t('total_too_large', { max: 100 })
      }
      return null
    },
    [totalSize, t],
  )

  const addFile = useCallback(
    async (file: File) => {
      const error = validateFile(file)
      if (error) {
        toast.error(error)
        return
      }

      try {
        const arrayBuffer = await file.arrayBuffer()
        const data = Array.from(new Uint8Array(arrayBuffer))
        const path: string = await invoke('save_upload', {
          name: file.name,
          data,
        })

        const attachment: Attachment = {
          type: getAttachmentType(file.type),
          name: file.name,
          path,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        }

        setAttachments((prev) => [...prev, attachment])
      } catch (err) {
        console.error('[useFileUpload] Failed to save file:', err)
        toast.error(`${t('error')}: ${file.name}`)
      }
    },
    [validateFile, t],
  )

  const addBlob = useCallback(
    async (blob: Blob, name: string) => {
      const file = new File([blob], name, { type: blob.type })
      await addFile(file)
    },
    [addFile],
  )

  const addImageFromClipboard = useCallback(
    async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            // Give pasted images a meaningful name
            const ext = item.type.split('/')[1] || 'png'
            const pastedFile = new File(
              [file],
              `pasted-${Date.now()}.${ext}`,
              { type: item.type },
            )
            await addFile(pastedFile)
            return
          }
        }
      }
      // If no image found, let default paste behavior handle it (plain text)
    },
    [addFile],
  )

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragging(false)

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      for (const file of Array.from(files)) {
        await addFile(file)
      }
    },
    [addFile],
  )

  return {
    attachments,
    isDragging,
    addFile,
    addBlob,
    addImageFromClipboard,
    removeAttachment,
    clearAttachments,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  }
}
