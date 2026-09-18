import {listEligibleConfigurationPaths} from './discovery.js'
import {AppDoctorContextError} from './types.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {basename, isAbsolutePath} from '@shopify/cli-kit/node/path'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import type {AppDoctorConfiguration} from './types.js'

/**
 * Local configuration metadata. This deliberately reads only `client_id` and
 * whether the TOML parses: the full app schema is never validated here and
 * nothing is fetched remotely.
 */

/** A nonblank string `client_id`; any other shape counts as unlinked. */
function readLocalClientId(document: unknown): string | undefined {
  if (typeof document !== 'object' || document === null || !('client_id' in document)) return undefined
  const value = document.client_id
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

async function inspectConfigurationFile(path: string): Promise<AppDoctorConfiguration> {
  const fileName = basename(path)
  let content: string
  try {
    content = await readFile(path)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return {path, fileName, state: 'unreadable'}
  }

  let document: unknown
  try {
    document = decodeToml(content)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return {path, fileName, state: 'malformed'}
  }

  const clientId = readLocalClientId(document)
  return clientId === undefined ? {path, fileName, state: 'parsed'} : {path, fileName, state: 'parsed', clientId}
}

/**
 * Inspect the direct configuration files of one app directory, sorted by file
 * name. Unreadable or malformed files are reported, not fatal, so they remain
 * selectable by name.
 */
export async function inspectAppDoctorConfigurations(appDirectory: string): Promise<AppDoctorConfiguration[]> {
  if (!isAbsolutePath(appDirectory)) {
    throw new AppDoctorContextError('INVALID_PATH', `The app directory must be absolute, got ${appDirectory}.`)
  }
  const paths = await listEligibleConfigurationPaths(appDirectory)
  return Promise.all(paths.map(inspectConfigurationFile))
}
