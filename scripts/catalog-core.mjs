export const BASELINE = Object.freeze({
  boxes: 92,
  characterMemberships: 577,
  stateVariants: 1117,
})

const STATES = new Set(['ELITE1', 'ELITE2'])
const HASH_PATTERN = /^[a-f0-9]{64}$/

// v2 enrichment lives in a separate module so the v1 snapshot remains a rollback fixture.
export { upgradeCatalogV2, validateCatalogV2 } from './catalog-v2.mjs'

export function normalizePrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function normalizeVariantStates(character) {
  if (character.only_elite_1) return ['ELITE1']
  const values = Array.isArray(character.variant_states) ? character.variant_states : []
  const states = [...new Set(values.filter((state) => STATES.has(state)))]
  if (states.length < 2) return ['ELITE1']
  // The upstream source marks "only 精1" via nolyELITE1 (normalized to
  // only_elite_1). Otherwise the presence of an ELITE2 key in market_price
  // means the 精2 badge exists even when no market price is listed yet
  // (price 0/null); the price is only for quoting, not for existence.
  const marketPrice = character.market_price ?? {}
  return Object.prototype.hasOwnProperty.call(marketPrice, 'ELITE2') ? ['ELITE1', 'ELITE2'] : ['ELITE1']
}

export function validateImageManifest(manifest) {
  if (!manifest || ![1, 2].includes(manifest.version) || !Array.isArray(manifest.assets)) {
    throw new Error('invalid image manifest')
  }
  if (!Number.isInteger(manifest.sourceCount) || manifest.sourceCount !== manifest.assets.length) {
    throw new Error('image manifest source count mismatch')
  }

  const sources = new Set()
  const hashes = new Set()
  for (const asset of manifest.assets) {
    if (!asset || typeof asset !== 'object') throw new Error('invalid image manifest asset')
    if (typeof asset.sourceUrl !== 'string' || !asset.sourceUrl) {
      throw new Error('image asset is missing sourceUrl')
    }
    if (sources.has(asset.sourceUrl)) throw new Error(`duplicate image source: ${asset.sourceUrl}`)
    sources.add(asset.sourceUrl)
    if (typeof asset.hash !== 'string' || !HASH_PATTERN.test(asset.hash)) {
      throw new Error(`invalid image hash for ${asset.sourceUrl}`)
    }
    if (!Number.isInteger(asset.size) || asset.size <= 0) {
      throw new Error(`invalid image size for ${asset.sourceUrl}`)
    }
    if (typeof asset.contentType !== 'string' || !asset.contentType) {
      throw new Error(`invalid image content type for ${asset.sourceUrl}`)
    }
    if (asset.etag !== null && typeof asset.etag !== 'string') {
      throw new Error(`invalid image etag for ${asset.sourceUrl}`)
    }
    if (!asset.urls || typeof asset.urls !== 'object') {
      throw new Error(`image asset is missing URLs for ${asset.sourceUrl}`)
    }
    const kinds = manifest.version >= 2 ? ['original', 'tiny', 'compact', 'display'] : ['original', 'tiny', 'display']
    for (const kind of kinds) {
      if (typeof asset.urls[kind] !== 'string' || !asset.urls[kind]) {
        throw new Error(`image asset is missing ${kind} URL for ${asset.sourceUrl}`)
      }
    }
    hashes.add(asset.hash)
  }
  if (!Number.isInteger(manifest.contentCount) || manifest.contentCount !== hashes.size) {
    throw new Error('image manifest content count mismatch')
  }
  return manifest
}

function assetMap(manifest) {
  validateImageManifest(manifest)
  return new Map(manifest.assets.map((asset) => [asset.sourceUrl, asset]))
}

