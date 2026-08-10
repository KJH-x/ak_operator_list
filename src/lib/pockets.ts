import type { Pocket, PocketState, SharedPocketPayload } from '@/types'

export const POCKET_STORAGE_KEY = 'ak-pass:pockets:v1'

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `pocket-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  return value.trim().slice(0, 24) || fallback
}

function cleanItems(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))]
}

export function createDefaultPocketState(id = makeId()): PocketState {
  return {
    version: 1,
    currentPocketId: id,
    pockets: [{ id, name: '收藏夹', items: [] }],
  }
}

function normalizePocket(value: unknown, index: number): Pocket | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Pocket>
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : makeId(),
    name: cleanName(candidate.name, `口袋 ${index + 1}`),
    items: cleanItems(candidate.items),
  }
}

export function normalizePocketState(value: unknown): PocketState {
  if (!value || typeof value !== 'object') return createDefaultPocketState()
  const candidate = value as { version?: unknown; currentPocketId?: unknown; pockets?: unknown }

  let pockets: Pocket[] = []
  if (Array.isArray(candidate.pockets)) {
    pockets = candidate.pockets
      .map(normalizePocket)
      .filter((pocket): pocket is Pocket => pocket !== null)
  } else if (candidate.pockets && typeof candidate.pockets === 'object') {
    pockets = Object.entries(candidate.pockets).map(([name, items]) => ({
      id: makeId(),
      name: cleanName(name, '收藏夹'),
      items: cleanItems(items),
    }))
  }

  if (!pockets.length) return createDefaultPocketState()
  const requested = typeof candidate.currentPocketId === 'string' ? candidate.currentPocketId : ''
  const currentPocketId = pockets.some((pocket) => pocket.id === requested) ? requested : pockets[0]!.id
  return { version: 1, currentPocketId, pockets }
}

export function loadPocketState(storage: Pick<Storage, 'getItem'>): PocketState {
  try {
    const raw = storage.getItem(POCKET_STORAGE_KEY)
    return raw ? normalizePocketState(JSON.parse(raw)) : createDefaultPocketState()
  } catch {
    return createDefaultPocketState()
  }
}

export function savePocketState(storage: Pick<Storage, 'setItem'>, state: PocketState): void {
  storage.setItem(POCKET_STORAGE_KEY, JSON.stringify(state))
}

export function addPocket(state: PocketState, name: string): PocketState {
  const pocket = { id: makeId(), name: cleanName(name, `口袋 ${state.pockets.length + 1}`), items: [] }
  return { ...state, currentPocketId: pocket.id, pockets: [...state.pockets, pocket] }
}

export function renamePocket(state: PocketState, pocketId: string, name: string): PocketState {
  return {
    ...state,
    pockets: state.pockets.map((pocket) => (
      pocket.id === pocketId ? { ...pocket, name: cleanName(name, pocket.name) } : pocket
    )),
  }
}

export function deletePocket(state: PocketState, pocketId: string): PocketState {
  if (state.pockets.length === 1) return createDefaultPocketState(state.pockets[0]!.id)
  const pockets = state.pockets.filter((pocket) => pocket.id !== pocketId)
  return {
    ...state,
    currentPocketId: state.currentPocketId === pocketId ? pockets[0]!.id : state.currentPocketId,
    pockets,
  }
}

export function togglePocketItem(state: PocketState, pocketId: string, key: string): PocketState {
  return {
    ...state,
    pockets: state.pockets.map((pocket) => {
      if (pocket.id !== pocketId) return pocket
      const items = pocket.items.includes(key)
        ? pocket.items.filter((item) => item !== key)
        : [...pocket.items, key]
      return { ...pocket, items }
    }),
  }
}

export function clearPocket(state: PocketState, pocketId: string): PocketState {
  return {
    ...state,
    pockets: state.pockets.map((pocket) => pocket.id === pocketId ? { ...pocket, items: [] } : pocket),
  }
}

export function importPocketState(json: string): PocketState {
  return normalizePocketState(JSON.parse(json) as unknown)
}

export function exportPocketState(state: PocketState): string {
  return `${JSON.stringify(state, null, 2)}\n`
}

/** Merge a shared pocket without replacing unrelated local pockets. */
export function mergeSharedPocket(state: PocketState, payload: SharedPocketPayload): PocketState {
  const incoming = cleanItems(payload.items)
  const sameName = state.pockets.find((pocket) => pocket.name === cleanName(payload.pocketName, '收藏夹'))
  if (sameName) {
    return {
      ...state,
      currentPocketId: sameName.id,
      pockets: state.pockets.map((pocket) => pocket.id === sameName.id
        ? { ...pocket, items: [...new Set([...pocket.items, ...incoming])] }
        : pocket),
    }
  }
  const pocket: Pocket = {
    id: makeId(),
    name: cleanName(payload.pocketName, `口袋 ${state.pockets.length + 1}`),
    items: incoming,
  }
  return { ...state, currentPocketId: pocket.id, pockets: [...state.pockets, pocket] }
}

/** Count incoming shared items that already exist in any local pocket. */
export function sharedDuplicateCount(state: PocketState, payload: SharedPocketPayload): number {
  const incoming = cleanItems(payload.items)
  const existing = new Set(state.pockets.flatMap((pocket) => pocket.items))
  return incoming.filter((item) => existing.has(item)).length
}
