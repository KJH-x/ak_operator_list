import type { CatalogBox } from '@/types'
import type { BoxSelection } from './filters'

const NUMERIC_TOKEN = /^\d+(?:\.0)?$/
const TYPE_VALUES = new Set(['numeric', 'ambience', 'cooperation', 'special', 'whitelist'])
const NONE_TOKEN = 'none'

export interface ParsedRoute {
  boxIds: string[]
  type: string
  query: string
  hasRoute: boolean
  empty: boolean
}

export interface UrlParseResult {
  sharePayload: string | null
  route: ParsedRoute | null
}

function numericBoxId(token: string, boxes: CatalogBox[]): string | null {
  const target = token.includes('.') ? token : `${token}.0`
  return boxes.some((box) => box.type === 'numeric' && box.id === target) ? target : null
}

export function tokenToBoxId(token: string, boxes: CatalogBox[]): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(token)
  } catch {
    return null
  }
  if (NUMERIC_TOKEN.test(decoded)) return numericBoxId(decoded, boxes)
  return boxes.some((box) => box.id === decoded) ? decoded : null
}

export function boxToToken(box: CatalogBox): string {
  const match = box.id.match(/^(\d+)\.0$/)
  if (match?.[1]) return match[1]
  return encodeURIComponent(box.id)
}

function parseSegments(segments: string[], boxes: CatalogBox[]): ParsedRoute | null {
  let type = 'all'
  let query = ''
  let hasNone = false
  let hasToken = false
  const boxIds: string[] = []
  for (const segment of segments) {
    if (segment.startsWith('type=')) {
      const value = segment.slice('type='.length)
      if (TYPE_VALUES.has(value)) type = value
      continue
    }
    if (segment.startsWith('q=')) {
      try {
        query = decodeURIComponent(segment.slice('q='.length))
      } catch {
        query = ''
      }
      continue
    }
    for (const token of segment.split('+')) {
      if (!token) continue
      hasToken = true
      if (token === NONE_TOKEN) {
        hasNone = true
        continue
      }
      const id = tokenToBoxId(token, boxes)
      if (id && !boxIds.includes(id)) boxIds.push(id)
    }
  }
  if (!hasToken && type === 'all' && query === '') return null
  return {
    boxIds: hasNone && boxIds.length === 0 ? [] : boxIds,
    type,
    query,
    hasRoute: true,
    empty: hasNone && boxIds.length === 0,
  }
}

export function parseRouteHash(hash: string, boxes: CatalogBox[]): ParsedRoute | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash
  if (!body) return null
  return parseSegments(body.split('&'), boxes)
}

export function parsePathRoute(pathname: string, boxes: CatalogBox[]): ParsedRoute | null {
  const withoutQuery = pathname.includes('?') ? pathname.slice(0, pathname.indexOf('?')) : pathname
  const trimmed = withoutQuery.length > 1 && withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery
  const segments = trimmed.split('/').filter(Boolean)
  if (segments.length !== 1) return null
  const token = segments[0]
  if (!token) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(token)
  } catch {
    return null
  }
  if (NUMERIC_TOKEN.test(decoded)) {
    const id = numericBoxId(decoded, boxes)
    if (id) return { boxIds: [id], type: 'all', query: '', hasRoute: true, empty: false }
    return null
  }
  if (boxes.some((box) => box.id === decoded)) {
    return { boxIds: [decoded], type: 'all', query: '', hasRoute: true, empty: false }
  }
  return null
}

export function parseUrl(hash: string, pathname: string, boxes: CatalogBox[]): UrlParseResult {
  let sharePayload: string | null = null
  let route: ParsedRoute | null = null
  const body = hash.startsWith('#') ? hash.slice(1) : hash
  if (body) {
    const routeSegments: string[] = []
    for (const segment of body.split('&')) {
      if (segment.startsWith('p=')) {
        sharePayload = segment.slice('p='.length)
      } else if (segment) {
        routeSegments.push(segment)
      }
    }
    if (routeSegments.length) route = parseSegments(routeSegments, boxes)
  }
  if (!route) {
    const pathRoute = parsePathRoute(pathname, boxes)
    if (pathRoute) route = pathRoute
  }
  return { sharePayload, route }
}

export function buildRouteHash(
  selection: BoxSelection,
  type: string,
  query: string,
  boxes: CatalogBox[],
): string {
  const tokens: string[] = []
  if (selection.custom) {
    for (const id of selection.selectedIds) {
      const box = boxes.find((candidate) => candidate.id === id)
      if (box) tokens.push(boxToToken(box))
    }
    if (tokens.length === 0) tokens.push(NONE_TOKEN)
  }
  const parts: string[] = []
  if (tokens.length) parts.push(tokens.join('+'))
  if (type !== 'all') parts.push(`type=${type}`)
  if (query) parts.push(`q=${encodeURIComponent(query)}`)
  if (!parts.length) return ''
  return `#${parts.join('&')}`
}
