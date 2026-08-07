import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

import { loadEnv } from './env.mjs'

await loadEnv()

const project = process.env.PAGES_PROJECT_NAME || 'ak-operator-list'
const dist = path.resolve('dist')
const command = process.platform === 'win32'
  ? `npx --yes wrangler@4.120.0 pages deploy ${dist} --project-name ${project}`
  : `npx --yes wrangler@4.120.0 pages deploy "${dist}" --project-name "${project}"`
const executable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'sh'
const args = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command]

try {
  const result = await promisify(execFile)(executable, args, {
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout)
  if (error.stderr) process.stderr.write(error.stderr)
  console.error(error.message)
  process.exitCode = 1
}
