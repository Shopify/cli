import type {AppSecurityEngineMetadata, AppSecurityExecution} from './app-security-api.js'
import type {ReviewPack, DeterministicFindingsDocument} from './app-security-engine/index.js'

interface AppSecurityJsonResult {
  engine: AppSecurityEngineMetadata
  deterministic_findings: DeterministicFindingsDocument
  reviewPack: ReviewPack
}

export function toSecurityJson(
  execution: Pick<AppSecurityExecution, 'engine' | 'artifact' | 'reviewPack'>,
): AppSecurityJsonResult {
  return {
    engine: execution.engine,
    deterministic_findings: execution.artifact,
    reviewPack: execution.reviewPack,
  }
}

export function encodeSecurityJson(result: AppSecurityJsonResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}
