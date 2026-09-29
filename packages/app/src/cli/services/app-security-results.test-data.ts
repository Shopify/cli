import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {
  combineFindings,
  type AgentFindingsDocument,
  type DeterministicFindingsDocument,
} from './app-security-engine/index.js'
import type {AppSecurityResults} from './app-security-results.js'

export interface AppSecurityResultsSources {
  deterministic: DeterministicFindingsDocument | null
  agent: AgentFindingsDocument | null
}

/**
 * The results `loadAppSecurityResults` would return for `appRoot` if its result files held these documents,
 * without touching the filesystem. Each call combines afresh, so tests share no state through it.
 */
export function appSecurityResultsFor(appRoot: string, sources: AppSecurityResultsSources): AppSecurityResults {
  const paths = appSecurityArtifactPaths(appRoot)
  return {
    sources: {
      deterministic: sources.deterministic
        ? {path: paths.deterministicFindingsPath, document: sources.deterministic}
        : null,
      agent: sources.agent ? {path: paths.agentFindingsPath, document: sources.agent} : null,
    },
    checks: combineFindings(sources),
  }
}
