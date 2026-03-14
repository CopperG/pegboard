import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { useChatStore } from '@/stores/chat-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useFileUpload } from '@/hooks/useFileUpload'
import { ChatMessage } from './ChatMessage'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getPanelIcon } from '@/lib/panel-icons'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GripHorizontal,
  Mic,
  MicOff,
  Paperclip,
  X,
  Minus,
  FileIcon,
  Music,
} from 'lucide-react'
import type { UserMessage } from '@/types/websocket'
import type { PanelState } from '@/types/store'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatFloatingBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('chat')
  const { t: tCommon } = useTranslation('common')
  const [expanded, setExpanded] = useState(true)
  const [value, setValue] = useState('')
  const constraintsRef = useRef<HTMLDivElement>(null)
  const messages = useChatStore((s) => s.messages)
  const panels = useCanvasStore((s) => s.panels)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // @ autocomplete state
  const [autocompleteOpen, setAutocompleteOpen] = useState(false)
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const [atTriggerPos, setAtTriggerPos] = useState<number | null>(null)
  const referencedPanelIdsRef = useRef<Set<string>>(new Set())

  // Audio recorder
  const recorder = useAudioRecorder()

  // File upload
  const {
    attachments,
    isDragging,
    addFile,
    addBlob,
    addImageFromClipboard,
    removeAttachment,
    clearAttachments,
    dragHandlers,
  } = useFileUpload()

  // Derive the filter query from value and atTriggerPos
  const autocompleteQuery = useMemo(() => {
    if (atTriggerPos === null) return ''
    return value.slice(atTriggerPos + 1) // text after @
  }, [value, atTriggerPos])

  // Filter panels by title based on query
  const filteredPanels = useMemo(() => {
    const query = autocompleteQuery.toLowerCase()
    return panels.filter((p) => p.title.toLowerCase().includes(query))
  }, [panels, autocompleteQuery])

  // Reset autocomplete index when filtered list changes
  useEffect(() => {
    setAutocompleteIndex(0)
  }, [filteredPanels.length])

  // Scroll to bottom when messages change and expanded
  useEffect(() => {
    if (expanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, expanded])

  // Cmd+J keyboard shortcut to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setExpanded((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Track referenced panel ids — remove if @mention text is deleted
  useEffect(() => {
    const currentIds = referencedPanelIdsRef.current
    const idsToRemove: string[] = []

    for (const id of currentIds) {
      const panel = panels.find((p) => p.panelId === id)
      if (panel && !value.includes(`@${panel.title}`)) {
        idsToRemove.push(id)
      }
    }

    for (const id of idsToRemove) {
      currentIds.delete(id)
    }
  }, [value, panels])

  const closeAutocomplete = useCallback(() => {
    setAutocompleteOpen(false)
    setAtTriggerPos(null)
    setAutocompleteIndex(0)
  }, [])

  const selectPanel = useCallback(
    (panel: PanelState) => {
      if (atTriggerPos === null) return

      // Replace @query with @panelTitle (with trailing space)
      const before = value.slice(0, atTriggerPos)
      const after = value.slice(atTriggerPos + 1 + autocompleteQuery.length)
      const newValue = `${before}@${panel.title} ${after}`

      setValue(newValue)
      referencedPanelIdsRef.current.add(panel.panelId)
      closeAutocomplete()
      inputRef.current?.focus()
    },
    [value, atTriggerPos, autocompleteQuery, closeAutocomplete],
  )

  const sendMessage = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed && attachments.length === 0) return

    const referencedPanelIds = referencedPanelIdsRef.current
    const canvasState = useCanvasStore.getState().getCanvasState()
    const allPanels = useCanvasStore.getState().panels

    // Build the UserMessage for WS
    const userMessage: UserMessage = {
      type: 'user_message',
      content: trimmed,
      canvasState,
      referencedPanels: Array.from(referencedPanelIds)
        .map((id) => {
          const panel = allPanels.find((p) => p.panelId === id)
          return panel
            ? { panelId: id, panelType: panel.panelType, data: panel.data }
            : null
        })
        .filter(
          (p): p is { panelId: string; panelType: string; data: unknown } =>
            p !== null,
        ),
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date().toISOString(),
    }

    // Add to local chat store
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: userMessage.timestamp,
      referencedPanels: Array.from(referencedPanelIds),
    })

    // Send via Tauri
    try {
      await invoke('send_ws_message', {
        message: JSON.stringify(userMessage),
      })
    } catch (err) {
      console.warn('[ChatFloatingBar] Failed to send WS message:', err)
    }

    setValue('')
    clearAttachments()
    referencedPanelIdsRef.current = new Set()
    closeAutocomplete()
    inputRef.current?.focus()
  }, [value, attachments, clearAttachments, closeAutocomplete])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      const cursorPos = e.target.selectionStart ?? newValue.length

      setValue(newValue)

      // Check for @ trigger
      // Look backwards from cursor position for an @ that's at start or after a space
      let foundAt = false
      for (let i = cursorPos - 1; i >= 0; i--) {
        const ch = newValue[i]
        if (ch === '@') {
          // Valid trigger: at start or preceded by space
          if (i === 0 || newValue[i - 1] === ' ') {
            // Check no space between @ and cursor (autocomplete query shouldn't contain spaces for simplicity)
            const queryPart = newValue.slice(i + 1, cursorPos)
            if (!queryPart.includes(' ')) {
              setAtTriggerPos(i)
              setAutocompleteOpen(true)
              foundAt = true
            }
          }
          break
        }
        if (ch === ' ') {
          // Hit a space before finding @, stop looking
          break
        }
      }

      if (!foundAt) {
        closeAutocomplete()
      }
    },
    [closeAutocomplete],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (autocompleteOpen && filteredPanels.length > 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setAutocompleteIndex((prev) =>
            prev <= 0 ? filteredPanels.length - 1 : prev - 1,
          )
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setAutocompleteIndex((prev) =>
            prev >= filteredPanels.length - 1 ? 0 : prev + 1,
          )
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          const selected = filteredPanels[autocompleteIndex]
          if (selected) {
            selectPanel(selected)
          }
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          closeAutocomplete()
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void sendMessage()
      }
    },
    [
      autocompleteOpen,
      filteredPanels,
      autocompleteIndex,
      selectPanel,
      closeAutocomplete,
      sendMessage,
    ],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      // Check for image in clipboard
      const items = e.clipboardData?.items
      if (items) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            // Found an image, handle it via useFileUpload
            void addImageFromClipboard(e.nativeEvent as ClipboardEvent)
            return
          }
        }
      }
      // No image — let default text paste behavior proceed
    },
    [addImageFromClipboard],
  )

  const handleRecordToggle = useCallback(async () => {
    if (recorder.isRecording) {
      try {
        const blob = await recorder.stop()
        const ext = blob.type.includes('webm') ? 'webm' : 'wav'
        const name = `recording-${Date.now()}.${ext}`
        await addBlob(blob, name)
      } catch (err) {
        console.warn('[ChatFloatingBar] Failed to stop recording:', err)
      }
    } else {
      await recorder.start()
    }
  }, [recorder, addBlob])

  const handleFilePickerChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files) return
      for (const file of Array.from(files)) {
        await addFile(file)
      }
      // Reset file input value so same file can be selected again
      e.target.value = ''
    },
    [addFile],
  )

  const isEmpty = value.trim().length === 0 && attachments.length === 0

  const visibleAttachments = attachments.slice(0, 5)
  const overflowCount = Math.max(0, attachments.length - 5)

  if (!open) return null

  return (
    <>
      {/* Full-screen drag constraints ref */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[99]" />

      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        dragElastic={0}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed bottom-6 right-6 z-[100] w-[420px] max-w-[calc(100vw-5rem)] rounded-xl border border-border/50 bg-card shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: expanded ? '520px' : 'auto' }}
        {...dragHandlers}
      >
        {/* Title bar — drag handle */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-border/30 cursor-grab active:cursor-grabbing select-none shrink-0"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <GripHorizontal className="w-4 h-4 text-muted-foreground" />
            <span>Chat</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? t('collapse_chat') : t('expand_chat')}
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              title={tCommon('close')}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* File drop overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-40 bg-primary/10 border-2 border-dashed border-primary/50 rounded-xl flex items-center justify-center pointer-events-none"
            >
              <span className="text-sm font-medium text-primary">
                {tCommon('drop_files_here')}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat history (collapsible) */}
        {expanded && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-4 pt-3 pb-4 space-y-1" style={{ minHeight: '200px' }}>
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
          </div>
        )}

        {/* Attachment preview bar */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="border-t border-border/30 px-3 py-2"
            >
              <div className="flex items-center gap-2 overflow-x-auto flex-wrap">
                {visibleAttachments.map((att, idx) => (
                  <div
                    key={`${att.name}-${idx}`}
                    className="flex items-center gap-1.5 bg-muted/60 rounded-md px-2 py-1 text-xs shrink-0 max-w-[180px] group"
                  >
                    {att.type === 'image' ? (
                      <img
                        src={`asset://localhost/${att.path}`}
                        alt={att.name}
                        className="w-8 h-8 object-cover rounded shrink-0"
                      />
                    ) : att.type === 'audio' ? (
                      <Music className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-foreground">{att.name}</div>
                      <div className="text-muted-foreground">
                        {formatSize(att.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="shrink-0 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={tCommon('remove_attachment')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {overflowCount > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0 px-1">
                    +{overflowCount}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input for picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilePickerChange}
        />

        {/* Input bar */}
        <div className="shrink-0 border-t border-border/30 flex items-center gap-2 px-3 py-2">
          {/* Attach file button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            title={t('attach_file')}
            aria-label={tCommon('add_attachment')}
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          {/* Input with @ autocomplete popover */}
          <Popover
            open={autocompleteOpen}
            onOpenChange={(open) => {
              if (!open) closeAutocomplete()
            }}
          >
            <PopoverTrigger
              render={<div className="flex-1" />}
              nativeButton={false}
            >
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={t('input_placeholder')}
                className="w-full h-8 px-3 text-sm bg-muted/50 border border-border rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
              />
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-[min(18rem,calc(100vw-2rem))] max-h-48 overflow-y-auto p-1"
            >
              {filteredPanels.length === 0 ? (
                <div className="text-sm text-muted-foreground px-2 py-1.5">
                  {t('no_matching_panels')}
                </div>
              ) : (
                filteredPanels.map((panel, idx) => (
                  <button
                    key={panel.panelId}
                    type="button"
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors',
                      idx === autocompleteIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted',
                    )}
                    onMouseEnter={() => setAutocompleteIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectPanel(panel)
                    }}
                  >
                    <span className="text-muted-foreground shrink-0">
                      {getPanelIcon(panel.panelType)}
                    </span>
                    <span className="flex-1 truncate">{panel.title}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {panel.panelId.slice(0, 8)}
                    </span>
                  </button>
                ))
              )}
            </PopoverContent>
          </Popover>

          {/* Recording button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void handleRecordToggle()}
            disabled={!recorder.isSupported}
            title={
              !recorder.isSupported
                ? t('mic_not_supported')
                : recorder.error
                  ? recorder.error
                  : recorder.isRecording
                    ? t('stop_recording')
                    : t('start_recording')
            }
            aria-label={recorder.isRecording ? 'Stop recording' : 'Start recording'}
            className={cn(
              recorder.isRecording &&
                'text-red-500 hover:text-red-600 motion-safe:animate-pulse',
            )}
          >
            {recorder.isSupported ? (
              <>
                <Mic className="w-4 h-4" />
                {recorder.isRecording && (
                  <span className="text-[10px] font-mono tabular-nums ml-0.5">
                    {formatDuration(recorder.duration)}
                  </span>
                )}
              </>
            ) : (
              <MicOff className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>

          <Button
            size="sm"
            disabled={isEmpty}
            onClick={() => void sendMessage()}
            className={cn(isEmpty && 'opacity-50')}
            aria-label={tCommon('send_message')}
          >
            {t('send')}
          </Button>
        </div>
      </motion.div>
    </>
  )
}
