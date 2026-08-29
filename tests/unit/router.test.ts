import { describe, expect, it } from 'vitest'

import { applyBoxSelection, defaultBoxSelection } from '@/lib/filters'
import type { BoxSelection } from '@/lib/filters'
import {
  boxToToken,
  buildRouteHash,
  parsePathRoute,
  parseRouteHash,
  parseUrl,
  tokenToBoxId,
} from '@/lib/router'
import type { CatalogBox } from '@/types'

const boxes = [
  { id: '1.0', type: 'numeric' },
  { id: '52.0', type: 'numeric' },
  { id: '7.0', type: 'numeric' },
  { id: '特别通行认证', type: 'special' },
  { id: '白名单凭证1.0', type: 'whitelist' },
] as CatalogBox[]

const numeric52 = { id: '52.0', type: 'numeric' } as CatalogBox
const specialBox = { id: '特别通行认证', type: 'special' } as CatalogBox
const whitelistBox = { id: '白名单凭证1.0', type: 'whitelist' } as CatalogBox

const hashRoute = (hash: string) => parseRouteHash(hash, boxes)
const pathRoute = (pathname: string) => parsePathRoute(pathname, boxes)
const urlParse = (hash: string, pathname = '/') => parseUrl(hash, pathname, boxes)
const boxHash = (selection: BoxSelection, type = 'all', query = '') =>
  buildRouteHash(selection, type, query, boxes)

describe('token to box id', () => {
  it('resolves numeric shorthand tokens', () => {
    expect(tokenToBoxId('52', boxes)).toBe('52.0')
    expect(tokenToBoxId('1', boxes)).toBe('1.0')
  })

  it('resolves full numeric ids', () => {
    expect(tokenToBoxId('52.0', boxes)).toBe('52.0')
  })

  it('resolves a decoded special id', () => {
    expect(tokenToBoxId(encodeURIComponent('特别通行认证'), boxes)).toBe('特别通行认证')
  })

  it('resolves a whitelist id ending in .0 via full id match', () => {
    expect(tokenToBoxId('白名单凭证1.0', boxes)).toBe('白名单凭证1.0')
    expect(tokenToBoxId(encodeURIComponent('白名单凭证1.0'), boxes)).toBe('白名单凭证1.0')
  })

  it('returns null for unresolvable tokens', () => {
    expect(tokenToBoxId('50', boxes)).toBeNull()
    expect(tokenToBoxId('garbage', boxes)).toBeNull()
  })
})

describe('box to token', () => {
  it('shrinks numeric box ids', () => {
    expect(boxToToken(numeric52)).toBe('52')
    expect(boxToToken({ id: '1.0', type: 'numeric' } as CatalogBox)).toBe('1')
  })

  it('encodes non-numeric box ids', () => {
    expect(boxToToken(specialBox)).toBe(encodeURIComponent('特别通行认证'))
    expect(boxToToken(whitelistBox)).toBe(encodeURIComponent('白名单凭证1.0'))
  })

  it('round-trips tokens through boxToToken and tokenToBoxId', () => {
    expect(tokenToBoxId(boxToToken(numeric52), boxes)).toBe('52.0')
    expect(tokenToBoxId(boxToToken(specialBox), boxes)).toBe('特别通行认证')
  })
})

