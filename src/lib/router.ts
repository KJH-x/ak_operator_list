import type { CatalogBox } from '@/types'
import type { BoxSelection } from './filters'
import {
  NUMERIC_TOKEN,
  buildBoxRoute,
  parseBoxRoute,
  tokenToBoxId,
  type ParsedBoxRoute,
} from './boxRoutes'

// 供 App / 组件 / 测试直接消费，无需本地 import
export { boxToToken, tokenToBoxId, NUMERIC_TOKEN, NONE_TOKEN } from './boxRoutes'

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

/** 裁掉 boxRoutes 特有的 unknownTokens/operator 字段，保持 ParsedRoute 5 字段，兼容旧测试 toEqual */
function asParsedRoute(route: ParsedBoxRoute): ParsedRoute {
  const { unknownTokens: _ignored, operatorSlot: _slot, operatorName: _name, ...rest } = route
  return rest
}

export function parseRouteHash(hash: string, boxes: CatalogBox[]): ParsedRoute | null {
  const route = parseBoxRoute(hash, boxes)
  return route ? asParsedRoute(route) : null
}

/** 严格解析：对外暴露 unknownTokens / operator 字段（C1 未知盒提示、A6 干员深链用） */
export function parseBoxRouteStrict(hash: string, boxes: CatalogBox[]): ParsedBoxRoute | null {
  return parseBoxRoute(hash, boxes)
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
  // 用 boxRoutes 的统一解析替代旧 router.ts:103-111 的两段式判断
  if (NUMERIC_TOKEN.test(decoded) || boxes.some((box) => box.id === decoded)) {
    const id = tokenToBoxId(decoded, boxes)
    if (id) return { boxIds: [id], type: 'all', query: '', hasRoute: true, empty: false }
    return null
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
    if (routeSegments.length) {
      const parsed = parseBoxRoute(`#${routeSegments.join('&')}`, boxes)
      if (parsed) route = asParsedRoute(parsed)
    }
  }
  if (!route) {
    const pathRoute = parsePathRoute(pathname, boxes)
    if (pathRoute) route = pathRoute
  }
  return { sharePayload, route }
}

// 修复：旧 buildRouteHash 在「custom 选择全为已删除盒」时退化成 #none（详见 first-wave §3.1 bug 报告）
export function buildRouteHash(
  selection: BoxSelection,
  type: string,
  query: string,
  boxes: CatalogBox[],
): string {
  if (!selection.custom) return ''
  const selectedIds = selection.selectedIds
  const empty = selectedIds.length === 0
  const resolvable = selectedIds.filter((id) => boxes.some((box) => box.id === id))
  if (!empty && resolvable.length === 0) return ''
  return buildBoxRoute(boxes, resolvable, { type, query, empty })
}
