/**
 * The store root: where a configuration's store lives beneath the storage
 * anchor, whether that root is usable, and where the results directory sits
 * inside it. Shared by the results and suppressions stores so neither depends
 * on the other.
 */
import {inspectStorePath, storePathComponents} from './files.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {AppDoctorStoreDiagnostic} from './types.js'
import type {AppDoctorContext} from '../context/types.js'

const RESULTS_DIRECTORY = 'results'

export const resultsDirectoryOf = (context: AppDoctorContext): string =>
  joinPath(context.storeDirectory, RESULTS_DIRECTORY)

/** The store directory must be a strict descendant of the storage anchor and the identity nonempty. */
export function validateStoreContext(context: AppDoctorContext): AppDoctorStoreDiagnostic | undefined {
  const components = storePathComponents(context.storageAnchor, context.storeDirectory)
  if (components === undefined || components.length === 0) {
    return {
      code: 'invalid-context',
      path: context.storeDirectory,
      message: 'The store directory is not beneath the storage anchor.',
    }
  }
  if (context.configurationIdentity.trim().length === 0) {
    return {code: 'invalid-context', path: context.storeDirectory, message: 'The configuration identity is empty.'}
  }
  return undefined
}

export type StoreState =
  | {status: 'present'}
  | {status: 'missing'}
  | {status: 'unavailable'; diagnostic: AppDoctorStoreDiagnostic}

/** Whether the store root exists as a real directory. Never creates it. */
export async function inspectStore(context: AppDoctorContext): Promise<StoreState> {
  const inspection = await inspectStorePath(context.storageAnchor, context.storeDirectory)
  if (!inspection.ok) return {status: 'unavailable', diagnostic: inspection.diagnostic}
  if (inspection.value.kind === 'absent') return {status: 'missing'}
  if (inspection.value.kind === 'directory') return {status: 'present'}
  return {
    status: 'unavailable',
    diagnostic: {code: 'unsafe-path', path: context.storeDirectory, message: 'The store is not a directory.'},
  }
}
