import {inspectErrorReason, isMissingFilesystemEntry} from './filesystem-errors.js'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {lstatSync} from 'node:fs'

type RepositoryMarker = {status: 'found'; directory: string} | {status: 'ambiguous'; reason: string} | {status: 'none'}

/** The nearest `.git` entry at or above `start`. A symlinked `.git` is `ambiguous`, not followed. */
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
