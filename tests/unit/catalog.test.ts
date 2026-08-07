import { describe, expect, it } from 'vitest'

import { priceBand } from '@/lib/catalog'
import {
  normalizeCatalog,
  normalizePrice,
  normalizeVariantStates,
  validateImageManifest,
} from '../../scripts/catalog-core.mjs'

describe('catalog normalization', () => {
  it('gives the elite-1-only marker priority over an anomalous ELITE2 price and state', () => {
    const character = {
      only_elite_1: true,
      variant_states: ['ELITE1', 'ELITE2'],
      market_price: { ELITE1: 20, ELITE2: 90 },
    }
    expect(normalizeVariantStates(character)).toEqual(['ELITE1'])
  })

  it('collapses un-priced or single-priced copies to one ELITE1 variant', () => {
    expect(normalizeVariantStates({
      only_elite_1: false,
      variant_states: ['ELITE1', 'ELITE2'],
      market_price: { ELITE1: null, ELITE2: null },
    })).toEqual(['ELITE1'])
    expect(normalizeVariantStates({
      only_elite_1: false,
      variant_states: ['ELITE1', 'ELITE2'],
      market_price: { ELITE1: 20, ELITE2: null },
    })).toEqual(['ELITE1'])
    expect(normalizeVariantStates({
      only_elite_1: false,
      variant_states: ['ELITE1', 'ELITE2'],
      market_price: { ELITE1: 20, ELITE2: 30 },
    })).toEqual(['ELITE1', 'ELITE2'])
  })

  it('keeps a single ELITE2 price under the ELITE1 copy when the series is undifferentiated', () => {
    const snapshot = normalizeCatalog([
      {
        box_id: 'test',
        box_group: 'numeric',
        box_type: 'numeric',
        release_date: { iso: null },
        replicate_dates: [],
        retail_price: '25元/抽',
        characters: [{
          slot: 1,
          name: '单款角色',
          image_url: null,
          only_elite_1: false,
          variant_states: ['ELITE1', 'ELITE2'],
          market_price: { ELITE1: null, ELITE2: 100 },
        }],
      },
    ], {
      source_sha256: 'test-hash',
      source_url: 'https://example.test/data.json',
    }, { version: 2, sourceCount: 0, contentCount: 0, assets: [] }, '2026-01-01T00:00:00.000Z', {
      boxes: 1,
      characterMemberships: 1,
      stateVariants: 1,
    })
    expect(snapshot.boxes[0]!.characters[0]!.variants).toEqual([{ state: 'ELITE1', price: 100 }])
  })

  it('does not infer variants from market price keys', () => {
    const snapshot = normalizeCatalog([
      {
        box_id: 'test',
        box_group: 'special',
        box_type: 'special',
        release_date: { iso: null },
        replicate_dates: [],
        retail_price: '25元/抽',
        characters: [{
          slot: 1,
          name: '测试角色',
          image_url: null,
          only_elite_1: false,
          variant_states: ['ELITE1'],
          market_price: { ELITE1: 25, ELITE2: 88 },
        }],
      },
    ], {
      source_sha256: 'test-hash',
      source_url: 'https://example.test/data.json',
    }, { version: 1, sourceCount: 0, contentCount: 0, assets: [] }, '2026-01-01T00:00:00.000Z', {
      boxes: 1,
      characterMemberships: 1,
      stateVariants: 1,
    })
    expect(snapshot.boxes[0]!.characters[0]!.variants).toEqual([{ state: 'ELITE1', price: 25 }])
  })

  it('normalizes zero, null and missing prices to no quote', () => {
    expect(normalizePrice(0)).toBeNull()
    expect(normalizePrice(null)).toBeNull()
    expect(normalizePrice(undefined)).toBeNull()
    expect(normalizePrice(18)).toBe(18)
  })

  it('rejects a non-null source image that is absent from the manifest', () => {
    expect(() => normalizeCatalog([{
      box_id: 'test',
      box_group: 'special',
      box_type: 'special',
      release_date: { iso: null },
      replicate_dates: [],
      retail_price: '25元/抽',
      characters: [{
        slot: 1,
        name: '缺图角色',
        image_url: 'https://example.test/missing.png',
        only_elite_1: true,
        variant_states: ['ELITE1'],
        market_price: { ELITE1: 25 },
      }],
    }], {
      source_sha256: 'test-hash',
      source_url: 'https://example.test/data.json',
    }, { version: 1, sourceCount: 0, contentCount: 0, assets: [] }, '2026-01-01T00:00:00.000Z', {
      boxes: 1,
      characterMemberships: 1,
      stateVariants: 1,
    })).toThrow('missing from the image manifest')
  })

  it('rejects duplicate sources and inconsistent content counts', () => {
    const asset = {
      sourceUrl: 'https://example.test/image.png',
      etag: null,
      hash: 'a'.repeat(64),
      contentType: 'image/png',
      size: 1,
      urls: {
        original: 'https://assets.test/original',
        tiny: 'https://assets.test/tiny.webp',
        display: 'https://assets.test/display.webp',
      },
    }
    expect(() => validateImageManifest({
      version: 1,
      sourceCount: 2,
      contentCount: 1,
      assets: [asset, asset],
    })).toThrow('duplicate image source')
    expect(() => validateImageManifest({
      version: 1,
      sourceCount: 1,
      contentCount: 2,
      assets: [asset],
    })).toThrow('content count mismatch')
  })

  it('requires the compact variant in v2 manifests and allows null etags', () => {
    const asset = {
      sourceUrl: 'https://example.test/image.png',
      etag: null,
      hash: 'b'.repeat(64),
      contentType: 'image/png',
      size: 1,
      urls: {
        original: 'https://assets.test/original',
        tiny: 'https://assets.test/tiny.webp',
        compact: 'https://assets.test/compact.webp',
        display: 'https://assets.test/display.webp',
      },
    }
    expect(validateImageManifest({ version: 2, sourceCount: 1, contentCount: 1, assets: [asset] })).toBeTruthy()
    const missing = structuredClone(asset)
    delete missing.urls.compact
    expect(() => validateImageManifest({ version: 2, sourceCount: 1, contentCount: 1, assets: [missing] }))
      .toThrow('missing compact URL')
  })

  it('classifies the 25-yuan price boundary', () => {
    expect(priceBand(24)).toBe('low')
    expect(priceBand(25)).toBe('standard')
    expect(priceBand(26)).toBe('high')
    expect(priceBand(null)).toBe('missing')
  })
})
