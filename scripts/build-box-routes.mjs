import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { atomicWriteJson } from './io.mjs'
import { PUBLIC_DATA, workspacePath } from './paths.mjs'

// 生成 data/box-routes.json：盒 token 跨站单一事实源（A2 / D2）。
// token 规则与 src/lib/boxRoutes.ts 的 boxToToken 严格对齐：
//   数字盒 /^\d+\.0$/ -> 去 ".0"；其余 -> encodeURIComponent(完整 id)。
// 直接读取已构建的 catalog.v2.json，保证与运行时数据同源同数。
function tokenFor(boxId) {
  const match = /^(\d+)\.0$/.exec(boxId)
  return match ? match[1] : encodeURIComponent(boxId)
}

// B5：schema_version 版本门控 —— 产物带 schema_version + source_version（上游 Version.json，缺失时为 null）。
async function loadSourceVersion(workspace) {
  const candidates = [
    path.join(workspace, 'ArknightsAuthorization_Series', 'Version.json'),
    path.join(workspace, 'Version.json'),
  ]
  for (const file of candidates) {
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'))
      const row = Array.isArray(parsed.data) ? parsed.data[0] : null
      if (row && typeof row.Version === 'string' && row.Version) return row.Version
    } catch {
      // try next candidate
    }
  }
  return null
}

export async function buildBoxRoutes({
  sourceFile = path.join(PUBLIC_DATA, 'catalog.v2.json'),
  outputFile = path.join(PUBLIC_DATA, 'box-routes.json'),
  baseUrl = process.env.AAK_BASE_URL || 'https://aak.nslc.top',
  workspace = workspacePath(),
} = {}) {
  const catalog = JSON.parse(await readFile(sourceFile, 'utf8'))
  if (!catalog || !Array.isArray(catalog.boxes)) throw new Error('invalid catalog.v2.json')
  const rows = catalog.boxes.map((box) => ({
    box_id: box.id,
    box_type: box.type,
    character_count: box.characterCount,
    token: tokenFor(box.id),
    route: `${baseUrl}/#${tokenFor(box.id)}`,
  }))
  rows.sort((a, b) => a.box_id.localeCompare(b.box_id, 'zh-Hans-CN'))
  const sourceVersion = await loadSourceVersion(workspace)
  const document = {
    schema_version: 1,
    generated_at: catalog.generatedAt ?? new Date().toISOString(),
    source_version: sourceVersion,
    rows,
  }
  await atomicWriteJson(outputFile, document)
  return document
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const sourceIndex = process.argv.indexOf('--source')
  const outputIndex = process.argv.indexOf('--output')
  buildBoxRoutes({
    ...(sourceIndex >= 0 ? { sourceFile: path.resolve(process.argv[sourceIndex + 1]) } : {}),
    ...(outputIndex >= 0 ? { outputFile: path.resolve(process.argv[outputIndex + 1]) } : {}),
  }).then((doc) => console.log(JSON.stringify({ rows: doc.rows.length, schema_version: doc.schema_version })))
    .catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
}
