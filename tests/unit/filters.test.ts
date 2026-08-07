import { describe, expect, it } from 'vitest'

import {
  applyBoxSelection,
  defaultBoxSelection,
  isBoxSelected,
  loadBoxSelection,
} from '@/lib/filters'

describe('box selection', () => {
  it('shows newly added boxes in default mode', () => {
    expect(isBoxSelected(defaultBoxSelection(), 'new-box')).toBe(true)
  })

  it('keeps newly added boxes out of a custom selection', () => {
    const selection = applyBoxSelection(['1.0', '2.0'])
    expect(isBoxSelected(selection, '1.0')).toBe(true)
    expect(isBoxSelected(selection, 'new-box')).toBe(false)
  })

  it('falls back safely when persisted state is malformed', () => {
    const storage = { getItem: () => '{bad json' }
    expect(loadBoxSelection(storage)).toEqual(defaultBoxSelection())
  })
})
