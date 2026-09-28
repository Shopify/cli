import {inspectErrorReason, isMissingFilesystemEntry} from './filesystem-errors.js'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {lstatSync} from 'node:fs'

/**
 * The nearest `.git` entry at or above a directory.
 *
 * - `found`: a `.git` directory or worktree file exists in `directory`, which
 *   is the start directory itself or one of its ancestors.
 * - `ambiguous`: the nearest `.git` entry is a symlink or special file, or
 *   could not be inspected. Following it would leave repository ownership
 *   unclear, so callers must not treat it as absent.
 * - `none`: no `.git` entry exists at any level.
 */
type RepositoryMarker = {status: 'found'; directory: string} | {status: 'ambiguous'; reason: string} | {status: 'none'}

/**
 * Walk from `start` up to the filesystem root and classify the first `.git`
 * entry met. Uses lstat so a symlinked `.git` is reported as ambiguous rather
 * than followed. The search is purely filesystem-based and locale-independent,
 * which lets callers tell "no repository here" apart from "git refused to read
 * this repository" without parsing git's localized messages.
 */
export function findRepositoryMarker(start: string): RepositoryMarker {
  let directory = start
  while (true) {
    try {
      const stats = lstatSync(joinPath(directory, '.git'))
      if (stats.isDirectory() || stats.isFile()) return {status: 'found', directory}
      return {status: 'ambiguous', reason: 'Could not determine repository ownership from .git'}
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      if (!isMissingFilesystemEntry(error)) return {status: 'ambiguous', reason: inspectErrorReason('.git', error)}
    }

    const parent = dirname(directory)
    if (parent === directory) return {status: 'none'}
    directory = parent
  }
}
