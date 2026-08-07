import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { atomicWriteJson } from './io.mjs'
import { loadEnv } from './env.mjs'
import { argument, PUBLIC_DATA, workspacePath } from './paths.mjs'

const DEFAULT_PUBLIC_BASE = 'https://aak-assets.nslc.top'
const IMMUTABLE = 'public, max-age=31536000, immutable'

export function uniqueImageSources(boxes) {
  return [...new Set(boxes.flatMap((box) => (
    box.characters.map((character) => character.image_url).filter((url) => typeof url === 'string' && url)
  )))]
}

export function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function objectKeys(hash, manifestVersion = 2) {
  const prefix = `sha256/${hash}`
  const keys = {
    original: `${prefix}/original`,
    tiny: `${prefix}/tiny.webp`,
    display: `${prefix}/display.webp`,
  }
  if (manifestVersion >= 2) keys.compact = `${prefix}/compact.webp`
  return keys
}

function publicUrls(hash, publicBaseUrl, manifestVersion = 1) {
  const base = publicBaseUrl.replace(/\/$/, '')
  const keys = objectKeys(hash, manifestVersion)
  return Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, `${base}/${key}`]))
}

async function defaultTransform(bytes) {
  const { default: sharp } = await import('sharp')
  const image = sharp(bytes, { failOn: 'error' }).rotate()
  const [tiny, compact, display] = await Promise.all([
    image.clone().resize(24, 24, { fit: 'cover', position: 'attention' }).webp({ quality: 34 }).toBuffer(),
    image.clone().resize(96, 96, { fit: 'cover', position: 'attention', withoutEnlargement: true }).webp({ quality: 60 }).toBuffer(),
    image.clone().resize(192, 192, { fit: 'cover', position: 'attention', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer(),
  ])
  return { tiny, compact, display }
}

async function downloadImage(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
      'User-Agent': 'ak-pass-catalog-refresh/1.0',
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length) throw new Error(`${url}: empty response`)
  return {
    bytes,
    etag: response.headers.get('etag'),
    contentType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
  }
}

export async function createR2Storage(env = process.env) {
  const required = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
  const missing = required.filter((name) => !env[name])
  if (missing.length) throw new Error(`missing R2 environment variables: ${missing.join(', ')}`)
  const { S3Client, HeadObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const accountId = env.R2_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) throw new Error('missing R2 account id (set R2_ACCOUNT_ID)')
  const endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`
  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })
  return {
    async head(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }))
        return true
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false
        throw error
      }
    },
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: IMMUTABLE,
      }))
    },
  }
}

async function uploadIfMissing(storage, key, bytes, contentType) {
  if (await storage.head(key)) return false
  await storage.put(key, bytes, contentType)
  return true
}

async function mapConcurrent(values, limit, task) {
  const results = new Array(values.length)
  let next = 0
  async function worker() {
    while (next < values.length) {
      const index = next
      next += 1
      results[index] = await task(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker))
  return results
}

export async function syncAssets({
  boxes,
  outputFile,
  manifestOnly = false,
  publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE,
  fetchImpl = fetch,
  transformImpl = defaultTransform,
  storage = null,
  concurrency = 8,
  manifestVersion = 1,
  now = () => new Date().toISOString(),
} = {}) {
  const sources = uniqueImageSources(boxes)
  const r2 = manifestOnly ? null : (storage ?? await createR2Storage())
  const convertedByHash = new Map()
  const uploadedByHash = new Map()

  const assets = await mapConcurrent(sources, concurrency, async (sourceUrl) => {
    const downloaded = await downloadImage(sourceUrl, fetchImpl)
    const hash = hashBytes(downloaded.bytes)
    if (!convertedByHash.has(hash)) {
      convertedByHash.set(hash, Promise.resolve().then(() => transformImpl(downloaded.bytes)))
    }
    const converted = await convertedByHash.get(hash)
    const keys = objectKeys(hash, manifestVersion)
    if (r2 && !uploadedByHash.has(hash)) {
      const uploads = [
        uploadIfMissing(r2, keys.original, downloaded.bytes, downloaded.contentType),
        uploadIfMissing(r2, keys.tiny, converted.tiny, 'image/webp'),
        uploadIfMissing(r2, keys.display, converted.display, 'image/webp'),
      ]
      if (manifestVersion >= 2) uploads.push(uploadIfMissing(r2, keys.compact, converted.compact ?? converted.display, 'image/webp'))
      uploadedByHash.set(hash, Promise.all(uploads))
    }
    if (r2) await uploadedByHash.get(hash)
    return {
      sourceUrl,
      etag: downloaded.etag,
      hash,
      contentType: downloaded.contentType,
      size: downloaded.bytes.length,
      urls: publicUrls(hash, publicBaseUrl, manifestVersion),
    }
  })

  const manifest = {
    version: manifestVersion,
    generatedAt: now(),
    publicBaseUrl,
    sourceCount: assets.length,
    contentCount: new Set(assets.map((asset) => asset.hash)).size,
    assets,
  }
  await atomicWriteJson(outputFile, manifest)
  return manifest
}

export async function runSync() {
  await loadEnv()
  const workspace = workspacePath()
  const manifestVersion = process.argv.includes('--v1') ? 1 : 2
  const outputFile = argument('--output', path.join(PUBLIC_DATA, `images.v${manifestVersion}.json`))
  const boxes = JSON.parse(await readFile(path.join(workspace, 'data', 'pass-boxes.json'), 'utf8'))
  const manifestOnly = process.argv.includes('--manifest-only')
  const manifest = await syncAssets({ boxes, outputFile, manifestOnly, manifestVersion })
  console.log(JSON.stringify({
    sources: manifest.sourceCount,
    contents: manifest.contentCount,
    uploaded: !manifestOnly,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runSync().catch((error) => {
    console.error(error.stack || error.message)
    process.exitCode = 1
  })
}
