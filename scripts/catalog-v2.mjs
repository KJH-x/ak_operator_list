import { resolvePrtsRecord, validatePrtsPageUrl } from './prts-metadata.mjs'
import { initialsFor, pinyinFor } from '../src/lib/pinyin.ts'

const HASH_PATTERN = /^[a-f0-9]{64}$/
const STATES = new Set(['ELITE1', 'ELITE2'])

function cleanSearch(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s\p{P}\p{S}]+/gu, '')
}

function cleanToken(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s\p{P}\p{S}]+/gu, '')
}

function searchTokens(character) {
  return [...new Set([
    character.name,
    character.latinName,
    ...(character.searchAliases ?? []),
    pinyinFor(character.name),
    initialsFor(character.name),
  ].map(cleanToken).filter(Boolean))]
}

function normalDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function normalizeMetadata(records) {
  const byName = new Map()
  for (const record of records ?? []) {
    if (!record || typeof record.name !== 'string' || !record.name) continue
    const value = {
      operatorId: typeof record.operatorId === 'string' && record.operatorId ? record.operatorId : null,
      name: record.name,
      latinName: typeof record.latinName === 'string' && record.latinName ? record.latinName : null,
      searchAliases: Array.isArray(record.searchAliases) ? record.searchAliases.filter((item) => typeof item === 'string') : [],
      operatorReleaseDate: normalDate(record.operatorReleaseDate),
    }
    if (!byName.has(value.name)) byName.set(value.name, value)
    else if (byName.get(value.name)?.operatorId !== value.operatorId) byName.set(value.name, { ...byName.get(value.name), ambiguous: true })
  }
  return byName
}

function assetFor(character, assets) {
  const source = typeof character.sourceImageUrl === 'string' ? character.sourceImageUrl : null
  const asset = source ? assets.get(source) : null
  if (!asset) return null
  const urls = asset.urls ?? {
    tiny: asset.tinyUrl,
    compact: asset.compactUrl ?? asset.displayUrl,
    display: asset.displayUrl,
    original: asset.originalUrl,
  }
  return {
    hash: asset.hash,
    tinyUrl: urls.tiny,
    compactUrl: urls.compact ?? null,
    displayUrl: urls.display,
    originalUrl: urls.original,
    sourceUrl: asset.sourceUrl,
  }
}

function metadataFor(box, character, metadata, prtsCache) {
  const override = resolvePrtsRecord({
    boxId: box.id,
    slot: character.slot,
    characterName: character.name,
    latinName: metadata?.latinName,
    cache: prtsCache,
  })
  const baseId = override.operatorId || (metadata?.ambiguous ? null : metadata?.operatorId)
  // A missing Ak-Data match is intentionally unique to this membership.
  const operatorId = baseId || `synthetic:${box.id}:${character.slot}`
  const latinName = override.latinName || (metadata?.ambiguous ? null : metadata?.latinName) || null
  const aliases = [...new Set([
    ...(metadata?.searchAliases ?? []),
    pinyinFor(character.name),
    initialsFor(character.name),
  ].filter(Boolean))]
  return {
    operatorId,
    latinName,
    searchAliases: aliases,
    operatorReleaseDate: override.operatorReleaseDate ?? metadata?.operatorReleaseDate ?? null,
    prtsPageUrl: validatePrtsPageUrl(override.prtsPageUrl),
    imageUrl: override.imageUrl ?? null,
  }
}

