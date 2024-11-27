import commondir from 'commondir'
import {
  relative,
  dirname as patheDirname,
  join,
  normalize,
  resolve,
  basename as basenamePathe,
  extname as extnamePathe,
  isAbsolute,
} from 'pathe'
import {fileURLToPath} from 'url'
// eslint-disable-next-line node/prefer-global/url
import type {URL} from 'url'

/**
 * Joins a list of paths together.
 *
 * @param paths - Paths to join.
 * @returns Joined path.
 */
export function joinPath(...paths: string[]): string {
  return join(...paths)
}

/**
 * Normalizes a path.
 *
 * @param path - Path to normalize.
 * @returns Normalized path.
 */
export function normalizePath(path: string): string {
  return normalize(path)
}

/**
 * Resolves a list of paths together.
 *
 * @param paths - Paths to resolve.
 * @returns Resolved path.
 */
export function resolvePath(...paths: string[]): string {
  return resolve(...paths)
}

/**
 * Returns the relative path from one path to another.
 *
 * @param from - Path to resolve from.
 * @param to - Path to resolve to.
 * @returns Relative path.
 */
export function relativePath(from: string, to: string): string {
  return relative(from, to)
}

/**
 * Returns whether the path is absolute.
 *
 * @param path - Path to check.
 * @returns Whether the path is absolute.
 */
export function isAbsolutePath(path: string): boolean {
  return isAbsolute(path)
}

/**
 * Returns the directory name of a path.
 *
 * @param path - Path to get the directory name of.
 * @returns Directory name.
 */
export function dirname(path: string): string {
  return patheDirname(path)
}

/**
 * Returns the base name of a path.
 *
 * @param path - Path to get the base name of.
 * @param ext - Optional extension to remove from the result.
 * @returns Base name.
 */
export function basename(path: string, ext?: string): string {
  return basenamePathe(path, ext)
}

/**
 * Returns the extension of the path.
 *
 * @param path - Path to get the extension of.
 * @returns Extension.
 */
export function extname(path: string): string {
  return extnamePathe(path)
}

/**
 * Given an absolute filesystem path, it makes it relative to
 * the current working directory. This is useful when logging paths
 * to allow the users to click on the file and let the OS open it
 * in the editor of choice.
 *
 * @param path - Path to relativize.
 * @param dir - Current working directory.
 * @returns Relativized path.
 */
export function relativizePath(path: string, dir: string = cwd()): string {
  const result = commondir([path, dir])
  const relativePath = relative(dir, path)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const relativeComponents = relativePath.split('/').filter((component) => component === '..').length
  if (result === '/' || relativePath === '' || relativeComponents > 2) {
    return path
  } else {
    return relativePath
  }
}

/**
 * Given 2 paths, it returns whether the second path is a subpath of the first path.
 *
 * @param mainPath - The main path.
 * @param subpath - The subpath.
 * @returns Whether the subpath is a subpath of the main path.
 */
export function isSubpath(mainPath: string, subpath: string): boolean {
  const relativePath = relative(mainPath, subpath)
  return !relativePath.startsWith('..') && !isAbsolutePath(relativePath)
}

/**
 * Given a module's import.meta.url it returns the directory containing the module.
 *
 * @param moduleURL - The value of import.meta.url in the context of the caller module.
 * @returns The path to the directory containing the caller module.
 */
export function moduleDirectory(moduleURL: string | URL): string {
  return dirname(fileURLToPath(moduleURL))
}

/**
 * When running a script using `npm run`, something interesting happens. If the current
 * folder does not have a `package.json` or a `node_modules` folder, npm will traverse
 * the directory tree upwards until it finds one. Then it will run the script and set
 * `process.cwd()` to that folder, while the actual path is stored in the INIT_CWD
 * environment variable (see here: https://docs.npmjs.com/cli/v9/commands/npm-run-script#description).
 *
 * @returns The path to the current working directory.
 */
export function cwd(): string {
  // eslint-disable-next-line @shopify/cli/no-process-cwd
  return normalize(process.env.INIT_CWD ? process.env.INIT_CWD : process.cwd())
}

/**
 * Tries to get the value of the `--path` argument, if provided.
 *
 * @param argv - The arguments to search for the `--path` argument.
 * @returns The value of the `--path` argument, if provided.
 */
export function sniffForPath(argv = process.argv): string | undefined {
  const pathFlagIndex = argv.indexOf('--path')
  if (pathFlagIndex === -1) {
    const pathArg = argv.find((arg) => arg.startsWith('--path='))
    return pathArg?.split('=')[1]
  }
  const pathFlag = argv[pathFlagIndex + 1]
  if (!pathFlag || pathFlag.startsWith('-')) return
  return pathFlag
}

/**
 * Returns whether the `--json` or `-j` flags are present in the arguments.
 *
 * @param argv - The arguments to search for the `--json` and `-j` flags.
 * @returns Whether the `--json` or `-j` flag is present in the arguments.
 */
export function sniffForJson(argv = process.argv): boolean {
  return argv.includes('--json') || argv.includes('-j')
}
