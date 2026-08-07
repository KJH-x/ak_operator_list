import { readFile } from 'node:fs/promises'

export const SPECIAL_PRTS_OVERRIDES = Object.freeze({
  // Display suffixes in the source describe how a pass was sold; they are not page names.
  '特别通行认证/1': {
    operatorId: 'special:frostnova',
    latinName: 'FrostNova',
    prtsPageUrl: 'https://prts.wiki/w/%E9%9C%9C%E6%98%9F',
    imageUrl: 'https://media.prts.wiki/0/07/%E5%A4%B4%E5%83%8F_%E6%95%8C%E4%BA%BA_%E9%9C%9C%E6%98%9F.png',
  },
  '特别通行认证/2': {
    operatorId: 'special:talulah',
    latinName: 'Talulah',
    prtsPageUrl: 'https://prts.wiki/w/%E5%A1%94%E9%9C%B2%E6%8B%89',
    imageUrl: 'https://media.prts.wiki/1/10/%E5%A4%B4%E5%83%8F_%E6%95%8C%E4%BA%BA_%E5%A1%94%E9%9C%B2%E6%8B%89.png',
  },
  '特别通行认证/3': {
    operatorId: 'special:jeston',
    latinName: 'Jestton Williams',
    prtsPageUrl: null,
    imageUrl: 'https://media.prts.wiki/1/17/%E5%A4%B4%E5%83%8F_%E6%95%8C%E4%BA%BA_%E6%9D%B0%E6%96%AF%E9%A1%BF%C2%B7%E5%A8%81%E5%BB%89%E5%A7%86%E6%96%AF.png',
  },
  '特别通行认证/4': {
    operatorId: 'special:kriede',
    latinName: 'Kriede',
    prtsPageUrl: null,
    imageUrl: 'https://media.prts.wiki/c/cc/%E5%A4%B4%E5%83%8F_%E6%95%8C%E4%BA%BA_%E5%85%8B%E4%B8%BD%E6%96%AF%E8%85%BE.png',
  },
  '特别通行认证/5': {
    operatorId: 'special:patriot',
    latinName: 'Patriot',
    prtsPageUrl: 'https://prts.wiki/w/%E7%88%B1%E5%9B%BD%E8%80%85',
    imageUrl: 'https://media.prts.wiki/0/04/%E5%A4%B4%E5%83%8F_%E6%95%8C%E4%BA%BA_%E7%88%B1%E5%9B%BD%E8%80%85.png',
  },
  '特别通行认证/6': {
    operatorId: 'special:soldier',
    latinName: 'Soldier',
    prtsPageUrl: 'https://prts.wiki/w/%E5%A3%AB%E5%85%B5',
    imageUrl: 'https://media.prts.wiki/3/34/%E5%A4%B4%E5%83%8F_%E6%95%8C%E4%BA%BA_%E5%A3%AB%E5%85%B5.png',
  },
})

export function parseReleaseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10)
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const match = text.match(/(20\d{2})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?/) || text.match(/^(20\d{2})(\d{2})(\d{2})$/)
  if (!match) return null
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null
}

export function normalPrtsPageUrl(latinName) {
  if (typeof latinName !== 'string' || !latinName.trim()) return null
  const name = latinName.trim()
  if (/愚人节|单领|礼盒|设定集|通行认证/.test(name)) return null
  return `https://prts.wiki/w/${encodeURIComponent(name).replace(/%27/g, "'")}`
}

export function validatePrtsPageUrl(url) {
  if (url === null || url === undefined || url === '') return null
  if (typeof url !== 'string' || !/^https:\/\/prts\.wiki\/w\//.test(url)) throw new Error(`invalid PRTS URL: ${url}`)
  if (/愚人节|单领|礼盒|设定集|通行认证/i.test(decodeURIComponent(url))) throw new Error(`PRTS URL contains display suffix: ${url}`)
  return url
}

export async function readPrtsCache(file) {
  if (!file) return { records: {}, fetchedAt: null }
  try {
    const value = JSON.parse(await readFile(file, 'utf8'))
    return value && typeof value === 'object' && value.records && typeof value.records === 'object'
      ? value
      : { records: {}, fetchedAt: null }
  } catch (error) {
    if (error?.code === 'ENOENT') return { records: {}, fetchedAt: null }
    throw error
  }
}

export function resolvePrtsRecord({ boxId, slot, characterName, latinName, cache = { records: {} } }) {
  const override = SPECIAL_PRTS_OVERRIDES[`${boxId}/${slot}`]
  const cached = cache.records?.[characterName] ?? cache.records?.[latinName] ?? {}
  const page = validatePrtsPageUrl(override?.prtsPageUrl ?? cached.prtsPageUrl ?? normalPrtsPageUrl(latinName))
  return {
    operatorId: override?.operatorId ?? null,
    latinName: override?.latinName ?? null,
    operatorReleaseDate: parseReleaseDate(override?.operatorReleaseDate ?? cached.operatorReleaseDate),
    prtsPageUrl: page,
    imageUrl: override?.imageUrl ?? cached.imageUrl ?? null,
  }
}