export function upgradeCatalogV2(rawSnapshot, { records = [], manifest = null, prtsCache = { records: {} }, generatedAt = new Date().toISOString(), baseline } = {}) {
  if (!rawSnapshot || !Array.isArray(rawSnapshot.boxes)) throw new Error('invalid source catalog')
  const metadata = normalizeMetadata(records)
  const assets = new Map()
  // The caller can pass a v1 snapshot whose character image objects already contain URLs.
  for (const box of rawSnapshot.boxes) for (const character of box.characters) {
    if (character.image?.sourceUrl) assets.set(character.image.sourceUrl, character.image)
  }
  for (const asset of manifest?.assets ?? []) if (asset?.sourceUrl) assets.set(asset.sourceUrl, asset)
  const boxes = rawSnapshot.boxes.map((sourceBox) => {
    const characters = sourceBox.characters.map((sourceCharacter) => {
      const meta = metadata.get(sourceCharacter.name)
      const enrichment = metadataFor(sourceBox, sourceCharacter, meta, prtsCache)
      const sourceImageUrl = enrichment.imageUrl
        ?? sourceCharacter.sourceImageUrl
        ?? sourceCharacter.image?.sourceUrl
        ?? null
      return {
        slot: sourceCharacter.slot,
        name: sourceCharacter.name,
        operatorId: enrichment.operatorId,
        latinName: enrichment.latinName,
        searchAliases: enrichment.searchAliases,
        operatorReleaseDate: enrichment.operatorReleaseDate,
        prtsPageUrl: enrichment.prtsPageUrl,
        sourceImageUrl,
        image: assetFor({ sourceImageUrl }, assets) ?? (sourceCharacter.image ? {
          ...sourceCharacter.image,
          compactUrl: sourceCharacter.image.compactUrl ?? sourceCharacter.image.displayUrl,
        } : null),
        variants: sourceCharacter.variants.filter((variant) => STATES.has(variant.state)).map((variant) => ({
          state: variant.state,
          price: typeof variant.price === 'number' && variant.price > 0 ? variant.price : null,
        })),
      }
    })
    return {
      id: sourceBox.id,
      group: sourceBox.group,
      type: sourceBox.type,
      releaseDate: normalDate(sourceBox.releaseDate),
      replicateDates: Array.isArray(sourceBox.replicateDates) ? sourceBox.replicateDates.filter(normalDate) : [],
      retailPrice: sourceBox.retailPrice ?? null,
      characterCount: characters.length,
      variantCount: characters.reduce((sum, character) => sum + character.variants.length, 0),
      characters,
    }
  })
  const searchIndex = boxes.flatMap((box) => box.characters.map((character) => ({
    operatorId: character.operatorId,
    boxId: box.id,
    slot: character.slot,
    name: character.name,
    tokens: searchTokens(character),
  })))
  const sourceImages = boxes.flatMap((box) => box.characters.map((character) => character.sourceImageUrl)).filter(Boolean)
  const snapshot = {
    version: 2,
    sourceHash: rawSnapshot.sourceHash,
    generatedAt,
    stats: {
      boxes: boxes.length,
      numericBoxes: boxes.filter((box) => box.group === 'numeric').length,
      specialBoxes: boxes.filter((box) => box.group === 'special').length,
      characterMemberships: boxes.reduce((sum, box) => sum + box.characterCount, 0),
      stateVariants: boxes.reduce((sum, box) => sum + box.variantCount, 0),
      uniqueSourceImages: new Set(sourceImages).size,
      missingImages: boxes.reduce((sum, box) => sum + box.characters.filter((character) => !character.sourceImageUrl).length, 0),
      operators: new Set(searchIndex.map((entry) => entry.operatorId)).size,
    },
    sources: {
      ...rawSnapshot.sources,
      akData: 'Ak-Data/data/wiki_list.csv (cached at refresh)',
      prts: 'PRTS metadata cache (maintenance refresh only)',
    },
    searchIndex,
    boxes,
  }
  validateCatalogV2(snapshot, baseline)
  return snapshot
}

export function validateCatalogV2(snapshot, baseline = { boxes: 92, characterMemberships: 577, stateVariants: 902 }) {
  if (snapshot?.version !== 2 || !Array.isArray(snapshot.boxes) || !Array.isArray(snapshot.searchIndex)) {
    throw new Error('invalid catalog v2 snapshot')
  }
  if (typeof snapshot.sourceHash !== 'string' || !snapshot.sourceHash) throw new Error('missing source hash')
  const ids = new Set(); let memberships = 0; let variants = 0
  for (const box of snapshot.boxes) {
    if (!box.id || ids.has(box.id)) throw new Error(`duplicate box id: ${box.id}`)
    ids.add(box.id); memberships += box.characters.length
    for (const character of box.characters) {
      if (!character.operatorId || !Array.isArray(character.searchAliases)) throw new Error(`invalid metadata: ${box.id}/${character.name}`)
      if (character.prtsPageUrl !== null) validatePrtsPageUrl(character.prtsPageUrl)
      if (character.operatorReleaseDate !== null && !normalDate(character.operatorReleaseDate)) throw new Error('invalid operator release date')
      for (const variant of character.variants) {
        if (!STATES.has(variant.state)) throw new Error('invalid variant state')
        variants += 1
      }
    }
  }
  if (snapshot.boxes.length < baseline.boxes || memberships < baseline.characterMemberships || variants < baseline.stateVariants) {
    throw new Error('catalog counts regressed')
  }
  if (snapshot.stats.characterMemberships !== memberships || snapshot.stats.stateVariants !== variants) throw new Error('catalog stats mismatch')
  if (snapshot.searchIndex.length !== memberships) throw new Error('search index mismatch')
  return snapshot
}
