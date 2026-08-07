import type { CatalogBox } from '@/types'
import { boxMatches, characterMatches } from './search'

export interface BoxSelection {
  custom: boolean
  selectedIds: string[]
}

export const BOX_FILTER_KEY = 'ak-pass:box-filter:v1'

export function defaultBoxSelection(): BoxSelection {
  return { custom: false, selectedIds: [] }
}

export function isBoxSelected(selection: BoxSelection, boxId: string): boolean {
  return !selection.custom || selection.selectedIds.includes(boxId)
}

export function applyBoxSelection(selectedIds: Iterable<string>): BoxSelection {
  return { custom: true, selectedIds: [...new Set(selectedIds)] }
}

export function loadBoxSelection(storage: Pick<Storage, 'getItem'>): BoxSelection {
  try {
    const raw = storage.getItem(BOX_FILTER_KEY)
    if (!raw) return defaultBoxSelection()
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultBoxSelection()
    const value = parsed as Partial<BoxSelection>
    if (typeof value.custom !== 'boolean' || !Array.isArray(value.selectedIds)) {
      return defaultBoxSelection()
    }
    return {
      custom: value.custom,
      selectedIds: value.selectedIds.filter((item): item is string => typeof item === 'string'),
    }
  } catch {
    return defaultBoxSelection()
  }
}

export function saveBoxSelection(storage: Pick<Storage, 'setItem'>, selection: BoxSelection): void {
  storage.setItem(BOX_FILTER_KEY, JSON.stringify(selection))
}

export function filterBoxes(
  boxes: CatalogBox[],
  options: {
    query: string
    type: string
    selection: BoxSelection
    pocketKeys?: Set<string>
    keyFor?: (boxId: string, characterName: string, state: 'ELITE1' | 'ELITE2') => string
  },
): CatalogBox[] {
  const query = options.query
  return boxes.flatMap((box) => {
    if (!isBoxSelected(options.selection, box.id)) return []
    if (options.type !== 'all' && box.type !== options.type) return []
    if (!query && !options.pocketKeys) return [box]

    const matchesBox = boxMatches(box, query)
    const characters = box.characters.filter((character) => {
      const matchesQuery = !query || matchesBox || characterMatches(character, query)
      if (!matchesQuery) return false
      if (!options.pocketKeys || !options.keyFor) return true
      return character.variants.some((variant) => options.pocketKeys?.has(
        options.keyFor?.(box.id, character.name, variant.state) ?? '',
      ))
    })
    return characters.length ? [{ ...box, characters }] : []
  })
}
