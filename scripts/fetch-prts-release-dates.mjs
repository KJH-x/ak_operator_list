import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PUBLIC_DATA } from './paths.mjs'
import { parseReleaseDate } from './prts-metadata.mjs'

const AGENT_URL = process.env.BROWSER_AGENT_URL || 'http://127.0.0.1:8932'
const PAGE_URL = 'https://prts.wiki/w/干员上线时间一览'

async function agent(action, payload = {}) {
  const response = await fetch(AGENT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  if (!response.ok) throw new Error(`browser agent ${action}: HTTP ${response.status}`)
  return response.json()
}

const ROW_CODE = `(() => {
  const tables = [...document.querySelectorAll('table')];
  const rows = tables.flatMap((table) => [...table.querySelectorAll('tr')]);
  return rows.map((row) => [...row.querySelectorAll('th,td')].map((cell) => cell.innerText.trim()));
})()`

export async function fetchPrtsReleaseDates({ agentUrl = AGENT_URL, outputFile = path.join(PUBLIC_DATA, 'prts-metadata.json') } = {}) {
  await agent('goto', { url: PAGE_URL })
  const rows = await agent('eval', { code: ROW_CODE })
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('PRTS table not found')
  const records = {}
  let parsed = 0
  let skipped = 0
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row) || row.length < 3) continue
    const name = String(row[0] ?? '').trim()
    const rawDate = String(row[2] ?? '').trim()
    if (!name || !rawDate) continue
    const operatorReleaseDate = parseReleaseDate(rawDate)
    if (!operatorReleaseDate) {
      skipped += 1
      continue
    }
    records[name] = {
      operatorReleaseDate,
      route: String(row[3] ?? '').trim(),
      obtainMethod: String(row[4] ?? '').trim(),
    }
    parsed += 1
  }
  if (parsed < 300) throw new Error(`PRTS date parse too small: ${parsed}`)
  const snapshot = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    source: PAGE_URL,
    records,
    counts: { parsed, skipped },
  }
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  return snapshot
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchPrtsReleaseDates().then((snapshot) => console.log(JSON.stringify(snapshot.counts))).catch((error) => {
    console.error(error.stack || error.message)
    process.exitCode = 1
  })
}

