import { describe, expect, it } from 'vitest'

import {
  buildBoxRoute,
  buildBoxTokenMap,
  boxToToken,
  parseBoxRoute,
  tokenToBoxId,
} from '@/lib/boxRoutes'
import type { CatalogBox } from '@/types'

// 样例来自 Box_Id.json / pass-boxes.json（实读）：数字盒 + 含标点/中文/白名单特殊盒
const boxes = [
  { id: '1.0', type: 'numeric' },
  { id: '52.0', type: 'numeric' },
  { id: '50.0', type: 'numeric' },
  { id: '7.0', type: 'numeric' },
  { id: '特别通行认证', type: 'special' },
  { id: 'ManiFesto:', type: 'ambience' },
  { id: '白名单凭证1.0', type: 'whitelist' },
] as CatalogBox[]

describe('boxToToken / tokenToBoxId（Box_Id.json 实例）', () => {
  it('数字盒去 .0 后缀', () => {
    expect(boxToToken({ id: '52.0', type: 'numeric' })).toBe('52')
    expect(tokenToBoxId('52', boxes)).toBe('52.0')
    expect(tokenToBoxId('1', boxes)).toBe('1.0')
  })

  it('特殊盒用完整 id 的 encodeURIComponent', () => {
    expect(boxToToken({ id: '特别通行认证', type: 'special' }))
      .toBe(encodeURIComponent('特别通行认证'))
    expect(tokenToBoxId(encodeURIComponent('特别通行认证'), boxes)).toBe('特别通行认证')
  })

  it('含标点的 ambience 盒正确编码往返', () => {
    expect(boxToToken({ id: 'ManiFesto:', type: 'ambience' })).toBe('ManiFesto%3A')
    expect(tokenToBoxId('ManiFesto%3A', boxes)).toBe('ManiFesto:')
  })

  it('白名单凭证1.0 不误入数字盒分支', () => {
    expect(tokenToBoxId('白名单凭证1.0', boxes)).toBe('白名单凭证1.0')
    expect(tokenToBoxId(encodeURIComponent('白名单凭证1.0'), boxes)).toBe('白名单凭证1.0')
    expect(tokenToBoxId('1.0', boxes)).toBe('1.0') // 只匹配 numeric 类型
  })

  it('未知/坏 token 返回 null', () => {
    expect(tokenToBoxId('99', boxes)).toBeNull()
    expect(tokenToBoxId('garbage', boxes)).toBeNull()
    expect(tokenToBoxId('%E0%A4%A', boxes)).toBeNull() // 非法 UTF-8 序列
  })
})

describe('buildBoxTokenMap（A2 索引）', () => {
  it('给出完整 boxId->token 映射', () => {
    const map = buildBoxTokenMap(boxes)
    expect(map.size).toBe(boxes.length)
    expect(map.get('52.0')).toBe('52')
    expect(map.get('ManiFesto:')).toBe('ManiFesto%3A')
  })
})

describe('parseBoxRoute', () => {
  it('解析多盒 + 筛选并给出未知 token', () => {
    const parsed = parseBoxRoute(`#52+50+7&type=numeric&q=${encodeURIComponent('阿米娅')}`, boxes)
    expect(parsed?.boxIds).toEqual(['52.0', '50.0', '7.0'])
    expect(parsed?.type).toBe('numeric')
    expect(parsed?.query).toBe('阿米娅')
    expect(parsed?.unknownTokens).toEqual([])
  })

  it('#none 解析为空态', () => {
    expect(parseBoxRoute('#none', boxes)).toMatchObject({ boxIds: [], empty: true, hasRoute: true })
  })

  it('无法识别的 token 被标记但不下线', () => {
    const parsed = parseBoxRoute('#52+99', boxes)
    expect(parsed?.boxIds).toEqual(['52.0'])
    expect(parsed?.unknownTokens).toEqual(['99'])
    expect(parsed?.empty).toBe(false)
  })

  it('空 hash 返回 null', () => {
    expect(parseBoxRoute('', boxes)).toBeNull()
    expect(parseBoxRoute('#', boxes)).toBeNull()
  })
})

describe('buildBoxRoute 多盒+筛选往返', () => {
  it('组装规范 hash', () => {
    expect(buildBoxRoute(boxes, ['52.0', '50.0', '7.0'], { type: 'numeric', query: '阿米娅' }))
      .toBe(`#52+50+7&type=numeric&q=${encodeURIComponent('阿米娅')}`)
  })

  it('空选择 -> #none（保留原语义）', () => {
    expect(buildBoxRoute(boxes, [], { empty: true })).toBe('#none')
  })

  it('全为已删除盒 -> 空串（bug 修复，见 first-wave §3）', () => {
    expect(buildBoxRoute(boxes, ['99.0'], {})).toBe('')
  })

  it('parse + build 幂等往返', () => {
    const hash = buildBoxRoute(boxes, ['52.0', '50.0', '7.0'], { type: 'numeric', query: '阿米娅' })
    const parsed = parseBoxRoute(hash, boxes)!
    expect(buildBoxRoute(boxes, parsed.boxIds, { type: parsed.type, query: parsed.query })).toBe(hash)
  })

  it('单盒深链', () => {
    expect(buildBoxRoute(boxes, ['特别通行认证'], {}))
      .toBe(`#${encodeURIComponent('特别通行认证')}`)
  })
})

describe('A6 干员级深链', () => {
  it('解析 &op=<slot>', () => {
    const parsed = parseBoxRoute('#52&op=3', boxes)
    expect(parsed?.boxIds).toEqual(['52.0'])
    expect(parsed?.operatorSlot).toBe(3)
    expect(parsed?.operatorName).toBeNull()
  })

  it('解析 &c=<名字>', () => {
    const parsed = parseBoxRoute(`#52&c=${encodeURIComponent('阿米娅')}`, boxes)
    expect(parsed?.boxIds).toEqual(['52.0'])
    expect(parsed?.operatorSlot).toBeNull()
    expect(parsed?.operatorName).toBe('阿米娅')
  })

  it('组装 op/c 段', () => {
    expect(buildBoxRoute(boxes, ['52.0'], { operatorSlot: 3 })).toBe('#52&op=3')
    expect(buildBoxRoute(boxes, ['52.0'], { operatorName: '阿米娅' }))
      .toBe(`#52&c=${encodeURIComponent('阿米娅')}`)
  })
})
