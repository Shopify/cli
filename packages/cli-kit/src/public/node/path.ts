import commondir from 'commondir'
import {relative, dirname, join, normalize, resolve, basename, extname, isAbsolute} from 'pathe'
import {fileURLToPath} from 'url'
// eslint-disable-next-line node/prefer-global/url
import type {URL} from 'url'

// Reexport methods from pathe
export {
  join as joinPath,
  relative as relativePath,
  normalize as normalizePath,
  resolve as resolvePath,
  isAbsolute as isAbsolutePath,
  dirname,
  basename,
  extname,
}

/**
 * Given an absolute filesystem path, it makes it relative to
 * the current working directory. This is useful when logging paths
 * to allow the users to click on the file and let the OS open it
 * in the editor of choice.
 *
 * @param path - Path to relativize.
 * @param cwd - Current working directory.
 * @returns Relativized path.
 */
export function relativizePath(path: string, cwd: string = process.cwd()): string {
  const result = commondir([path, cwd])
  const relativePath = relative(cwd, path)
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
 * Given a module's import.meta.url it returns the directory containing the module.
 *
 * @param moduleURL - The value of import.meta.url in the context of the caller module.
 * @returns The path to the directory containing the caller module.
 */
export function moduleDirectory(moduleURL: string | URL): string {
  return dirname(fileURLToPath(moduleURL))
}
