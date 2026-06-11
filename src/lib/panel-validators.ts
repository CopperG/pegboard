import { PanelDataSchemaMap } from '@/types/panel-data'

/** Whether a structured-data schema exists for this panel type (html/_fallback have none) */
export function hasPanelDataSchema(panelType: string): boolean {
  return panelType in PanelDataSchemaMap
}

export function validatePanelData(
  panelType: string,
  data: unknown,
): { success: boolean; error?: string } {
  const schema = PanelDataSchemaMap[panelType]
  if (!schema) {
    return { success: false, error: `Unknown panel type: ${panelType}` }
  }
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true }
  }
  return { success: false, error: String(result.error) }
}
