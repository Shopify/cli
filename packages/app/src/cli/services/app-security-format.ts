import type {CombinedChecksSummary} from './app-security-engine/index.js'

/**
 * Words shared by the app security commands' terminal output, so `review` and `record` describe checks and
 * counts the same way.
 */

/** "1 check", "2 checks". */
export function countLabel(total: number, noun: string): string {
  return `${total} ${total === 1 ? noun : `${noun}s`}`
}

/** "3 checks with findings". */
export function checksWithFindingsLabel(summary: CombinedChecksSummary): string {
  return `${countLabel(summary.withFindings, 'check')} with findings`
}

/**
 * The non-zero outcomes of the checks without findings, in display order: "5 passed",
 * "2 with no deterministic findings", "1 not applicable", "2 unresolved".
 */
export function checkStatusLabels(summary: CombinedChecksSummary, withoutDeterministicFindings: number): string[] {
  const passed = summary.passed - withoutDeterministicFindings
  return [
    passed > 0 ? `${passed} passed` : undefined,
    withoutDeterministicFindings > 0 ? `${withoutDeterministicFindings} with no deterministic findings` : undefined,
    summary.notApplicable > 0 ? `${summary.notApplicable} not applicable` : undefined,
    summary.unresolved > 0 ? `${summary.unresolved} unresolved` : undefined,
  ].filter((label) => label !== undefined)
}
