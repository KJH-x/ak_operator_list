import type {
  CatalogBox,
  CatalogCharacter,
  CatalogSnapshot,
  CatalogVariant,
  VariantIdentity,
  VariantState,
} from '@/types'
import { characterMatches, normalizeSearchText } from './search'

export type PriceBand = 'low' | 'standard' | 'high' | 'missing'

export function priceBand(price: number | null): PriceBand {
  if (price === null) return 'missing'
  if (price < 25) return 'low'
  if (price > 25) return 'high'
  return 'standard'
}

export function formatPrice(price: number | null): string {
  return price === null ? '暂无报价' : `${price} 元`
}

export function stateLabel(state: VariantState): string {
  return state === 'ELITE1' ? '精1' : '精2'
}

export function variantKey(identity: VariantIdentity): string {
  return JSON.stringify([identity.boxId, identity.characterName, identity.state])
}

export function parseVariantKey(key: string): VariantIdentity | null {
  try {
    const parsed: unknown = JSON.parse(key)
    if (!Array.isArray(parsed) || parsed.length !== 3) return null
    const [boxId, characterName, state] = parsed
    if (typeof boxId !== 'string' || typeof characterName !== 'string') return null
    if (state !== 'ELITE1' && state !== 'ELITE2') return null
    return { boxId, characterName, state }
  } catch {
    return null
  }
}

export interface IndexedVariant extends VariantIdentity {
  key: string
  box: CatalogBox
  character: CatalogCharacter
  variant: CatalogVariant
}

export function buildVariantIndex(catalog: CatalogSnapshot): Map<string, IndexedVariant> {
  const index = new Map<string, IndexedVariant>()
  for (const box of catalog.boxes) {
    for (const character of box.characters) {
      for (const variant of character.variants) {
        const identity = { boxId: box.id, characterName: character.name, state: variant.state }
        const key = variantKey(identity)
        index.set(key, { ...identity, key, box, character, variant })
      }
    }
  }
  return index
}

export function variantFor(character: CatalogCharacter, state: VariantState): CatalogVariant | null {
  return character.variants.find((variant) => variant.state === state) ?? null
}

export const CATEGORY_ORDER: Record<string, number> = {
  numeric: 0,
  ambience: 1,
  cooperation: 2,
  special: 3,
  whitelist: 4,
}

function dateSortValue(value: string | null): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.POSITIVE_INFINITY
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

/** Stable box ordering. Reversal is deliberately applied after all tie-breaks. */
export function sortBoxes<T extends CatalogBox>(boxes: T[], base: 'category-time' | 'time' = 'category-time', reversed = false): T[] {
  const withIndex = boxes.map((box, index) => ({ box, index }))
  withIndex.sort((a, b) => {
    const category = base === 'category-time'
      ? (CATEGORY_ORDER[a.box.type] ?? 3) - (CATEGORY_ORDER[b.box.type] ?? 3)
      : 0
    if (category) return category
    const date = dateSortValue(a.box.releaseDate) - dateSortValue(b.box.releaseDate)
    if (date) return date
    return a.index - b.index
  })
  const result = withIndex.map(({ box }) => box)
  return reversed ? result.reverse() : result
}

export interface OperatorAppearance {
  box: CatalogBox
  character: CatalogCharacter
}

export interface OperatorAggregate {
  operatorId: string
  name: string
  latinName: string | null
  searchAliases: string[]
  operatorReleaseDate: string | null
  appearances: OperatorAppearance[]
}

export function aggregateOperators(boxes: CatalogBox[], reversed = false): OperatorAggregate[] {
  const map = new Map<string, OperatorAggregate>()
  for (const box of boxes) {
    for (const character of box.characters) {
      const existing = map.get(character.operatorId)
      if (existing) {
        existing.appearances.push({ box, character })
      } else {
        map.set(character.operatorId, {
          operatorId: character.operatorId,
          name: character.name,
          latinName: character.latinName,
          searchAliases: character.searchAliases,
          operatorReleaseDate: character.operatorReleaseDate,
          appearances: [{ box, character }],
        })
      }
    }
  }
  const entries = [...map.values()]
  entries.forEach((entry) => {
    entry.appearances.sort((a, b) => {
      const date = dateSortValue(a.box.releaseDate) - dateSortValue(b.box.releaseDate)
      return date || a.character.slot - b.character.slot
    })
  })
  const known = entries.filter((entry) => entry.operatorReleaseDate)
  const unknown = entries.filter((entry) => !entry.operatorReleaseDate)
  known.sort((a, b) => {
    const date = dateSortValue(a.operatorReleaseDate) - dateSortValue(b.operatorReleaseDate)
    return date || 0
  })
  if (reversed) known.reverse()
  return [...known, ...unknown]
}

export function filterOperatorAggregates(entries: OperatorAggregate[], query: string): OperatorAggregate[] {
  const needle = normalizeSearchText(query)
  if (!needle) return entries
  return entries.filter((entry) => {
    const values = [entry.name, entry.latinName ?? '', ...entry.searchAliases]
    return values.some((value) => normalizeSearchText(value).includes(needle))
      || entry.appearances.some(({ character }) => characterMatches(character, query))
  })
}
