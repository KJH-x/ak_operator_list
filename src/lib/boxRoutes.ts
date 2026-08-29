// 盒路由 token 的单一事实源：boxId ↔ token 映射、解析、生成。
// token 规则与 README:14 / 旧 router.ts:21-41 对齐：
//   数字盒   /^\d+\.0$/  -> 去 ".0"（如 52.0 -> "52"）
//   非数字盒             -> encodeURIComponent(完整 id)（如 "特别通行认证" -> "%E7%89%B9..."）
//   多盒用 "+" 连接，type= / q= / op= / c= 用 "&" 作为独立段
import type { CatalogBox } from '@/types'

export const NUMERIC_TOKEN = /^\d+(?:\.0)?$/
export const TYPE_VALUES = new Set(['numeric', 'ambience', 'cooperation', 'special', 'whitelist'])
export const NONE_TOKEN = 'none'

export interface ParsedBoxRoute {
  boxIds: string[]
  type: string
  query: string
  hasRoute: boolean
  empty: boolean
  /** 未能解析的原始 token（C1 未知盒提示用） */
  unknownTokens: string[]
  /** A6 干员级深链：盒内槽位（#52&op=3） */
  operatorSlot: number | null
  /** A6 干员级深链：角色名（#52&c=名字） */
  operatorName: string | null
}

export interface BoxRouteOptions {
  type?: string
  query?: string
  /** true 表示"一盒都不显示"（#none），对应 applyBoxSelection([]) */
  empty?: boolean
  /** A6 干员级深链：槽位 */
  operatorSlot?: number
  /** A6 干员级深链：角色名 */
  operatorName?: string
}

function numericBoxId(token: string, boxes: CatalogBox[]): string | null {
  const target = token.includes('.') ? token : `${token}.0`
  return boxes.some((box) => box.type === 'numeric' && box.id === target) ? target : null
}

/** boxId -> token（原 router.ts:37-41） */
export function boxToToken(box: Pick<CatalogBox, 'id'>): string {
  const match = box.id.match(/^(\d+)\.0$/)
  if (match?.[1]) return match[1]
  return encodeURIComponent(box.id)
}

/** token -> boxId，解析失败返回 null（原 router.ts:26-35） */
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

/** boxId -> token 索引（A2 / 导航页消费 box-routes.json 时的运行时等价物） */
export function buildBoxTokenMap(boxes: CatalogBox[]): ReadonlyMap<string, string> {
  return new Map(boxes.map((box) => [box.id, boxToToken(box)]))
}

export function resolveTokens(tokens: string[], boxes: CatalogBox[]): { boxIds: string[]; unknown: string[] } {
  const boxIds: string[] = []
  const unknown: string[] = []
  for (const token of tokens) {
    const id = tokenToBoxId(token, boxes)
    if (id && !boxIds.includes(id)) boxIds.push(id)
    else if (!id) unknown.push(token)
  }
  return { boxIds, unknown }
}

/** 解析 hash 体（原 router.ts:43-82 parseSegments 的语义，另带 unknownTokens 与 A6 干员级深链） */
export function parseBoxRoute(hash: string, boxes: CatalogBox[]): ParsedBoxRoute | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash
  if (!body) return null
  let type = 'all'
  let query = ''
  let hasNone = false
  let hasToken = false
  let operatorSlot: number | null = null
  let operatorName: string | null = null
  const rawTokens: string[] = []
  for (const segment of body.split('&')) {
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
    if (segment.startsWith('op=')) {
      const value = Number(segment.slice('op='.length))
      if (Number.isInteger(value) && value > 0) operatorSlot = value
      continue
    }
    if (segment.startsWith('c=')) {
      try {
        operatorName = decodeURIComponent(segment.slice('c='.length))
      } catch {
        operatorName = ''
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
      rawTokens.push(token)
    }
  }
  if (!hasToken && type === 'all' && query === '' && operatorSlot === null && operatorName === null) return null
  const { boxIds, unknown } = resolveTokens(rawTokens, boxes)
  return {
    boxIds: hasNone && boxIds.length === 0 ? [] : boxIds,
    type,
    query,
    hasRoute: true,
    empty: hasNone && boxIds.length === 0,
    unknownTokens: unknown,
    operatorSlot,
    operatorName,
  }
}

/** 组装规范 hash：`#52+7&type=numeric&q=...`；空选择 -> `#none`（原 router.ts:136-156） */
export function buildBoxRoute(
  boxes: CatalogBox[],
  boxIds: string[],
  options: BoxRouteOptions = {},
): string {
  const type = options.type ?? 'all'
  const query = options.query ?? ''
  const parts: string[] = []
  if (options.empty) {
    parts.push(NONE_TOKEN)
  } else {
    const tokens: string[] = []
    for (const id of boxIds) {
      const box = boxes.find((candidate) => candidate.id === id)
      if (box) tokens.push(boxToToken(box))
    }
    if (tokens.length) parts.push(tokens.join('+'))
  }
  if (type !== 'all') parts.push(`type=${type}`)
  if (query) parts.push(`q=${encodeURIComponent(query)}`)
  if (options.operatorSlot != null) parts.push(`op=${options.operatorSlot}`)
  if (options.operatorName) parts.push(`c=${encodeURIComponent(options.operatorName)}`)
  if (!parts.length) return ''
  return `#${parts.join('&')}`
}

/** 单盒规范 hash（A1 复制链接用，无需整表） */
export function buildSingleBoxRoute(box: Pick<CatalogBox, 'id'>): string {
  return `#${boxToToken(box)}`
}
