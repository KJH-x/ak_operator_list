import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'

import { atomicWrite } from './io.mjs'
import { loadEnv } from './env.mjs'
import { PUBLIC_DATA, ROOT, workspacePath } from './paths.mjs'

const exec = promisify(execFile)
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

async function run(command, args, options = {}) {
  const shim = process.platform === 'win32' && command.toLowerCase().endsWith('.cmd')
  const executable = shim ? (process.env.ComSpec || 'cmd.exe') : command
  const executableArgs = shim ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args
  const result = await exec(executable, executableArgs, { cwd: ROOT, env: process.env, maxBuffer: 20 * 1024 * 1024, ...options })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

async function backup(file) {
  try { return await readFile(file) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function restore(file, value) {
  if (value === null) await rm(file, { force: true })
  else await atomicWrite(file, value)
}

async function main() {
  await loadEnv()
  const workspace = workspacePath()
  const updater = path.join(workspace, 'update-pass-data.mjs')
  if (process.env.R2_BUCKET && process.env.R2_BUCKET !== 'ak-pass-assets' && process.env.R2_ALLOW_ANY_BUCKET !== '1') {
    throw new Error(
      `R2_BUCKET is '${process.env.R2_BUCKET}', expected 'ak-pass-assets'. Set R2_ALLOW_ANY_BUCKET=1 only if you intentionally target another bucket.`,
    )
  }
  const stage = await mkdtemp(path.join(ROOT, '.refresh-stage-'))
  const stagedManifest = path.join(stage, 'images.v2.json')
  const stagedV1 = path.join(stage, 'catalog.v1.json')
  const stagedCatalog = path.join(stage, 'catalog.v2.json')
  const publicManifest = path.join(PUBLIC_DATA, 'images.v2.json')
  const publicCatalog = path.join(PUBLIC_DATA, 'catalog.v2.json')
  const oldManifest = await backup(publicManifest)
  const oldCatalog = await backup(publicCatalog)
  let swapStarted = false
  try {
    await run(process.execPath, [updater], { cwd: workspace })
    await run(npm, ['run', 'metadata:cache'])
    if (process.env.PRTS_METADATA_FETCH === '1') {
      await run(process.execPath, [path.join(ROOT, 'scripts', 'fetch-prts-release-dates.mjs')])
    }
    await run(process.execPath, [path.join(ROOT, 'scripts', 'sync-assets.mjs'), '--output', stagedManifest])
    await run(process.execPath, [
      path.join(ROOT, 'scripts', 'build-catalog.mjs'),
      '--manifest', stagedManifest,
      '--output', stagedV1,
    ])
    await run(process.execPath, [
      path.join(ROOT, 'scripts', 'build-catalog-v2.mjs'),
      '--source', stagedV1,
      '--manifest', stagedManifest,
      '--output', stagedCatalog,
    ])
    await Promise.all([
      copyFile(stagedManifest, `${publicManifest}.next`),
      copyFile(stagedCatalog, `${publicCatalog}.next`),
    ])
    swapStarted = true
    await atomicWrite(publicManifest, await readFile(`${publicManifest}.next`))
    await atomicWrite(publicCatalog, await readFile(`${publicCatalog}.next`))
    // 盒路由单一事实源：从已原子落盘的 catalog.v2.json 派生（失败不污染 v2 快照回滚）
    await run(process.execPath, [
      path.join(ROOT, 'scripts', 'build-box-routes.mjs'),
      '--source', publicCatalog,
      '--output', path.join(PUBLIC_DATA, 'box-routes.json'),
    ])
    await run(npm, ['run', 'test:unit'])
    await run(npm, ['run', 'build'])
    console.log('Refresh completed. Review and commit changes manually.')
  } catch (error) {
    if (swapStarted) {
      await Promise.all([restore(publicManifest, oldManifest), restore(publicCatalog, oldCatalog)])
      console.error('Refresh failed; previous v2 snapshots restored.')
    }
    throw error
  } finally {
    await Promise.all([
      rm(stage, { recursive: true, force: true }),
      rm(`${publicManifest}.next`, { force: true }),
      rm(`${publicCatalog}.next`, { force: true }),
    ])
  }
}

main().catch((error) => {
  console.error(error.stdout || error.stack || error.message)
  if (error.stderr) console.error(error.stderr)
  process.exitCode = 1
})
