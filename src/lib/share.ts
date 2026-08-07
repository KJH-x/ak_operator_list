import { compressSync, decompressSync, strFromU8, strToU8 } from 'fflate'

import type { Pocket, SharedPocketPayload } from '@/types'

const PREFIX = '#p='
const MAX_HASH_BYTES = 64 * 1024
const MAX_ITEMS = 20_000

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > MAX_HASH_BYTES * 2) {
    throw new Error('分享链接格式无效')
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytes.length > MAX_HASH_BYTES) throw new Error('分享链接过大')
  return bytes
}

function cleanItems(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) throw new Error('分享项目无效')
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length <= 512))]
}

export function encodeSharePayload(payload: SharedPocketPayload): string {
  if (payload.version !== 1) throw new Error('不支持的分享版本')
  const normalized = {
    version: 1,
    pocketName: String(payload.pocketName || '收藏夹').trim().slice(0, 24) || '收藏夹',
    items: cleanItems(payload.items),
    sourceHash: String(payload.sourceHash || '').slice(0, 128),
  }
  return toBase64Url(compressSync(strToU8(JSON.stringify(normalized)), { level: 9 }))
}

export function decodeSharePayload(encoded: string): SharedPocketPayload {
  try {
    const parsed: unknown = JSON.parse(strFromU8(decompressSync(fromBase64Url(encoded))))
    if (!parsed || typeof parsed !== 'object') throw new Error('分享内容无效')
    const value = parsed as Partial<SharedPocketPayload>
    if (value.version !== 1 || typeof value.pocketName !== 'string' || typeof value.sourceHash !== 'string') {
      throw new Error('不支持的分享版本')
    }
    return {
      version: 1,
      pocketName: value.pocketName.trim().slice(0, 24) || '收藏夹',
      items: cleanItems(value.items),
      sourceHash: value.sourceHash.slice(0, 128),
    }
  } catch (error) {
    if (error instanceof Error && (error.message === '不支持的分享版本' || error.message === '分享项目无效')) throw error
    throw new Error('分享链接格式无效')
  }
}

export function createShareHash(pocket: Pick<Pocket, 'name' | 'items'>, sourceHash: string): string {
  return `${PREFIX}${encodeSharePayload({ version: 1, pocketName: pocket.name, items: pocket.items, sourceHash })}`
}

export function readShareHash(hash: string): SharedPocketPayload | null {
  if (!hash) return null
  if (!hash.startsWith(PREFIX)) throw new Error('分享链接格式无效')
  return decodeSharePayload(hash.slice(PREFIX.length))
}

export function createShareUrl(location: Pick<Location, 'href'>, pocket: Pick<Pocket, 'name' | 'items'>, sourceHash: string): string {
  const url = new URL(location.href)
  url.hash = createShareHash(pocket, sourceHash)
  return url.toString()
}

