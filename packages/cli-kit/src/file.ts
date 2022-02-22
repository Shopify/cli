import fs from 'fs-extra'
import del from 'del'

export async function read(path: string): Promise<string> {
  return fs.readFile(path, {encoding: 'utf-8'})
}

export async function write(path: string, data: string): Promise<void> {
  return fs.writeFile(path, data)
}

export async function mkdir(path: string): Promise<void> {
  return fs.mkdirp(path)
}

export async function rmdir(path: string): Promise<void> {
  await del(path)
}

export async function mkTmpDir(): Promise<string> {
  const directory = await fs.mkdtemp('tmp-')
  return directory
}

export async function isDirectory(path: string): Promise<boolean> {
  return (await fs.promises.lstat(path)).isDirectory()
}

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
