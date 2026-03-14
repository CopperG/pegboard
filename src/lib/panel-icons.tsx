import type { ReactNode } from 'react'
import {
  FileText, Table2, ListChecks, BarChart3, Code2,
  ImageIcon, CalendarClock, KeyRound, Globe, Package,
} from 'lucide-react'

const PANEL_TYPE_ICON: Record<string, ReactNode> = {
  text: <FileText className="w-4 h-4" />,
  table: <Table2 className="w-4 h-4" />,
  list: <ListChecks className="w-4 h-4" />,
  chart: <BarChart3 className="w-4 h-4" />,
  code: <Code2 className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
  timeline: <CalendarClock className="w-4 h-4" />,
  kv: <KeyRound className="w-4 h-4" />,
  html: <Globe className="w-4 h-4" />,
}

export function getPanelIcon(panelType: string): ReactNode {
  return PANEL_TYPE_ICON[panelType] ?? <Package className="w-4 h-4" />
}
