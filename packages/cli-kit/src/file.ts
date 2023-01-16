import {content as outputContent, token, debug} from './output.js'
import {
  copy as fsCopy,
  ensureFile as fsEnsureFile,
  ensureFileSync as fsEnsureFileSync,
  remove as fsRemove,
  removeSync as fsRemoveSync,
  move as fsMove,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
} from 'fs-extra/esm'

import {temporaryDirectoryTask} from 'tempy'
import {sep, join, extname} from 'pathe'
import {
  mkdirSync as fsMkdirSync,
  readFileSync as fsReadFileSync,
  writeFileSync as fsWriteFileSync,
  appendFileSync as fsAppendFileSync,
  statSync as fsStatSync,
  createReadStream as fsCreateReadStream,
  constants as fsConstants,
} from 'fs'
import {
  mkdir as fsMkdir,
  writeFile as fsWriteFile,
  readFile as fsReadFile,
  realpath as fsRealPath,
  appendFile as fsAppendFile,
  mkdtemp as fsMkdtemp,
  stat as fsStat,
  lstat as fsLstat,
  chmod as fsChmod,
  access as fsAccess,
} from 'fs/promises'
import type {Options} from 'prettier'

const DEFAULT_PRETTIER_CONFIG: Options = {
  arrowParens: 'always',
  singleQuote: true,
  bracketSpacing: false,
  trailingComma: 'all',
}

export function stripUp(path: string, strip: number) {
  const parts = path.split(sep)
  return join(...parts.slice(strip))
}

/**
 * Creates a temporary directory and ties its lifecycle to the lifecycle of the callback.
 * @param callback - The callback that receives the temporary directory.
 */
export async function inTemporaryDirectory<T>(callback: (tmpDir: string) => T | Promise<T>): Promise<T> {
  return temporaryDirectoryTask(callback)
}

/**
 * It reads a file and returns its content as a string using the
 * utf-8 encoding
 * @param path - Path to the file to read.
 * @returns A promise that resolves with the content of the file.
 */

export type ReadOptions =
  | undefined
  | {flag?: string | undefined}
  | {
      encoding: BufferEncoding | string
      flag?: string | undefined
    }
export async function read(path: string, options?: ReadOptions): Promise<string>
export async function read(path: string, options?: ReadOptions): Promise<Buffer>

export async function read(path: string, options: ReadOptions = {encoding: 'utf8'}): Promise<string | Buffer> {
  debug(outputContent`Reading the content of file at ${token.path(path)}...`)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return fsReadFile(path, options)
}

/**
 * Given a path, it determines the actual path. This is useful when working
 * with paths that represent symlinks.
 * @param path - Path whose real path will be returned.
 */
export async function realpath(path: string): Promise<string> {
  return fsRealPath(path)
}

export function readSync(path: string, options: object = {encoding: 'utf-8'}): string {
  debug(outputContent`Sync-reading the content of file at ${token.path(path)}...`)
  const content = fsReadFileSync(path, options)
  return content.toString()
}

/**
 * Copies a file
 * @param from - Path to the directory or file to be copied.
 * @param to - Destination path.
 */
export async function copyFile(from: string, to: string): Promise<void> {
  debug(outputContent`Copying file from ${token.path(from)} to ${token.path(to)}...`)
  await fsCopy(from, to)
}

export async function touchFile(path: string): Promise<void> {
  debug(outputContent`Creating an empty file at ${token.path(path)}...`)
  await fsEnsureFile(path)
}

export async function appendFile(path: string, content: string): Promise<void> {
  debug(outputContent`Appending the following content to ${token.path(path)}:
    ${content
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')}
  `)
  await fsAppendFile(path, content)
}

export function touchFileSync(path: string) {
  debug(outputContent`Creating an empty file at ${token.path(path)}...`)
  fsEnsureFileSync(path)
}

export async function writeFile(path: string, data: string): Promise<void> {
  debug(outputContent`Writing some content to file at ${token.path(path)}...`)
  await fsWriteFile(path, data, {encoding: 'utf8'})
}

