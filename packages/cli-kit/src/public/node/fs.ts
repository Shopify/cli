import {joinPath, normalizePath} from './path.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'
import {getRandomName, RandomNameFamily} from '../common/string.js'
import {OverloadParameters} from '../../private/common/ts/overloaded-parameters.js'
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
import {sep, join} from 'pathe'
import {findUp as internalFindUp} from 'find-up'
import {
  mkdirSync as fsMkdirSync,
  readFileSync as fsReadFileSync,
  writeFileSync as fsWriteFileSync,
  appendFileSync as fsAppendFileSync,
  statSync as fsStatSync,
  createReadStream as fsCreateReadStream,
  createWriteStream as fsCreateWriteStream,
  constants as fsConstants,
  existsSync as fsFileExistsSync,
  unlinkSync as fsUnlinkSync,
  ReadStream,
  WriteStream,
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
  rename as fsRename,
} from 'fs/promises'
import {pathToFileURL as pathToFile} from 'url'
import type {Pattern, Options as GlobOptions} from 'fast-glob'

/**
 * Strip the first `strip` parts of the path.
 *
 * @param path - Path to strip.
 * @param strip - Number of parts to strip.
 * @returns The stripped path.
 */
export function stripUpPath(path: string, strip: number): string {
  const parts = path.split(sep)
  return join(...parts.slice(strip))
}

/**
 * Creates a temporary directory and ties its lifecycle to the lifecycle of the callback.
 *
 * @param callback - The callback that receives the temporary directory.
 */
export async function inTemporaryDirectory<T>(callback: (tmpDir: string) => T | Promise<T>): Promise<T> {
  return temporaryDirectoryTask(callback)
}

/**
 * It reads a file and returns its content as a string using the
 * utf-8 encoding.
 *
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
export async function readFile(path: string, options?: ReadOptions): Promise<string>
export async function readFile(path: string, options?: ReadOptions): Promise<Buffer>

/**
 * It reads a file and returns its content as a string.
 * Uses utf-8 encoding by default.
 *
 * @param path - Path to the file to read.
 * @param options - Options to read the file with (defaults to utf-8 encoding).
 * @returns A promise that resolves with the content of the file.
 */
export async function readFile(path: string, options: ReadOptions = {encoding: 'utf8'}): Promise<string | Buffer> {
  outputDebug(outputContent`Reading the content of file at ${outputToken.path(path)}...`)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return fsReadFile(path, options)
}

/**
 * Synchronously reads a file and returns its content as a buffer.
 *
 * @param path - Path to the file to read.
 * @returns The content of the file.
 */
export function readFileSync(path: string): Buffer {
  outputDebug(outputContent`Sync-reading the content of file at ${outputToken.path(path)}...`)
  return fsReadFileSync(path)
}

/**
 * Given a path, it determines the actual path. This is useful when working
 * with paths that represent symlinks.
 *
 * @param path - Path whose real path will be returned.
 */
export async function fileRealPath(path: string): Promise<string> {
  return fsRealPath(path)
}

/**
 * Copies a file.
 *
 * @param from - Path to the directory or file to be copied.
 * @param to - Destination path.
 */
export async function copyFile(from: string, to: string): Promise<void> {
  outputDebug(outputContent`Copying file from ${outputToken.path(from)} to ${outputToken.path(to)}...`)
  await fsCopy(from, to)
}

/**
 * Creates a file at the given path.
 *
 * @param path - Path to the file to be created.
 */
export async function touchFile(path: string): Promise<void> {
  outputDebug(outputContent`Creating an empty file at ${outputToken.path(path)}...`)
  await fsEnsureFile(path)
}

/**
 * Synchronously creates a file at the given path.
 *
 * @param path - Path to the file to be created.
 */
export function touchFileSync(path: string): void {
  outputDebug(outputContent`Creating an empty file at ${outputToken.path(path)}...`)
  fsEnsureFileSync(path)
}

/**
 * Appnds content to file at path.
 *
 * @param path - Path to the file to be appended.
 * @param content - Content to be appended.
 */
export async function appendFile(path: string, content: string): Promise<void> {
  outputDebug(outputContent`Appending the following content to ${outputToken.path(path)}:
    ${content
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')}
  `)
  await fsAppendFile(path, content)
}

