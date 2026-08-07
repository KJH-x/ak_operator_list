import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const PUBLIC_DATA = path.join(ROOT, 'public', 'data')

export function workspacePath() {
  return process.env.PASS_DATA_WORKSPACE
    ? path.resolve(process.env.PASS_DATA_WORKSPACE)
    : path.resolve(ROOT, '..', '..', 'AnAgent', 'workspace', 'page')
}

export function akDataWorkspacePath() {
  return process.env.AK_DATA_WORKSPACE ? path.resolve(process.env.AK_DATA_WORKSPACE) : null
}

export function prtsCachePath() {
  return process.env.PRTS_METADATA_CACHE
    ? path.resolve(process.env.PRTS_METADATA_CACHE)
    : path.join(PUBLIC_DATA, 'prts-metadata.json')
}

export function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : fallback
}
