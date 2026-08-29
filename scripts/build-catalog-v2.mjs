import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadAkData, loadCharacterTables, loadSearchWord, mergeOperatorSources, mergeSearchWordAliases } from './ak-data.mjs'
import { upgradeCatalogV2 } from './catalog-v2.mjs'
import { atomicWriteJson } from './io.mjs'
import { argument, PUBLIC_DATA, akDataWorkspacePath, prtsCachePath, workspacePath } from './paths.mjs'
import { readPrtsCache } from './prts-metadata.mjs'

export async function buildCatalogV2({
  workspace = workspacePath(),
  akWorkspace = akDataWorkspacePath(),
  sourceFile = path.join(PUBLIC_DATA, 'catalog.v1.json'),
  manifestFile = path.join(PUBLIC_DATA, 'images.v2.json'),
  outputFile = path.join(PUBLIC_DATA, 'catalog.v2.json'),
  prtsFile = prtsCachePath(),
  metadataFile = path.join(PUBLIC_DATA, 'operator-metadata.json'),
  fetchImpl = fetch,
  allowNetworkMetadata = false,
} = {}) {
  const source = JSON.parse(await readFile(sourceFile, 'utf8'))
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  let records = []
  try {
    records = JSON.parse(await readFile(metadataFile, 'utf8'))
  } catch {
    const ak = await loadAkData({ workspace: akWorkspace, fetchImpl, cacheFile: path.join(workspace, 'data', 'ak-data-cache.json') })
    const tables = allowNetworkMetadata ? await loadCharacterTables({ fetchImpl }) : {}
    records = mergeOperatorSources({ csvRecords: ak.records, tables })
  }
  const prtsCache = await readPrtsCache(prtsFile)
  const searchWord = await loadSearchWord({ workspace })
  records = mergeSearchWordAliases(records, searchWord.entries)
  const snapshot = upgradeCatalogV2(source, { records, manifest, prtsCache })
  await atomicWriteJson(outputFile, snapshot)
  return snapshot
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  buildCatalogV2({
    sourceFile: argument('--source', path.join(PUBLIC_DATA, 'catalog.v1.json')),
    manifestFile: argument('--manifest', path.join(PUBLIC_DATA, 'images.v2.json')),
    outputFile: argument('--output', path.join(PUBLIC_DATA, 'catalog.v2.json')),
    allowNetworkMetadata: process.argv.includes('--network-metadata'),
  }).then((snapshot) => console.log(JSON.stringify(snapshot.stats)))
    .catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
}
