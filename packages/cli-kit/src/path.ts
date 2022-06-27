// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import commondir from 'commondir'
import {relative, dirname, join, normalize, resolve} from 'pathe'
import {fileURLToPath} from 'url'

export {join, relative, dirname, normalize, resolve}

export {findUp} from 'find-up'
export {default as glob} from 'fast-glob'
export {pathToFileURL} from 'node:url'

/**
 * Given an absolute filesystem path, it makes it relative to
 * the current working directory. This is useful when logging paths
 * to allow the users to click on the file and let the OS open it
 * in the editor of choice.
 * @param path {string} Path to relativize
 * @returns {string} Relativized path.
 */
export function relativize(path: string): string {
  const result = commondir([path, process.cwd()])
  const relativePath = relative(process.cwd(), path)
  const relativeComponents = relativePath.split('/').filter((component) => component === '..').length
  if (result === '/' || relativeComponents > 2) {
    return path
  } else {
    return relativePath
  }
}

/**
 * Given a module's import.meta.url it returns the directory containing the module.
 * @param moduleURL {string} The value of import.meta.url in the context of the caller module.
 * @returns {string} The path to the directory containing the caller module.
 */
export function moduleDirectory(moduleURL: string): string {
  return dirname(fileURLToPath(moduleURL))
}
