import { PanelDataSchemaMap } from '@/types/panel-data'

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
