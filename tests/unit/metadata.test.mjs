import { describe, expect, it } from 'vitest'

import { parseReleaseDate, normalPrtsPageUrl, resolvePrtsRecord, validatePrtsPageUrl } from '../../scripts/prts-metadata.mjs'
import { upgradeCatalogV2 } from '../../scripts/catalog-v2.mjs'
import { mergeOperatorSources, mergeSearchWordAliases, parseSearchWordJson, parseWikiListCsv } from '../../scripts/ak-data.mjs'

describe('maintenance metadata', () => {
  it('parses Chinese and ISO-like release dates and rejects invalid dates', () => {
    expect(parseReleaseDate('2024年2月29日')).toBe('2024-02-29')
    expect(parseReleaseDate('2024/02/30')).toBeNull()
    expect(parseReleaseDate('2024-7-3')).toBe('2024-07-03')
  })

  it('uses clean normal page URLs and validates display suffixes', () => {
    expect(normalPrtsPageUrl('Amiya')).toBe('https://prts.wiki/w/Amiya')
    expect(() => validatePrtsPageUrl('https://prts.wiki/w/Talulah愚人节单领')).toThrow()
    expect(decodeURIComponent(resolvePrtsRecord({ boxId: '特别通行认证', slot: 2, latinName: null }).prtsPageUrl)).toContain('塔露拉')
  })

  it('creates synthetic IDs for ambiguous names while retaining compact assets', () => {
    const raw = {
      version: 1,
      sourceHash: 'source',
      sources: { catalog: 'x', repository: 'y', license: 'z' },
      boxes: [{ id: 'b', group: 'numeric', type: 'numeric', releaseDate: null, replicateDates: [], retailPrice: null, characters: [{ slot: 1, name: '同名', sourceImageUrl: 'https://x/a', image: { hash: 'a'.repeat(64), tinyUrl: 'tiny', displayUrl: 'display', originalUrl: 'original', sourceUrl: 'https://x/a' }, variants: [{ state: 'ELITE1', price: null }] }] }],
    }
    const snapshot = upgradeCatalogV2(raw, {
      records: [{ name: '同名', operatorId: 'one', latinName: 'One' }, { name: '同名', operatorId: 'two', latinName: 'Two' }],
      manifest: { assets: [{ sourceUrl: 'https://x/a', hash: 'a'.repeat(64), urls: { tiny: 'tiny', compact: 'compact', display: 'display', original: 'original' } }] },
      baseline: { boxes: 1, characterMemberships: 1, stateVariants: 1 },
    })
    expect(snapshot.boxes[0].characters[0].operatorId).toBe('synthetic:b:1')
    expect(snapshot.boxes[0].characters[0].image.compactUrl).toBe('compact')
  })

  it('applies cached PRTS release dates and keeps special overrides explicit', () => {
    const raw = {
      version: 1,
      sourceHash: 'source',
      sources: { catalog: 'x', repository: 'y', license: 'z' },
      boxes: [
        { id: 'b', group: 'numeric', type: 'numeric', releaseDate: null, replicateDates: [], retailPrice: null, characters: [{ slot: 1, name: '阿米娅', sourceImageUrl: null, variants: [{ state: 'ELITE1', price: null }] }] },
        { id: '特别通行认证', group: 'special', type: 'special', releaseDate: null, replicateDates: [], retailPrice: null, characters: [{ slot: 2, name: '塔露拉(愚人节单领)', sourceImageUrl: null, variants: [{ state: 'ELITE1', price: null }] }] },
      ],
    }
    const snapshot = upgradeCatalogV2(raw, {
      records: [{ name: '阿米娅', operatorId: 'char_002_amiya', latinName: 'Amiya' }],
      prtsCache: { records: { 阿米娅: { operatorReleaseDate: '2019-04-30' } } },
      baseline: { boxes: 2, characterMemberships: 2, stateVariants: 2 },
    })
    expect(snapshot.boxes[0].characters[0].operatorReleaseDate).toBe('2019-04-30')
    expect(snapshot.boxes[1].characters[0].operatorReleaseDate).toBeNull()
    expect(decodeURIComponent(snapshot.boxes[1].characters[0].prtsPageUrl)).toContain('塔露拉')
    expect(decodeURIComponent(snapshot.boxes[1].characters[0].sourceImageUrl)).toContain('头像_敌人_塔露拉')
  })

  it('matches Ak-Data CSV names and keeps game-table operator IDs', () => {
    const csv = parseWikiListCsv('zh,en,id\n阿米娅,Amiya,R001\nW,W,B214\n')
    expect(csv.find((record) => record.name === '阿米娅')?.latinName).toBe('Amiya')
    const merged = mergeOperatorSources({
      csvRecords: csv,
      tables: {
        zh: { char_002_amiya: { name: '阿米娅', appellation: 'Amiya' } },
        en: { char_002_amiya: { appellation: 'Amiya' } },
      },
    })
    const ami = merged.find((record) => record.name === '阿米娅')
    expect(ami?.operatorId).toBe('char_002_amiya')
    expect(ami?.searchAliases).toContain('Amiya')
  })

  it('parses searchWord.json and merges community aliases by name and latin name (B3)', () => {
    const entries = parseSearchWordJson(JSON.stringify([
      { character1: { name: '阿米娅', englishname: 'Amiya', serachword: ['兔兔', '罗德岛CEO'] } },
      { character2: { name: '极境', englishname: 'Elysium', serachword: ['鸡精', '大帅哥'] } },
      { character3: { name: '不存在的干员', englishname: '', serachword: ['xxx'] } },
    ]))
    expect(entries).toHaveLength(3)
    expect(entries[0]?.aliases).toContain('兔兔')
    const merged = mergeSearchWordAliases(
      [
        { name: '阿米娅', latinName: 'Amiya', searchAliases: ['Amiya'] },
        { name: '极境', latinName: 'Elysium', searchAliases: [] },
      ],
      entries,
    )
    expect(merged[0]?.searchAliases).toEqual(['Amiya', '兔兔', '罗德岛CEO'])
    expect(merged[1]?.searchAliases).toEqual(['鸡精', '大帅哥'])
  })
})