/**
 * Synchronously appends content to file at path.
 *
 * @param path - Path to the file to be appended.
 * @param data - Content to be appended.
 */
export function appendFileSync(path: string, data: string): void {
  fsAppendFileSync(path, data)
}

export interface WriteOptions {
  encoding: BufferEncoding
}

/**
 * Writes content to file at path.
 *
 * @param path - Path to the file to be written.
 * @param data - Content to be written.
 * @param options - Options to write the file with (defaults to utf-8 encoding).
 */
export async function writeFile(
  path: string,
  data: string | Buffer,
  options: WriteOptions = {encoding: 'utf8'},
): Promise<void> {
  outputDebug(outputContent`Writing some content to file at ${outputToken.path(path)}...`)
  await fsWriteFile(path, data, options)
}

/**
 * Synchronously writes content to file at path.
 *
 * @param path - Path to the file to be written.
 * @param data - Content to be written.
 */
export function writeFileSync(path: string, data: string): void {
  outputDebug(outputContent`File-writing some content to file at ${outputToken.path(path)}...`)
  fsWriteFileSync(path, data)
}

/**
 * Creates a directory at the given path.
 *
 * @param path - Path to the directory to be created.
 */
export async function mkdir(path: string): Promise<void> {
  outputDebug(outputContent`Creating directory at ${outputToken.path(path)}...`)
  await fsMkdir(path, {recursive: true})
}

/**
 * Synchronously creates a directory at the given path.
 *
 * @param path - Path to the directory to be created.
 */
export function mkdirSync(path: string): void {
  outputDebug(outputContent`Sync-creating directory at ${outputToken.path(path)}...`)
  fsMkdirSync(path, {recursive: true})
}

/**
 * Removes a file at the given path.
 *
 * @param path - Path to the file to be removed.
 */
export async function removeFile(path: string): Promise<void> {
  outputDebug(outputContent`Removing file at ${outputToken.path(path)}...`)
  await fsRemove(path)
}

/**
 * Renames a file.
 * @param from - Path to the file to be renamed.
 * @param to - New path for the file.
 */
export async function renameFile(from: string, to: string): Promise<void> {
  outputDebug(outputContent`Renaming file from ${outputToken.path(from)} to ${outputToken.path(to)}...`)
  await fsRename(from, to)
}

/**
 * Synchronously removes a file at the given path.
 *
 * @param path - Path to the file to be removed.
 */
export function removeFileSync(path: string): void {
  outputDebug(outputContent`Sync-removing file at ${outputToken.path(path)}...`)
  fsRemoveSync(path)
}

interface RmDirOptions {
  force?: boolean
}
/**
 * Removes a directory at the given path.
 *
 * @param path - Path to the directory to be removed.
 * @param options - Options to remove the directory with.
 */
export async function rmdir(path: string, options: RmDirOptions = {}): Promise<void> {
  const {default: del} = await import('del')
  outputDebug(outputContent`Removing directory at ${outputToken.path(path)}...`)
  await del(path, {force: options.force})
}

/**
 * Create a temporary directory.
 *
 * @returns Path to the temporary directory.
 */
export async function mkTmpDir(): Promise<string> {
  outputDebug(outputContent`Creating a temporary directory...`)
  const directory = await fsMkdtemp('tmp-')
  return directory
}

/**
 * Check whether a path is a directory.
 *
 * @param path - Path to check.
 * @returns True if the path is a directory, false otherwise.
 */
export async function isDirectory(path: string): Promise<boolean> {
  outputDebug(outputContent`Checking if ${outputToken.path(path)} is a directory...`)
  return (await fsLstat(path)).isDirectory()
}

/**
 * Get the size of a file.
 *
 * @param path - Path to the file.
 * @returns The size of the file in bytes.
 */
export async function fileSize(path: string): Promise<number> {
  outputDebug(outputContent`Getting the size of file file at ${outputToken.path(path)}...`)
  return (await fsStat(path)).size
}

/**
 * Synchronously get the size of a file.
 *
 * @param path - Path to the file.
 * @returns The size of the file in bytes.
 */
export function fileSizeSync(path: string): number {
  outputDebug(outputContent`Sync-getting the size of file file at ${outputToken.path(path)}...`)
  return fsStatSync(path).size
}

/**
 * Unlink a file at the given path.
 * @param path - Path to the file.
 * @returns A promise that resolves when the file is unlinked.
 */