export function normalizeCatalog(
  rawBoxes,
  metadata,
  imageManifest,
  generatedAt = new Date().toISOString(),
  baseline = BASELINE,
) {
  const images = assetMap(imageManifest)
  const boxes = rawBoxes.map((box) => {
    const characters = box.characters.map((character) => {
      const states = normalizeVariantStates(character)
      if (!states.length) throw new Error(`${box.box_id}/${character.name} has no valid variant_states`)
      const sourceImageUrl = typeof character.image_url === 'string' && character.image_url
        ? character.image_url
        : null
      const asset = sourceImageUrl ? images.get(sourceImageUrl) : null
      if (sourceImageUrl && !asset) {
        throw new Error(`${box.box_id}/${character.name} is missing from the image manifest`)
      }
      return {
        slot: character.slot,
        name: character.name,
        sourceImageUrl,
        image: asset ? {
          hash: asset.hash,
          tinyUrl: asset.urls.tiny,
          displayUrl: asset.urls.display,
          originalUrl: asset.urls.original,
          sourceUrl: asset.sourceUrl,
        } : null,
        variants: states.map((state) => ({
          state,
          price: normalizePrice(
            state === 'ELITE1'
              ? character.market_price?.ELITE1 ?? character.market_price?.ELITE2
              : character.market_price?.[state],
          ),
        })),
      }
    })
    return {
      id: box.box_id,
      group: box.box_group,
      type: box.box_type,
      releaseDate: box.release_date?.iso ?? null,
      replicateDates: (box.replicate_dates ?? []).map((date) => date.iso).filter(Boolean),
      retailPrice: box.retail_price ?? null,
      characterCount: characters.length,
      variantCount: characters.reduce((sum, character) => sum + character.variants.length, 0),
      characters,
    }
  })

  const memberships = boxes.reduce((sum, box) => sum + box.characterCount, 0)
  const variants = boxes.reduce((sum, box) => sum + box.variantCount, 0)
  const sourceImages = boxes.flatMap((box) => box.characters.map((character) => character.sourceImageUrl)).filter(Boolean)
  const missingImages = boxes.reduce(
    (sum, box) => sum + box.characters.filter((character) => !character.sourceImageUrl).length,
    0,
  )
  const snapshot = {
    version: 1,
    sourceHash: metadata.source_sha256,
    generatedAt,
    stats: {
      boxes: boxes.length,
      numericBoxes: boxes.filter((box) => box.group === 'numeric').length,
      specialBoxes: boxes.filter((box) => box.group === 'special').length,
      characterMemberships: memberships,
      stateVariants: variants,
      uniqueSourceImages: new Set(sourceImages).size,
      missingImages,
    },
    sources: {
      catalog: metadata.source_url,
      repository: 'https://gitcode.com/huangjinzhou1/ArknightsAuthorization_Series',
      license: 'CC BY-NC 4.0（商品及游戏素材权利归各权利方）',
    },
    boxes,
  }
  validateSnapshot(snapshot, baseline)
  return snapshot
}

export function validateSnapshot(snapshot, baseline = BASELINE) {
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.boxes)) throw new Error('invalid catalog snapshot')
  if (typeof snapshot.sourceHash !== 'string' || !snapshot.sourceHash) {
    throw new Error('catalog snapshot is missing sourceHash')
  }
  const ids = new Set()
  let memberships = 0
  let variants = 0
  for (const box of snapshot.boxes) {
    if (!box.id || ids.has(box.id)) throw new Error(`invalid or duplicate box id: ${box.id}`)
    ids.add(box.id)
    if (!Array.isArray(box.characters) || !box.characters.length) throw new Error(`empty box: ${box.id}`)
    memberships += box.characters.length
    for (const character of box.characters) {
      if (!character.name || !Array.isArray(character.variants) || !character.variants.length) {
        throw new Error(`invalid character in ${box.id}`)
      }
      const states = new Set()
      for (const variant of character.variants) {
        if (!STATES.has(variant.state) || states.has(variant.state)) {
          throw new Error(`invalid variant state in ${box.id}/${character.name}`)
        }
        if (variant.price !== null && !(typeof variant.price === 'number' && variant.price > 0)) {
          throw new Error(`invalid price in ${box.id}/${character.name}/${variant.state}`)
        }
        states.add(variant.state)
        variants += 1
      }
    }
  }
  if (snapshot.boxes.length < baseline.boxes) throw new Error(`box count regressed: ${snapshot.boxes.length}`)
  if (memberships < baseline.characterMemberships) throw new Error(`membership count regressed: ${memberships}`)
  if (variants < baseline.stateVariants) throw new Error(`variant count regressed: ${variants}`)
  if (snapshot.stats.boxes !== snapshot.boxes.length) throw new Error('box stats mismatch')
  if (snapshot.stats.numericBoxes !== snapshot.boxes.filter((box) => box.group === 'numeric').length) {
    throw new Error('numeric box stats mismatch')
  }
  if (snapshot.stats.specialBoxes !== snapshot.boxes.filter((box) => box.group === 'special').length) {
    throw new Error('special box stats mismatch')
  }
  if (snapshot.stats.characterMemberships !== memberships) throw new Error('membership stats mismatch')
  if (snapshot.stats.stateVariants !== variants) throw new Error('variant stats mismatch')
  return snapshot
}
