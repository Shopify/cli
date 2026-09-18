import {ioError, isMissingPathError} from './fs-errors.js'
import {computeConfigurationIdentity, findStorageAnchor, resolveStoreDirectory} from './storage.js'
import {AppDoctorContextError} from './types.js'
import {isValidFormatAppConfigurationFileName} from '../../../models/app/config-file-naming.js'
import {basename, dirname, isAbsolutePath} from '@shopify/cli-kit/node/path'
import {lstat} from 'node:fs/promises'
import type {AppDoctorConfigurationSelection, AppDoctorContext} from './types.js'

/**
 * Final composition step: confirm the retained selection still describes a
 * real configuration file, derive the storage anchor and identity, and freeze
 * the result. Callers keep this one value for the whole invocation.
 */

/** The selected path must be absolute, validly named, and still a regular (non-symlink) file. */
async function validateRetainedSelection(selection: AppDoctorConfigurationSelection): Promise<void> {
  const {path, fileName} = selection.configuration
  if (!isAbsolutePath(path) || basename(path) !== fileName || !isValidFormatAppConfigurationFileName(fileName)) {
    throw new AppDoctorContextError(
      'INVALID_CONFIGURATION_SELECTION',
      `${path} is not a canonical Shopify app configuration file path.`,
    )
  }
  let stats
  try {
    stats = await lstat(path)
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new AppDoctorContextError('PATH_NOT_FOUND', `${path} no longer exists.`)
    }
    throw ioError('inspect', path, error)
  }
  if (!stats.isFile()) {
    throw new AppDoctorContextError('UNSUPPORTED_PATH', `${path} is no longer a regular file.`)
  }
}

/**
 * Build the immutable context for a selected configuration. The app root is the
 * file's directory because eligible configurations are always direct children.
 */
export async function createAppDoctorContext(selection: AppDoctorConfigurationSelection): Promise<AppDoctorContext> {
  await validateRetainedSelection(selection)
  const {configuration, source} = selection
  const appRoot = dirname(configuration.path)
  const {storageAnchor, storageAnchorKind} = await findStorageAnchor(appRoot)
  const configurationIdentity = computeConfigurationIdentity(storageAnchor, configuration.path)

  return Object.freeze({
    appRoot,
    configurationPath: configuration.path,
    configurationFileName: configuration.fileName,
    configurationIdentity,
    storageAnchor,
    storageAnchorKind,
    storeDirectory: resolveStoreDirectory(storageAnchor, configurationIdentity),
    configurationState: configuration.state,
    ...(configuration.clientId === undefined ? {} : {clientId: configuration.clientId}),
    selectionSource: source,
  })
}
