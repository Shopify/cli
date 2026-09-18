import {ioError, isMissingPathError} from './fs-errors.js'
import {compareStrings} from './ordering.js'
import {AppDoctorContextError} from './types.js'
import {isValidFormatAppConfigurationFileName} from '../../../models/app/config-file-naming.js'
import {fileRealPath} from '@shopify/cli-kit/node/fs'
import {basename, cwd, dirname, joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {lstat, readdir, stat} from 'node:fs/promises'
import type {AppDoctorApp, AppDoctorDiscovery} from './types.js'
import type {Dirent, Stats} from 'node:fs'

/**
 * Read-only app discovery. Paths returned from here are canonical: symlinks
 * resolved with `realpath`, then normalized.
 */

export interface DiscoverAppDoctorAppsInput {
  /** Start directory or explicit configuration file. Defaults to the current working directory. */
  readonly directory?: string
}

/** Child directory names never descended during the downward search. */
const isPrunedChildDirectory = (name: string) => name.startsWith('.') || name === 'node_modules'

const byName = (left: Dirent, right: Dirent) => compareStrings(left.name, right.name)

async function readSortedEntries(directory: string): Promise<Dirent[]> {
  try {
    const entries = await readdir(directory, {withFileTypes: true})
    return entries.sort(byName)
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new AppDoctorContextError('PATH_NOT_FOUND', `${directory} no longer exists.`)
    }
    throw ioError('read directory', directory, error)
  }
}

/**
 * Direct, regular files with a valid app configuration name, in entry order.
 * Symlinks and directories are never candidates, even when named like one.
 */
const eligibleConfigurationPaths = (directory: string, entries: ReadonlyArray<Dirent>) =>
  entries
    .filter((entry) => entry.isFile() && isValidFormatAppConfigurationFileName(entry.name))
    .map((entry) => joinPath(directory, entry.name))

/** Eligible configuration files directly inside `directory`, sorted by name. */
export async function listEligibleConfigurationPaths(directory: string): Promise<string[]> {
  return eligibleConfigurationPaths(directory, await readSortedEntries(directory))
}

async function canonicalize(path: string): Promise<string> {
  try {
    return normalizePath(await fileRealPath(path))
  } catch (error) {
    if (isMissingPathError(error)) throw new AppDoctorContextError('PATH_NOT_FOUND', `${path} does not exist.`)
    throw ioError('resolve', path, error)
  }
}

type StartPath = {readonly kind: 'directory'; readonly path: string} | {readonly kind: 'file'; readonly path: string}

async function statWithoutFollowing(path: string): Promise<Stats> {
  try {
    return await lstat(path)
  } catch (error) {
    if (isMissingPathError(error)) throw new AppDoctorContextError('PATH_NOT_FOUND', `${path} does not exist.`)
    throw ioError('inspect', path, error)
  }
}

async function statFollowing(path: string): Promise<Stats> {
  try {
    return await stat(path)
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new AppDoctorContextError('PATH_NOT_FOUND', `${path} points at a location that does not exist.`)
    }
    throw ioError('inspect', path, error)
  }
}

/**
 * Classify and canonicalize the supplied start path. Directories may be
 * reached through symlinks; configuration files may not.
 */
async function resolveStartPath(input: string | undefined): Promise<StartPath> {
  if (input === undefined) return {kind: 'directory', path: await canonicalize(cwd())}
  if (input.trim().length === 0) {
    throw new AppDoctorContextError('INVALID_PATH', 'The path must not be blank.')
  }

  const stats = await statWithoutFollowing(input)
  if (stats.isSymbolicLink()) {
    const target = await statFollowing(input)
    if (!target.isDirectory()) {
      throw new AppDoctorContextError(
        'UNSUPPORTED_PATH',
        `${input} is a symbolic link. Point at the real configuration file or its directory instead.`,
      )
    }
    return {kind: 'directory', path: await canonicalize(input)}
  }
  if (stats.isDirectory()) return {kind: 'directory', path: await canonicalize(input)}
  if (stats.isFile()) {
    if (!isValidFormatAppConfigurationFileName(basename(input))) {
      throw new AppDoctorContextError(
        'UNSUPPORTED_PATH',
        `${input} is not a Shopify app configuration file (shopify.app.toml or shopify.app.<name>.toml).`,
      )
    }
    return {kind: 'file', path: await canonicalize(input)}
  }
  throw new AppDoctorContextError('UNSUPPORTED_PATH', `${input} is neither a directory nor a regular file.`)
}

/** Nearest canonical ancestor (including the start) that holds configuration files. */
async function findContainingApp(start: string): Promise<AppDoctorApp | undefined> {
  let current = start
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const configurationPaths = await listEligibleConfigurationPaths(current)
    if (configurationPaths.length > 0) return {directory: current, configurationPaths}
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

const byDirectory = (left: AppDoctorApp, right: AppDoctorApp) => compareStrings(left.directory, right.directory)

/**
 * Depth-first walk over ordinary descendants. Hidden and `node_modules`
 * children are pruned; symlinked entries are never followed. Nested apps
 * beneath a discovered app are still reported.
 */
async function findDescendantApps(start: string): Promise<AppDoctorApp[]> {
  const found: AppDoctorApp[] = []
  const visit = async (directory: string): Promise<void> => {
    const entries = await readSortedEntries(directory)
    const configurationPaths = eligibleConfigurationPaths(directory, entries)
    if (configurationPaths.length > 0) found.push({directory, configurationPaths})
    for (const entry of entries) {
      if (entry.isDirectory() && !isPrunedChildDirectory(entry.name)) {
        // eslint-disable-next-line no-await-in-loop
        await visit(joinPath(directory, entry.name))
      }
    }
  }
  await visit(start)
  return found.sort(byDirectory)
}

/**
 * Locate candidate apps for a start path.
 *
 * An explicit configuration file selects its own directory. Otherwise the
 * nearest containing app wins, and only when none exists are all apps below the
 * start directory reported for the caller to choose from.
 */
export async function discoverAppDoctorApps(input: DiscoverAppDoctorAppsInput = {}): Promise<AppDoctorDiscovery> {
  const start = await resolveStartPath(input.directory)

  if (start.kind === 'file') {
    const directory = dirname(start.path)
    const configurationPaths = await listEligibleConfigurationPaths(directory)
    return {apps: [{directory, configurationPaths}], explicitConfigurationPath: start.path}
  }

  const containing = await findContainingApp(start.path)
  if (containing) return {apps: [containing]}

  const descendants = await findDescendantApps(start.path)
  if (descendants.length === 0) {
    throw new AppDoctorContextError(
      'APP_NOT_FOUND',
      `Couldn't find a Shopify app configuration file (shopify.app.toml) in ${start.path}, its parents, or its subdirectories.`,
    )
  }
  return {apps: descendants}
}
