// Plugin types (Phase 3 §Issue 23 — UI Design Templates)

export interface PluginManifest {
  name: string
  displayName: string
  version: string
  panelType: string
  description: string
  author: string
  sandbox: boolean
  capabilities: {
    pinnable: boolean
    realtime: boolean
    incrementalUpdate: boolean
  }
  entry: string
  dataSchema?: string
}

export interface PluginState {
  manifests: Record<string, PluginManifest>
  loadErrors: Record<string, string>
  loading: boolean
}
