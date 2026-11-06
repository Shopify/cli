import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {
  combineFindings,
  type AgentFindingsDocument,
  type DeterministicFindingsDocument,
  type SuppressionEntry,
} from './app-security-engine/index.js'
import type {AppSecurityResults} from './app-security-results.js'

export interface AppSecurityResultsSources {
  deterministic: DeterministicFindingsDocument | null
  agent: AgentFindingsDocument | null
}

/**
 * The results `loadAppSecurityResults` would return for `appDirectory` and `resultsKey` if its result files held
 * these documents, shopify.app-security.json held these entries, and the files at `missingPaths` were gone, without
 * touching the filesystem. Each call combines afresh, so tests share no state through it.
 */
export function appSecurityResultsFor(
  appDirectory: string,
  resultsKey: string,
  sources: AppSecurityResultsSources,
  suppressionEntries: SuppressionEntry[] = [],
  missingPaths: string[] = [],
): AppSecurityResults {
  const paths = appSecurityArtifactPaths(appDirectory, resultsKey)
  return {
    sources: {
      deterministic: sources.deterministic
        ? {path: paths.deterministicFindingsPath, document: sources.deterministic}
        : null,
      agent: sources.agent ? {path: paths.agentFindingsPath, document: sources.agent} : null,
    },
    ...combineFindings({...sources, suppressions: {entries: suppressionEntries, resultsKey, missingPaths}}),
  }
}
