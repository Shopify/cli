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
  return process.env.INIT_CWD ?? process.cwd()
}
