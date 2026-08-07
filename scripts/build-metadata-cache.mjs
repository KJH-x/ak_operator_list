import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadCharacterTables, mergeOperatorSources, parseWikiListCsv } from './ak-data.mjs'

export async function buildMetadataCache({ zhFile, enFile, wikiFile, outputFile } = {}) {
  let csvRecords = []
  if (wikiFile) csvRecords = parseWikiListCsv(await readFile(wikiFile, 'utf8'))
  let tables = {}
  if (zhFile) {
    tables = {
      zh: JSON.parse(await readFile(zhFile, 'utf8')),
      en: enFile ? JSON.parse(await readFile(enFile, 'utf8')) : {},
    }
  } else {
    const cachedZh = path.join(tmpdir(), 'ak-zh.json')
    const cachedEn = path.join(tmpdir(), 'ak-en.json')
    const cachedZhText = await readFile(cachedZh, 'utf8').catch(() => null)
    const cachedEnText = await readFile(cachedEn, 'utf8').catch(() => null)
    if (cachedZhText) {
      tables = {
        zh: JSON.parse(cachedZhText),
        en: cachedEnText ? JSON.parse(cachedEnText) : {},
      }
    } else {
      tables = await loadCharacterTables()
    }
  }
  const records = mergeOperatorSources({ csvRecords, tables })
  const previousText = await readFile(outputFile, 'utf8').catch(() => null)
  if (previousText) {
    const previous = JSON.parse(previousText)
    if (records.length < 500 && Array.isArray(previous) && previous.length > records.length) {
      throw new Error(`metadata regression: ${previous.length} -> ${records.length}; keeping previous cache`)
    }
  }
  await writeFile(outputFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
  return records
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  buildMetadataCache({
    zhFile: process.env.AK_ZH_CACHE || null,
    enFile: process.env.AK_EN_CACHE || null,
    wikiFile: process.argv.indexOf('--wiki') >= 0 ? process.argv[process.argv.indexOf('--wiki') + 1] : null,
    outputFile: process.env.AK_METADATA_OUTPUT || path.resolve('public/data/operator-metadata.json'),
  }).then((records) => console.log(JSON.stringify({ records: records.length })))
    .catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
}
