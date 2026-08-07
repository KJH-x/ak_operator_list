import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function atomicWrite(file, contents) {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, contents)
  await rename(temporary, file)
}

export async function atomicWriteJson(file, value) {
  await atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`)
}