describe('hash routes', () => {
  it('parses numeric shorthand and full ids', () => {
    expect(hashRoute('#52')).toEqual({
      boxIds: ['52.0'],
      type: 'all',
      query: '',
      hasRoute: true,
      empty: false,
    })
    expect(hashRoute('#52.0').boxIds).toEqual(['52.0'])
    expect(hashRoute('#1').boxIds).toEqual(['1.0'])
  })

  it('drops unresolvable tokens in a multi-box route', () => {
    expect(hashRoute('#52+50+7').boxIds).toEqual(['52.0', '7.0'])
  })

  it('resolves an encoded special id', () => {
    expect(hashRoute(`#${encodeURIComponent('特别通行认证')}`).boxIds).toEqual(['特别通行认证'])
  })

  it('parses the type param', () => {
    expect(hashRoute('#52&type=numeric').type).toBe('numeric')
    expect(hashRoute('#52&type=bogus').type).toBe('all')
  })

  it('parses an encoded query', () => {
    expect(hashRoute(`#52&q=${encodeURIComponent('阿米娅')}`).query).toBe('阿米娅')
  })

  it('marks none as an empty route', () => {
    expect(hashRoute('#none')).toEqual({
      boxIds: [],
      type: 'all',
      query: '',
      hasRoute: true,
      empty: true,
    })
  })

  it('keeps an unresolvable route non-empty', () => {
    expect(hashRoute('#garbage')).toEqual({
      boxIds: [],
      type: 'all',
      query: '',
      hasRoute: true,
      empty: false,
    })
  })

  it('resolves a whitelist id ending in .0, encoded or not', () => {
    expect(hashRoute('#白名单凭证1.0').boxIds).toEqual(['白名单凭证1.0'])
    expect(hashRoute(`#${encodeURIComponent('白名单凭证1.0')}`).boxIds).toEqual(['白名单凭证1.0'])
  })

  it('returns null for an empty hash', () => {
    expect(hashRoute('')).toBeNull()
    expect(hashRoute('#')).toBeNull()
  })
})

describe('path routes', () => {
  it('parses numeric path segments', () => {
    expect(pathRoute('/52').boxIds).toEqual(['52.0'])
    expect(pathRoute('/52.0').boxIds).toEqual(['52.0'])
    expect(pathRoute('/7').boxIds).toEqual(['7.0'])
  })

  it('parses an encoded special id path segment', () => {
    expect(pathRoute(`/${encodeURIComponent('特别通行认证')}`).boxIds).toEqual(['特别通行认证'])
  })

  it('ignores non-route paths', () => {
    expect(pathRoute('/')).toBeNull()
    expect(pathRoute('/index.html')).toBeNull()
    expect(pathRoute('/data/catalog.v2.json')).toBeNull()
  })

  it('trims a trailing slash', () => {
    expect(pathRoute('/52/').boxIds).toEqual(['52.0'])
  })
})

describe('url parsing', () => {
  it('extracts sharePayload and a route from the hash', () => {
    const result = urlParse('#p=abc&52')
    expect(result.sharePayload).toBe('abc')
    expect(result.route.boxIds).toEqual(['52.0'])
  })

  it('extracts sharePayload alone without a route', () => {
    expect(urlParse('#p=abc')).toEqual({ sharePayload: 'abc', route: null })
  })

  it('returns nothing for an empty hash', () => {
    expect(urlParse('')).toEqual({ sharePayload: null, route: null })
  })

  it('falls back to the path route when the hash has no route', () => {
    expect(urlParse('#p=abc', '/52').route.boxIds).toEqual(['52.0'])
  })
})

describe('building route hashes', () => {
  it('returns an empty string for the default selection', () => {
    expect(boxHash(defaultBoxSelection())).toBe('')
  })

  it('joins selected boxes in order with numeric shorthand', () => {
    expect(boxHash(applyBoxSelection(['52.0', '7.0']))).toBe('#52+7')
  })

  it('uses none for a custom selection without valid boxes', () => {
    expect(boxHash(applyBoxSelection([]))).toBe('#none')
  })

  it('appends the type param when not all', () => {
    expect(boxHash(applyBoxSelection(['52.0']), 'ambience')).toBe('#52&type=ambience')
  })

  it('appends an encoded query param', () => {
    expect(boxHash(applyBoxSelection(['52.0']), 'all', '阿米娅')).toBe(
      `#52&q=${encodeURIComponent('阿米娅')}`,
    )
  })

  it('encodes a special box id in the selection', () => {
    expect(boxHash(applyBoxSelection(['特别通行认证']))).toBe(
      `#${encodeURIComponent('特别通行认证')}`,
    )
  })

  it('orders boxes, then type, then query', () => {
    expect(boxHash(applyBoxSelection(['52.0', '7.0']), 'ambience', '阿米娅')).toBe(
      `#52+7&type=ambience&q=${encodeURIComponent('阿米娅')}`,
    )
  })
})
