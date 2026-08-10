import { describe, expect, it } from 'vitest'

import {
  aggregateOperators,
  sortBoxes,
} from '@/lib/catalog'
import { characterMatches } from '@/lib/search'
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, resolveTheme } from '@/lib/settings'
import { decodeSharePayload, encodeSharePayload } from '@/lib/share'
import { mergeSharedPocket } from '@/lib/pockets'
import type { CatalogBox, CatalogCharacter } from '@/types'

function character(name: string, operatorId = name, latinName: string | null = null): CatalogCharacter {
  return {
    slot: 1,
    name,
    operatorId,
    latinName,
    searchAliases: [],
    operatorReleaseDate: null,
    prtsPageUrl: latinName ? `https://prts.wiki/w/${latinName}` : null,
    rarity: null,
    image: null,
    sourceImageUrl: null,
    variants: [{ state: 'ELITE1', price: null }, { state: 'ELITE2', price: null }],
  }
}

function box(id: string, type: string, releaseDate: string | null, chars: CatalogCharacter[]): CatalogBox {
  return { id, group: 'numeric', type, releaseDate, replicateDates: [], retailPrice: null, characterCount: chars.length, variantCount: chars.length * 2, characters: chars }
}

describe('v2 search, sorting and operator view', () => {
  it('matches Latin, full pinyin and initials', () => {
    const ami = character('阿米娅', 'char_002_amiya', 'Amiya')
    expect(characterMatches(ami, 'Amiya')).toBe(true)
    expect(characterMatches(ami, 'amiya')).toBe(true)
    expect(characterMatches(ami, 'AMY')).toBe(true)
    expect(characterMatches(ami, '阿米')).toBe(true)
    const ke = character('刻俄柏', 'char_377_gdglow', 'Goldenglow')
    expect(characterMatches(ke, 'keebo')).toBe(true)
    expect(characterMatches(ke, 'keb')).toBe(true)
  })

  it('sorts missing dates last and reverses the final stable sequence', () => {
    const boxes = [box('unknown', 'numeric', null, []), box('late', 'numeric', '2022-01-01', []), box('early', 'numeric', '2020-01-01', [])]
    expect(sortBoxes(boxes, 'time').map((item) => item.id)).toEqual(['early', 'late', 'unknown'])
    expect(sortBoxes(boxes, 'time', true).map((item) => item.id)).toEqual(['unknown', 'late', 'early'])
  })

  it('aggregates repeated operator IDs without merging synthetic identities', () => {
    const one = character('阿米娅', 'amiya', 'Amiya')
    const two = { ...character('阿米娅', 'amiya', 'Amiya'), slot: 2 }
    const entries = aggregateOperators([box('1', 'numeric', '2020-01-01', [one]), box('2', 'numeric', '2021-01-01', [two])])
    expect(entries).toHaveLength(1)
    expect(entries[0]!.appearances).toHaveLength(2)
  })

  it('keeps unknown operator dates last in both ascending and descending order', () => {
    const known = character('早露', 'a', 'Absinthe')
    known.operatorReleaseDate = '2020-03-17'
    const unknown = character('无日期', 'z', null)
    const entries = aggregateOperators([
      box('1', 'numeric', '2020-01-01', [unknown]),
      box('2', 'numeric', '2020-01-02', [known]),
    ])
    expect(entries.map((entry) => entry.name)).toEqual(['早露', '无日期'])
    const reversed = aggregateOperators([
      box('1', 'numeric', '2020-01-01', [unknown]),
      box('2', 'numeric', '2020-01-02', [known]),
    ], true)
    expect(reversed.map((entry) => entry.name)).toEqual(['早露', '无日期'])
  })
})

describe('settings and pocket sharing', () => {
  it('migrates malformed and partial settings to explicit defaults', () => {
    expect(normalizeSettings({ theme: 'dark', avatarSize: 'compact' })).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', avatarSize: 'compact' })
    expect(loadSettings({ getItem: () => '{bad' })).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.theme).toBe('system')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('round-trips compressed payloads and rejects unknown versions', () => {
    const encoded = encodeSharePayload({ version: 1, pocketName: '想要', items: ['a', 'a', 'b'], sourceHash: 'hash' })
    expect(decodeSharePayload(encoded)).toEqual({ version: 1, pocketName: '想要', items: ['a', 'b'], sourceHash: 'hash' })
    expect(() => decodeSharePayload('bad')).toThrow()
  })

  it('merges same-name pockets while retaining unrelated pockets and stale keys', () => {
    const state = { version: 1 as const, currentPocketId: 'a', pockets: [{ id: 'a', name: '想要', items: ['old'] }, { id: 'b', name: '其他', items: ['keep'] }] }
    const merged = mergeSharedPocket(state, { version: 1, pocketName: '想要', items: ['old', 'new', 'stale'], sourceHash: 'other' })
    expect(merged.pockets).toHaveLength(2)
    expect(merged.pockets[0]!.items).toEqual(['old', 'new', 'stale'])
    expect(merged.pockets[1]!.items).toEqual(['keep'])
  })
})
