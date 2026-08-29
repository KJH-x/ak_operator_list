import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_RAW_URLS = [
  'https://raw.githubusercontent.com/KJH-x/Ak-Data/main/data/wiki_list.csv',
  'https://raw.githubusercontent.com/NSLC/Ak-Data/main/data/wiki_list.csv',
]

function parseCsvLine(line) {
  const fields = []; let field = ''; let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) { fields.push(field); field = '' } else field += char
  }
  fields.push(field)
  return fields
}

// character_table rarity values are TIER_N where N is the star count (1..6)
// for playable operators; trap/token/synthetic records carry a default that is ignored.
export function starRarity(record) {
  if (!record || typeof record.operatorId !== 'string' || !/^char_/.test(record.operatorId)) return null
  const match = /^TIER_(\d+)$/.exec(String(record.rarity ?? ''))
  if (!match) return null
  const star = Number(match[1])
  return star >= 1 && star <= 6 ? star : null
}

export function parseWikiListCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0]).map((value) => value.trim().toLocaleLowerCase())
  const indexOf = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1
  const idIndex = indexOf('id', 'operatorid', 'charid', 'characterid', 'internalname', 'key')
  const cnIndex = indexOf('name', 'cn', 'cnname', 'zh', '中文名', 'chinese_name', 'appellation_cn')
  const latinIndex = indexOf('english', 'englishname', 'en', 'enname', 'latinname', 'appellation', 'name_en')
  const sortIndex = indexOf('sort', 'sortindex', '排序')
  return lines.slice(1).map((line, row) => {
    const fields = parseCsvLine(line)
    const pick = (index) => index >= 0 ? fields[index]?.trim() ?? '' : ''
    const name = pick(cnIndex) || pick(latinIndex)
    if (!name) return null
    return {
      operatorId: pick(idIndex) || `ak-data:${row + 1}`,
      name,
      latinName: pick(latinIndex).trim() || null,
      sortIndex: Number(pick(sortIndex)) || row,
      searchAliases: [],
      operatorReleaseDate: null,
      rarity: null,
    }
  }).filter(Boolean)
}

async function readIfFile(file) {
  try { await access(file); return await readFile(file, 'utf8') } catch { return null }
}

export async function loadAkData({ workspace, rawUrls = DEFAULT_RAW_URLS, fetchImpl = fetch, cacheFile } = {}) {
  const root = workspace ? path.resolve(workspace) : null
  const candidates = root ? [path.join(root, 'data', 'wiki_list.csv'), path.join(root, 'wiki_list.csv')] : []
  for (const file of candidates) {
    const text = await readIfFile(file)
    if (text !== null) return { records: parseWikiListCsv(text), source: file, fetched: false }
  }
  if (cacheFile) {
    const cached = await readIfFile(cacheFile)
    if (cached !== null) {
      try { return { records: JSON.parse(cached), source: cacheFile, fetched: false } } catch { /* continue */ }
    }
  }
  for (const url of rawUrls) {
    try {
      const response = await fetchImpl(url, { headers: { 'User-Agent': 'ak-pass-catalog-refresh/1.0' } })
      if (!response.ok) continue
      const records = parseWikiListCsv(await response.text())
      if (records.length) return { records, source: url, fetched: true }
    } catch { /* try the next configured fallback */ }
  }
  return { records: [], source: null, fetched: false }
}

export async function loadCharacterTables({ fetchImpl = fetch } = {}) {
  const urls = {
    zh: process.env.AK_ZH_TABLE_URL || 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json',
    en: process.env.AK_EN_TABLE_URL || 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData_YoStar/main/en_US/gamedata/excel/character_table.json',
  }
  const result = {}
  for (const [locale, url] of Object.entries(urls)) {
    try {
      const response = await fetchImpl(url, { headers: { 'User-Agent': 'ak-pass-catalog-refresh/1.0' } })
      if (response.ok) result[locale] = await response.json()
    } catch { /* optional enrichment */ }
  }
  return result
}

