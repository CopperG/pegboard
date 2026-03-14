// Panel Data Zod schemas — 8 panel types (Spec §3.2)

import { z } from 'zod/v4'

// ── TextPanel (§3.2.1) ────────────────────────────────────────────────

export const TextPanelDataSchema = z.object({
  summary: z.string(),
  content: z.string(),
  format: z.enum(['markdown', 'plaintext']),
  wordCount: z.number().optional(),
  toc: z
    .array(
      z.object({
        level: z.number(),
        text: z.string(),
        id: z.string(),
      }),
    )
    .optional(),
})

export type TextPanelData = z.infer<typeof TextPanelDataSchema>

// ── TablePanel (§3.2.2) ───────────────────────────────────────────────

export const TablePanelDataSchema = z.object({
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      align: z.enum(['left', 'center', 'right']).optional(),
      format: z
        .enum(['text', 'number', 'currency', 'percent', 'date'])
        .optional(),
      width: z.number().optional(),
    }),
  ),
  rows: z.array(z.record(z.string(), z.unknown())),
  footer: z.record(z.string(), z.unknown()).optional(),
})

export type TablePanelData = z.infer<typeof TablePanelDataSchema>

// ── ListPanel (§3.2.3) ────────────────────────────────────────────────

export const ListPanelDataSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      subtitle: z.string().optional(),
      icon: z.string().optional(),
      badge: z
        .object({
          text: z.string(),
          color: z.enum(['red', 'green', 'blue', 'yellow', 'gray']),
        })
        .optional(),
      linkedPanel: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  emptyText: z.string().optional(),
})

export type ListPanelData = z.infer<typeof ListPanelDataSchema>

// ── ChartPanel (§3.2.4) ───────────────────────────────────────────────

export const ChartPanelDataSchema = z.object({
  chartType: z.enum(['line', 'bar', 'pie', 'area']),
  data: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      series: z.string().optional(),
    }),
  ),
  xAxis: z.string(),
  yAxis: z.string(),
  legend: z.boolean().optional(),
  colors: z.array(z.string()).optional(),
})

export type ChartPanelData = z.infer<typeof ChartPanelDataSchema>

// ── CodePanel (§3.2.5) ────────────────────────────────────────────────

export const CodePanelDataSchema = z.object({
  language: z.string(),
  code: z.string(),
  highlightLines: z.array(z.number()).optional(),
  copyable: z.boolean().optional(),
  filename: z.string().optional(),
})

export type CodePanelData = z.infer<typeof CodePanelDataSchema>

// ── ImagePanel (§3.2.6) ───────────────────────────────────────────────

export const ImagePanelDataSchema = z.object({
  src: z.string(),
  caption: z.string().optional(),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

export type ImagePanelData = z.infer<typeof ImagePanelDataSchema>

// ── TimelinePanel (§3.2.7) ────────────────────────────────────────────

export const TimelinePanelDataSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      endDate: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      color: z.string().optional(),
      group: z.string().optional(),
    }),
  ),
  viewMode: z.enum(['day', 'week', 'month']),
  focusDate: z.string().optional(),
})

export type TimelinePanelData = z.infer<typeof TimelinePanelDataSchema>

// ── KVPanel (§3.2.8) ──────────────────────────────────────────────────

export const KVPanelDataSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      type: z.enum(['text', 'number', 'status', 'link']).optional(),
      status: z
        .enum(['success', 'warning', 'error', 'info'])
        .optional(),
    }),
  ),
  columns: z.number().optional(),
})

export type KVPanelData = z.infer<typeof KVPanelDataSchema>

// ── Schema Map ─────────────────────────────────────────────────────────

export const PanelDataSchemaMap: Record<string, z.ZodType> = {
  text: TextPanelDataSchema,
  table: TablePanelDataSchema,
  list: ListPanelDataSchema,
  chart: ChartPanelDataSchema,
  code: CodePanelDataSchema,
  image: ImagePanelDataSchema,
  timeline: TimelinePanelDataSchema,
  kv: KVPanelDataSchema,
}
