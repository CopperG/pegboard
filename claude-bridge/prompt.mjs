const MAX_PANEL_DATA_CHARS = 4000
const MAX_PANELS_IN_STATE = 30

/**
 * Structurally prune canvasState: keep id/type/title/tags/starred per panel,
 * cap total panel count. Avoids blind char truncation that breaks JSON.
 */
export function pruneCanvasState(canvasState) {
  if (!canvasState || typeof canvasState !== 'object') return null
  const slim = (p) => {
    const out = { id: p.id, type: p.type, title: p.title }
    if (p.tags) out.tags = p.tags
    if (p.starred !== undefined) out.starred = p.starred
    return out
  }
  const pinnedAll = (canvasState.pinnedPanels ?? []).map(slim)
  const pinned = pinnedAll.slice(0, MAX_PANELS_IN_STATE)
  const transient = (canvasState.transientPanels ?? [])
    .map(slim)
    .slice(0, Math.max(0, MAX_PANELS_IN_STATE - pinned.length))
  const totalIn = (canvasState.pinnedPanels?.length ?? 0) + (canvasState.transientPanels?.length ?? 0)
  const dropped = totalIn - pinned.length - transient.length
  const pruned = {
    activeView: canvasState.activeView,
    currentTheme: canvasState.currentTheme,
    archivedCount: canvasState.archivedCount,
    pinnedPanels: pinned,
    transientPanels: transient,
  }
  if (dropped > 0) pruned.note = `${dropped} panels omitted; use canvas_query to list all`
  return pruned
}

/** Build the prompt text for one user turn. Pure function. */
export function buildPrompt({ content, canvasState, referencedPanels, attachments }) {
  const parts = [content]

  if (referencedPanels && referencedPanels.length > 0) {
    const refs = referencedPanels
      .map((p) => {
        let dataStr = JSON.stringify(p.data)
        if (dataStr && dataStr.length > MAX_PANEL_DATA_CHARS) {
          dataStr = dataStr.slice(0, MAX_PANEL_DATA_CHARS) + '...(truncated)'
        }
        return `- [${p.panelType}] id=${p.panelId} data=${dataStr}`
      })
      .join('\n')
    parts.push(`[引用面板]\n${refs}`)
  }

  if (attachments && attachments.length > 0) {
    const files = attachments
      .map((a) => `- ${a.path} (${a.mimeType}, ${a.size} bytes)`)
      .join('\n')
    parts.push(`[附件文件，可用 Read 工具读取]\n${files}`)
  }

  const pruned = pruneCanvasState(canvasState)
  if (pruned) {
    parts.push(`[当前画布状态]\n${JSON.stringify(pruned)}`)
  }

  parts.push(
    '[说明] 你正在通过 Pegboard 桥接器与用户对话。' +
      '需要在画布上展示内容时使用 pegboard skill（panel_control / canvas_query / canvas_control / theme_control）。' +
      '回复正文会显示在聊天栏，保持简洁。',
  )

  return parts.join('\n\n')
}