export function writeFileSync(path: string, data: string): void {
  debug(outputContent`File-writing some content to file at ${token.path(path)}...`)
  fsWriteFileSync(path, data)
}

export function appendFileSync(path: string, data: string): void {
  fsAppendFileSync(path, data)
}

export async function mkdir(path: string): Promise<void> {
  debug(outputContent`Creating directory at ${token.path(path)}...`)
  await fsMkdir(path, {recursive: true})
}

export function mkdirSync(path: string): void {
  debug(outputContent`Sync-creating directory at ${token.path(path)}...`)
  fsMkdirSync(path, {recursive: true})
}

export async function removeFile(path: string): Promise<void> {
  debug(outputContent`Removing file at ${token.path(path)}...`)
  await fsRemove(path)
}

export function removeFileSync(path: string) {
  debug(outputContent`Sync-removing file at ${token.path(path)}...`)
  fsRemoveSync(path)
}

export async function rmdir(path: string, {force}: {force?: boolean} = {}): Promise<void> {
  const {default: del} = await import('del')
  debug(outputContent`Removing directory at ${token.path(path)}...`)
  await del(path, {force})
}

export async function mkTmpDir(): Promise<string> {
  debug(outputContent`Creating a temporary directory...`)
  const directory = await fsMkdtemp('tmp-')
  return directory
}

export async function isDirectory(path: string): Promise<boolean> {
  debug(outputContent`Checking if ${token.path(path)} is a directory...`)
  return (await fsLstat(path)).isDirectory()
}

export async function fileSize(path: string): Promise<number> {
  debug(outputContent`Getting the size of file file at ${token.path(path)}...`)
  return (await fsStat(path)).size
}

export function fileSizeSync(path: string): number {
  debug(outputContent`Sync-getting the size of file file at ${token.path(path)}...`)
  return fsStatSync(path).size
}

export function createFileReadStream(path: string) {
  return fsCreateReadStream(path)
}

/**
 * Returns the Date object for the last modification of a file.
 * @param path - Path to the directory or file.
 * @returns A unix timestamp.
 */
export async function fileLastUpdated(path: string): Promise<Date> {
  debug(outputContent`Getting last updated timestamp for file at ${token.path(path)}...`)
  return (await fsStat(path)).ctime
}

/**
 * Returns the unix timestamp of the last modification of a file.
 * @param path - Path to the directory or file.
 * @returns A unix timestamp.
 */
export async function fileLastUpdatedTimestamp(path: string): Promise<number | undefined> {
  try {
    const lastUpdatedDateTime = await fileLastUpdated(path)
    return lastUpdatedDateTime.getTime()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

/**
 * Moves a file.
 * @param src - File to be moved.
 * @param dest - Path to be moved to.
 * @param options - Moving options.
 */
export async function moveFile(src: string, dest: string, options: {overwrite?: boolean} = {}): Promise<void> {
  await fsMove(src, dest, options)
}

/**
 * Changes the permissions of a directory or file.
 * @param path - Path to the file or directory whose permissions will be modified.
 * @param mode - Permissions to set to the file or directory.
 */
export async function chmod(path: string, mode: number | string): Promise<void> {
  await fsChmod(path, mode)
}

/**
 * Checks if a file has executable permissions.
 * @param path - Path to the file whose permissions will be checked.
 */
export async function fileHasExecutablePermissions(path: string): Promise<boolean> {
  try {
    await fsAccess(path, fsConstants.X_OK)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Returns true if a file or directory exists
 * @param path - Path to the directory or file.
 * @returns True if it exists.
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await fsAccess(path)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Format a string using prettier. Return the formatted content.
 */
export async function fileContentPrettyFormat(content: string, options: {path: string}) {
  const {default: prettier} = await import('prettier')

  const ext = extname(options.path)
  const prettierConfig: Options = {
    ...DEFAULT_PRETTIER_CONFIG,
    parser: 'babel',
  }

  switch (ext) {
    case '.html':
    case '.css':
      prettierConfig.parser = ext.slice(1)
      break
  }

  const formattedContent = await prettier.format(content, prettierConfig)

  return formattedContent
}
