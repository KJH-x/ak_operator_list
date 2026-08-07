import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { atomicWriteJson } from './io.mjs'
import { PUBLIC_DATA } from './paths.mjs'

export async function migrateManifest({ source = path.join(PUBLIC_DATA, 'images.v1.json'), output = path.join(PUBLIC_DATA, 'images.v2.json') } = {}) {
  const old = JSON.parse(await readFile(source, 'utf8'))
  const assets = old.assets.map((asset) => ({
    ...asset,
    urls: {
      ...asset.urls,
      compact: asset.urls.compact ?? `${String(old.publicBaseUrl).replace(/\/$/, '')}/sha256/${asset.hash}/compact.webp`,
    },
  }))
  const next = { ...old, version: 2, assets, contentCount: new Set(assets.map((asset) => asset.hash)).size }
  await atomicWriteJson(output, next)
  return next
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrateManifest().then((manifest) => console.log(JSON.stringify({ sources: manifest.sourceCount, contents: manifest.contentCount })))
    .catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
}

