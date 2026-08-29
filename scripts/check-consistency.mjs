import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PUBLIC_DATA, workspacePath } from './paths.mjs'

// B6：工作区数据与站点数据一致性校验。
// 以工作区 data/metadata.json 的 counts 为基线，校验站点 public/data/catalog.v2.json 的 stats
// 与 searchIndex 的 boxId 集合（对照 box-character-names.json）。计数回落时非零退出。

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return null
  }
}

export async function checkConsistency({
  workspace = workspacePath(),
  catalogFile = path.join(PUBLIC_DATA, 'catalog.v2.json'),
} = {}) {
  const failures = []
  const metadata = await readJson(path.join(workspace, 'data', 'metadata.json'))
  const names = await readJson(path.join(workspace, 'data', 'box-character-names.json'))
  const catalog = await readJson(catalogFile)

  if (!metadata) failures.push('workspace data/metadata.json missing or invalid')
  else {
    const counts = metadata.counts ?? {}
    if (catalog?.stats?.boxes !== counts.boxes) {
      failures.push(`box count mismatch: workspace=${counts.boxes} site=${catalog?.stats?.boxes}`)
    }
    if (catalog?.stats?.characterMemberships !== counts.character_memberships) {
      failures.push(
        `membership mismatch: workspace=${counts.character_memberships} site=${catalog?.stats?.characterMemberships}`,
      )
    }
    if (catalog?.stats?.stateVariants !== counts.state_variants) {
      failures.push(`variant mismatch: workspace=${counts.state_variants} site=${catalog?.stats?.stateVariants}`)
    }
  }

  const siteBoxIds = new Set((catalog?.searchIndex ?? []).map((entry) => entry.boxId))
  const nameBoxIds = new Set([
    ...Object.keys(names?.numeric ?? {}),
    ...Object.keys(names?.special ?? {}),
  ])
  if (siteBoxIds.size && nameBoxIds.size) {
    if (siteBoxIds.size !== nameBoxIds.size) {
      failures.push(`box set size mismatch: names=${nameBoxIds.size} site=${siteBoxIds.size}`)
    } else {
      for (const id of siteBoxIds) if (!nameBoxIds.has(id)) failures.push(`box in site not in names: ${id}`)
      for (const id of nameBoxIds) if (!siteBoxIds.has(id)) failures.push(`box in names not in site: ${id}`)
    }
  }

  return { ok: failures.length === 0, failures }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  checkConsistency().then((result) => {
    if (result.ok) {
      console.log('consistency check passed')
    } else {
      console.error(`consistency check failed:\n${result.failures.join('\n')}`)
      process.exitCode = 1
    }
  }).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
}
