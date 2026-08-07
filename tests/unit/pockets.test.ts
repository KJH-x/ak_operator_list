import { describe, expect, it } from 'vitest'

import {
  createDefaultPocketState,
  importPocketState,
  normalizePocketState,
  togglePocketItem,
} from '@/lib/pockets'

describe('pockets', () => {
  it('migrates a name-to-items object without dropping stale identifiers', () => {
    const migrated = normalizePocketState({
      pockets: {
        想要: ['["1.0","阿米娅","ELITE1"]', 'stale-key'],
      },
    })
    expect(migrated.version).toBe(1)
    expect(migrated.pockets[0]!.name).toBe('想要')
    expect(migrated.pockets[0]!.items).toContain('stale-key')
  })

  it('allows one variant to exist in multiple pockets', () => {
    const state = {
      ...createDefaultPocketState('one'),
      pockets: [
        { id: 'one', name: '一号', items: [] },
        { id: 'two', name: '二号', items: [] },
      ],
    }
    const inFirst = togglePocketItem(state, 'one', 'same-key')
    const inBoth = togglePocketItem(inFirst, 'two', 'same-key')
    expect(inBoth.pockets.every((pocket) => pocket.items.includes('same-key'))).toBe(true)
  })

  it('imports versioned JSON and removes duplicate item keys', () => {
    const imported = importPocketState(JSON.stringify({
      version: 1,
      currentPocketId: 'a',
      pockets: [{ id: 'a', name: '收藏夹', items: ['x', 'x'] }],
    }))
    expect(imported.pockets[0]!.items).toEqual(['x'])
  })
})
