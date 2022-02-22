import {resolve, relative, dirname} from 'path'

import {
  appendFile,
  readFile,
  mkdirp,
  copy as copyExtra,
  CopyOptions,
  remove,
  writeFile,
  ensureDir,
} from 'fs-extra'
import glob, {Options as GlobOptions} from 'fast-glob'

export interface FS {
  read(file: string): Promise<string>
  write(file: string, contents: string): Promise<void>
  append(file: string, contents: string): Promise<void>
  remove(file: string): Promise<void>
  copy(from: string, to: string, options?: CopyOptions): Promise<void>
  hasFile(file: string): Promise<boolean>
  hasDirectory(dir: string): Promise<boolean>
  makeDirectory(file: string): Promise<void>
  glob(pattern: string, options: Omit<GlobOptions, 'cwd'>): Promise<string[]>
  resolvePath(...paths: string[]): string
  relativePath(path: string, explicitRoot?: string): string
}

export class FileSystem implements FS {
  constructor(public root: string = process.cwd()) {}

  async read(file: string) {
    return readFile(this.resolvePath(file), 'utf8')
  }

  async write(file: string, contents: string) {
    const resolved = this.resolvePath(file)
    await mkdirp(dirname(resolved))
    await writeFile(resolved, contents)
  }

  async append(file: string, contents: string) {
    const resolved = this.resolvePath(file)
    await mkdirp(dirname(resolved))
    await appendFile(resolved, contents)
  }

  async remove(file: string) {
    const resolved = this.resolvePath(file)
    await remove(resolved)
  }

  async copy(from: string, to: string, options?: CopyOptions) {
    const resolvedFrom = this.resolvePath(from)
    const resolvedTo = this.resolvePath(to)

    await copyExtra(resolvedFrom, resolvedTo, options)
  }

  async hasFile(file: string) {
    const matches = await this.glob(file, {onlyFiles: true})
    return matches.length > 0
  }

  async hasDirectory(dir: string) {
    const matches = await this.glob(dir.endsWith('/') ? dir : `${dir}/`)
    return matches.length > 0
  }

  async makeDirectory(file: string) {
    const resolved = this.resolvePath(file)
    await ensureDir(resolved)
  }

  async glob(pattern: string, options: Omit<GlobOptions, 'cwd'> = {}) {
    return glob.sync(pattern, {...options, cwd: this.root, absolute: true})
  }

  resolvePath(...paths: string[]) {
    return resolve(this.root, ...paths)
  }

  relativePath(path: string, explicitRoot?: string) {
    if (explicitRoot) {
      return relative(explicitRoot, path)
    }
    return relative(this.root, path)
  }
}
