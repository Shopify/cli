import {
  buildAppDoctorMetadataInventory,
  enumerateAppDoctorResults,
  interpretAppDoctorResults,
  readAppDoctorSuppressions,
} from './app-doctor-engine/index.js'
import type {
  AppDoctorContext,
  AppDoctorImmediateDiagnostic,
  AppDoctorInterpretation,
  AppDoctorResult,
  AppDoctorStoreDiagnostic,
} from './app-doctor-engine/index.js'

export interface AppDoctorStoredResults {
  /** `missing` is a normal state; `unavailable` means something unusable sits where the store should be. */
  readonly store: 'present' | 'missing' | 'unavailable'
  /** Every validated result the store holds for this configuration, in any mode and for any owner. */
  readonly results: ReadonlyArray<AppDoctorResult>
  readonly interpretation: AppDoctorInterpretation
  /** Absolute directories of the scopes that exist for this configuration right now, by scope identity. */
  readonly directories: ReadonlyMap<string, string>
}

/** Store diagnostics are persisted-file problems; interpretation carries them through as immediate diagnostics. */
export const toImmediateDiagnostic =
  (source: AppDoctorImmediateDiagnostic['source']) =>
  (diagnostic: AppDoctorStoreDiagnostic): AppDoctorImmediateDiagnostic => ({
    source,
    code: diagnostic.code,
    message: diagnostic.message,
    path: diagnostic.path,
  })

/**
 * Read everything the store holds for this configuration and interpret it.
 * Nothing is rescanned. Store diagnostics (misowned, malformed, or misnamed
 * files) come first in the interpretation, followed by `extraDiagnostics`
 * from the calling operation, so callers can show them rather than silently
 * skipping those files. Callers decide what an `unavailable` store means.
 */
export async function readAppDoctorStoredResults(
  context: AppDoctorContext,
  extraDiagnostics: ReadonlyArray<AppDoctorImmediateDiagnostic> = [],
): Promise<AppDoctorStoredResults> {
  const read = await enumerateAppDoctorResults(context)
  const results = read.results.map((entry) => entry.result)
  const inventory = buildAppDoctorMetadataInventory(context, results)
  const suppressionRead = await readAppDoctorSuppressions(context)
  const suppressions = suppressionRead.status === 'ok' ? suppressionRead.document.suppressions : []
  const interpretation = interpretAppDoctorResults({
    configurationIdentity: context.configurationIdentity,
    results,
    inventory,
    suppressions,
    diagnostics: [
      ...[...read.diagnostics, ...suppressionRead.diagnostics].map(toImmediateDiagnostic('store')),
      ...extraDiagnostics,
    ],
  })
  const directories = new Map(inventory.current.map((scope) => [scope.scopeIdentity, scope.directory]))
  return {store: read.store, results, interpretation, directories}
}