export function unlinkFileSync(path: string): void {
  return fsUnlinkSync(path)
}

/**
 * Create a read stream for a file with optional options.
 *
 * @param path - Path to the file.
 * @param options - Options for the read stream.
 * @returns A read stream for the file.
 */
export function createFileReadStream(
  path: string,
  options?: {encoding?: BufferEncoding; start?: number; end?: number},
): ReadStream {
  return fsCreateReadStream(path, options)
}

/**
 * Create a write stream for a file.
 *
 * @param path - Path to the file.
 * @returns A write stream for the file.
 */
export function createFileWriteStream(path: string): WriteStream {
  return fsCreateWriteStream(path)
}

/**
 * Returns the Date object for the last modification of a file.
 *
 * @param path - Path to the directory or file.
 * @returns A unix timestamp.
 */
export async function fileLastUpdated(path: string): Promise<Date> {
  outputDebug(outputContent`Getting last updated timestamp for file at ${outputToken.path(path)}...`)
  return (await fsStat(path)).ctime
}

/**
 * Returns the unix timestamp of the last modification of a file.
 *
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

interface MoveFileOptions {
  overwrite?: boolean
}

/**
 * Moves a file.
 *
 * @param src - File to be moved.
 * @param dest - Path to be moved to.
 * @param options - Moving options.
 */
export async function moveFile(src: string, dest: string, options: MoveFileOptions = {}): Promise<void> {
  await fsMove(src, dest, options)
}

/**
 * Changes the permissions of a directory or file.
 *
 * @param path - Path to the file or directory whose permissions will be modified.
 * @param mode - Permissions to set to the file or directory.
 */
export async function chmod(path: string, mode: number | string): Promise<void> {
  await fsChmod(path, mode)
}

/**
 * Checks if a file has executable permissions.
 *
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
 * Returns true if a file or directory exists.
 *
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

export function fileExistsSync(path: string): boolean {
  return fsFileExistsSync(path)
}

interface GenerateRandomDirectoryOptions {
  /** Suffix to include in the randomly generated directory name. */
  suffix: string

  /** Absolute path to the directory where the random directory will be created. */
  directory: string

  /** Type of word to use for random name. */
  family?: RandomNameFamily
}

/**
 * It generates a random directory directory name for a sub-directory.
 * It ensures that the returned directory name doesn't exist.
 *
 * @param options - Options to generate the random directory name.
 * @returns It returns the name of the directory.
 */
export async function generateRandomNameForSubdirectory(options: GenerateRandomDirectoryOptions): Promise<string> {
  const generated = `${getRandomName(options.family ?? 'business')}-${options.suffix}`
  const randomDirectoryPath = joinPath(options.directory, generated)
  const isAppDirectoryTaken = await fileExists(randomDirectoryPath)

  if (isAppDirectoryTaken) {
    return generateRandomNameForSubdirectory(options)
  } else {
    return generated
  }
}

/**
 * Traverse the file system and return pathnames that match the given pattern.
 *
 * @param pattern - A glob pattern or an array of glob patterns.
 * @param options - Options for the glob.
 * @returns A promise that resolves to an array of pathnames that match the given pattern.
 */
export async function glob(pattern: Pattern | Pattern[], options?: GlobOptions): Promise<string[]> {
  const {default: fastGlob} = await import('fast-glob')
  let overridenOptions = options
  if (options?.dot == null) {
    overridenOptions = {...options, dot: true}
  }
  return fastGlob(pattern, overridenOptions)
}

/**
 * Convert a path to a File URL.
 *
 * @param path - Path to convert.
 * @returns The File URL.
 */
export function pathToFileURL(path: string): URL {
  return pathToFile(path)
}
/**
 * Find a file by walking parent directories.
 *
 * @param matcher - A pattern or an array of patterns to match a file name.
 * @param options - Options for the search.
 * @returns The first path found that matches or `undefined` if none could be found.
 */
export async function findPathUp(
  matcher: OverloadParameters<typeof internalFindUp>[0],
  options: OverloadParameters<typeof internalFindUp>[1],
): ReturnType<typeof internalFindUp> {
  // findUp has odd typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const got = await internalFindUp(matcher as any, options)
  return got ? normalizePath(got) : undefined
}
