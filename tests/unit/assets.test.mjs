import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { syncAssets, uniqueImageSources } from '../../scripts/sync-assets.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

function boxes(urls) {
  return [{ characters: urls.map((image_url) => ({ image_url })) }]
}

function imageResponse(bytes) {
  return new Response(bytes, {
    headers: { 'content-type': 'image/png', etag: 'fixture-etag' },
  })
}

describe('image asset synchronization', () => {
  it('deduplicates source URLs and identical content and skips existing R2 objects', async () => {
    expect(uniqueImageSources(boxes(['https://x/a', 'https://x/a', 'https://x/b']))).toEqual([
      'https://x/a',
      'https://x/b',
    ])
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ak-pass-assets-'))
    temporaryDirectories.push(directory)
    const transform = vi.fn(async () => ({ tiny: Buffer.from('tiny'), display: Buffer.from('display') }))
    const storage = {
      head: vi.fn(async () => true),
      put: vi.fn(async () => undefined),
    }
    const manifest = await syncAssets({
      boxes: boxes(['https://x/a', 'https://x/b']),
      outputFile: path.join(directory, 'images.json'),
      fetchImpl: vi.fn(async () => imageResponse(Buffer.from('same-image'))),
      transformImpl: transform,
      storage,
      concurrency: 2,
      now: () => '2026-01-01T00:00:00.000Z',
    })
    expect(manifest.sourceCount).toBe(2)
    expect(manifest.contentCount).toBe(1)
    expect(transform).toHaveBeenCalledTimes(1)
    expect(storage.head).toHaveBeenCalledTimes(3)
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('keeps the prior manifest when conversion fails', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ak-pass-assets-'))
    temporaryDirectories.push(directory)
    const outputFile = path.join(directory, 'images.json')
    await writeFile(outputFile, 'previous-manifest\n')
    await expect(syncAssets({
      boxes: boxes(['https://x/broken']),
      outputFile,
      manifestOnly: true,
      fetchImpl: async () => imageResponse(Buffer.from('invalid')),
      transformImpl: async () => { throw new Error('conversion failed') },
    })).rejects.toThrow('conversion failed')
    expect(await readFile(outputFile, 'utf8')).toBe('previous-manifest\n')
  })

  it('uploads and manifests a separate compact object in v2 mode', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ak-pass-assets-v2-'))
    temporaryDirectories.push(directory)
    const storage = { head: vi.fn(async () => false), put: vi.fn(async () => undefined) }
    const manifest = await syncAssets({
      boxes: boxes(['https://x/a']),
      outputFile: path.join(directory, 'images.v2.json'),
      fetchImpl: async () => imageResponse(Buffer.from('v2-image')),
      transformImpl: async () => ({ tiny: Buffer.from('tiny'), compact: Buffer.from('compact'), display: Buffer.from('display') }),
      storage,
      manifestVersion: 2,
      now: () => '2026-01-01T00:00:00.000Z',
    })
    expect(manifest.version).toBe(2)
    expect(manifest.assets[0].urls.compact).toMatch(/compact\.webp$/)
    expect(storage.head).toHaveBeenCalledTimes(4)
    expect(storage.put).toHaveBeenCalledTimes(4)
  })
})
