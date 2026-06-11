import { VALID_CATEGORY_SET, normalizeTags } from '@/types/layout'

/** Category order shown in menus (matches tab order, excludes 'all') */
export const CATEGORY_ORDER = ['important', 'daily', 'work', 'entertainment', 'other'] as const

/** Add a category: clears the auto-fallback 'other' (unless adding 'other'), keeps non-category tags, dedupes */
export function addCategoryTag(currentTags: string[] | undefined, category: string): string[] {
  if (!VALID_CATEGORY_SET.has(category)) return normalizeTags(currentTags)
  const rest = (currentTags ?? []).filter((t) => t !== category && t !== 'other')
  return normalizeTags([...rest, category])
}

/** Toggle a category: removes if present (normalizeTags restores 'other' if none left), otherwise adds */
export function toggleCategoryTag(currentTags: string[] | undefined, category: string): string[] {
  const tags = currentTags ?? []
  if (tags.includes(category)) {
    return normalizeTags(tags.filter((t) => t !== category))
  }
  return addCategoryTag(tags, category)
}
