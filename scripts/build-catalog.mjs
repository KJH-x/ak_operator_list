import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCatalog } from './catalog-core.mjs'
import { atomicWriteJson } from './io.mjs'
import { argument, PUBLIC_DATA, workspacePath } from './paths.mjs'

export async function buildCatalog({
  workspace = workspacePath(),
  manifestFile = argument('--manifest', path.join(PUBLIC_DATA, 'images.v1.json')),
  outputFile = argument('--output', path.join(PUBLIC_DATA, 'catalog.v1.json')),
} = {}) {
  const [rawBoxes, metadata, manifest] = await Promise.all([
    readFile(path.join(workspace, 'data', 'pass-boxes.json'), 'utf8').then(JSON.parse),
    readFile(path.join(workspace, 'data', 'metadata.json'), 'utf8').then(JSON.parse),
    readFile(manifestFile, 'utf8').then(JSON.parse),
  ])
  const snapshot = normalizeCatalog(rawBoxes, metadata, manifest)
  await atomicWriteJson(outputFile, snapshot)
  return snapshot
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  buildCatalog()
    .then((snapshot) => console.log(JSON.stringify(snapshot.stats)))
    .catch((error) => {
      console.error(error.stack || error.message)
      process.exitCode = 1
    })
}