// B3：searchWord.json 社区别名（418 条，如 阿米娅->兔兔/罗德岛CEO、极境->鸡精/大帅哥）。
// 文件结构为数组，每项是 { characterN: { name, englishname, serachword: string[] } }。
export async function loadSearchWord({ workspace, fetchImpl = fetch } = {}) {
  const root = workspace ? path.resolve(workspace) : null
  const candidates = root
    ? [
      path.join(root, 'ArknightsAuthorization_Series', 'searchWord.json'),
      path.join(root, 'data', 'searchWord.json'),
      path.join(root, 'searchWord.json'),
    ]
    : []
  for (const file of candidates) {
    const text = await readIfFile(file)
    if (text !== null) return { entries: parseSearchWordJson(text), source: file }
  }
  return { entries: [], source: null }
}

export function parseSearchWordJson(text) {
  let raw
  try {
    raw = JSON.parse(String(text))
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = Object.values(item)[0]
    if (!record || typeof record !== 'object') continue
    const name = String(record.name ?? '').trim()
    const englishname = String(record.englishname ?? '').trim()
    const aliases = Array.isArray(record.serachword)
      ? record.serachword.map((value) => String(value).trim()).filter(Boolean)
      : []
    if (!name || !aliases.length) continue
    out.push({ name, englishname, aliases })
  }
  return out
}

export function mergeSearchWordAliases(records, entries) {
  if (!Array.isArray(records) || !Array.isArray(entries)) return records
  const aliasesByKey = new Map()
  for (const entry of entries) {
    const nameKey = entry.name.toLocaleLowerCase('zh-CN')
    const englishKey = entry.englishname.toLocaleLowerCase('zh-CN')
    const target = aliasesByKey.get(nameKey) ?? aliasesByKey.get(englishKey)
    if (target) {
      for (const alias of entry.aliases) if (!target.includes(alias)) target.push(alias)
    } else {
      aliasesByKey.set(nameKey, [...entry.aliases])
      if (englishKey && englishKey !== nameKey) aliasesByKey.set(englishKey, [...entry.aliases])
    }
  }
  return records.map((record) => {
    if (!record || typeof record !== 'object') return record
    const nameKey = String(record.name ?? '').toLocaleLowerCase('zh-CN')
    const latinKey = String(record.latinName ?? '').toLocaleLowerCase('zh-CN')
    const extra = [
      ...(aliasesByKey.get(nameKey) ?? []),
      ...(latinKey && latinKey !== nameKey ? (aliasesByKey.get(latinKey) ?? []) : []),
    ]
    if (!extra.length) return record
    const searchAliases = Array.isArray(record.searchAliases) ? record.searchAliases : []
    return { ...record, searchAliases: [...new Set([...searchAliases, ...extra])] }
  })
}

export function mergeOperatorSources({ csvRecords = [], tables = {} } = {}) {
  const merged = new Map()
  const zh = tables.zh ?? {}; const en = tables.en ?? {}
  for (const [id, record] of Object.entries(zh)) {
    if (!record || typeof record.name !== 'string') continue
    const english = en[id]
    const latinCandidates = [english?.appellation, english?.name, record.appellation]
      .map((item) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
    const aliases = [english?.name, english?.appellation, record.appellation]
      .map((item) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
    const value = {
      operatorId: id,
      name: record.name,
      latinName: latinCandidates[0] || null,
      searchAliases: aliases,
      operatorReleaseDate: null,
      rarity: starRarity({ ...record, operatorId: id }),
    }
    const existing = merged.get(value.name)
    if (existing) {
      existing.latinName ||= value.latinName
      existing.searchAliases = [...new Set([...(existing.searchAliases ?? []), ...value.searchAliases])]
    } else merged.set(value.name, value)
  }
  for (const record of csvRecords) {
    const existing = merged.get(record.name)
    if (existing) {
      existing.latinName ||= record.latinName
      if (record.latinName) existing.searchAliases = [...new Set([...existing.searchAliases, record.latinName])]
    } else {
      merged.set(record.name, {
        ...record,
        operatorId: record.operatorId.startsWith('ak-data:') ? record.operatorId : `ak-data:${record.operatorId}`,
      })
    }
  }
  return [...merged.values()]
}
