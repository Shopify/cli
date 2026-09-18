/**
 * Metadata inventory: which scopes exist for the selected configuration now,
 * and what retained results claim about theirs.
 *
 * Pure. Retained descriptors are reported as data and never resolved against
 * the filesystem; duplicate scope identities are all kept, with no winner.
 */
import {appDoctorScopeIdentity, projectAppDoctorPath} from './paths.js'
import {AppDoctorScopeError} from './types.js'
import type {AppDoctorCurrentScope, AppDoctorMetadataInventory, AppDoctorRetainedScopeObservation} from './types.js'
import type {AppDoctorContext} from '../context/types.js'
import type {AppDoctorResult} from '../results/index.js'

const implicitAppScope = (context: AppDoctorContext): AppDoctorCurrentScope => ({
  scopeIdentity: appDoctorScopeIdentity(context.storageAnchor, context.appRoot),
  directory: context.appRoot,
  reference: projectAppDoctorPath(context.storageAnchor, context.appRoot),
  selection: 'implicit_app',
})

const observeRetainedResult = (
  result: AppDoctorResult,
  currentIdentities: ReadonlySet<string>,
): AppDoctorRetainedScopeObservation => ({
  owner: {
    configuration_identity: result.configuration_identity,
    scope_identity: result.scope_identity,
    check_id: result.check_id,
    mode: result.mode,
  },
  descriptor: result.scope,
  producedAt: result.produced_at,
  selection: 'retained_only',
  matchesCurrent: currentIdentities.has(result.scope_identity),
})

/**
 * Build the inventory for one configuration. Retained results must all belong
 * to `context`'s configuration; a different owner is rejected at this boundary.
 */
export function buildAppDoctorMetadataInventory(
  context: AppDoctorContext,
  retainedResults: ReadonlyArray<AppDoctorResult>,
): AppDoctorMetadataInventory {
  if (retainedResults.some((result) => result.configuration_identity !== context.configurationIdentity)) {
    throw new AppDoctorScopeError(
      'FOREIGN_CONFIGURATION',
      'A retained result belongs to a different configuration than the selected one.',
    )
  }
  const current = [implicitAppScope(context)]
  const currentIdentities = new Set(current.map((scope) => scope.scopeIdentity))
  return {
    current,
    retained: retainedResults.map((result) => observeRetainedResult(result, currentIdentities)),
  }
}
