import { describe, it, expect } from 'vitest'
import { addCategoryTag, toggleCategoryTag, CATEGORY_ORDER } from '@/lib/category-tags'

describe('CATEGORY_ORDER', () => {
  it('contains all 5 categories in tab order', () => {
    expect(CATEGORY_ORDER).toEqual(['important', 'daily', 'work', 'entertainment', 'other'])
  })
})

describe('addCategoryTag', () => {
  it('adds category and clears the fallback other', () => {
    expect(addCategoryTag(['other'], 'work')).toEqual(['work'])
  })

  it('keeps other categories and non-category tags', () => {
    expect(addCategoryTag(['daily', 'foo'], 'work')).toEqual(['daily', 'foo', 'work'])
  })

  it('does not duplicate an existing category', () => {
    expect(addCategoryTag(['work'], 'work')).toEqual(['work'])
  })

  it('ignores invalid category names', () => {
    expect(addCategoryTag(['work'], 'bogus')).toEqual(['work'])
  })
})

describe('toggleCategoryTag', () => {
  it('adds when not present', () => {
    expect(toggleCategoryTag(['other'], 'work')).toEqual(['work'])
  })

  it('removes when present', () => {
    expect(toggleCategoryTag(['work', 'daily'], 'work')).toEqual(['daily'])
  })

  it('falls back to other when removing the last category', () => {
    expect(toggleCategoryTag(['work'], 'work')).toEqual(['other'])
  })

  it('keeps other stable when toggling the lone other', () => {
    expect(toggleCategoryTag(['other'], 'other')).toEqual(['other'])
  })

  it('handles undefined input', () => {
    expect(toggleCategoryTag(undefined, 'work')).toEqual(['work'])
  })
})
