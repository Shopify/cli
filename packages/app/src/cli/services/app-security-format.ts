import type {CombinedChecksSummary} from './app-security-engine/index.js'

/**
 * Words shared by the App Security commands' terminal output. `review`'s summary box and `submit`'s
 * confirmation both describe the same combined checks, so they take their count phrases from here.
 */

/** "1 check", "2 checks". */
export function countLabel(total: number, noun: string): string {
  return `${total} ${total === 1 ? noun : `${noun}s`}`
}

/** "3 checks with findings". */
export function checksWithFindingsLabel(summary: CombinedChecksSummary): string {
  return `${countLabel(summary.withFindings, 'check')} with findings`
}

/** The non-zero status counts of the checks without findings, in display order: "5 passed", "1 not applicable", "2 unresolved". */
export function checkStatusLabels(summary: CombinedChecksSummary): string[] {
  return [
    summary.passed > 0 ? `${summary.passed} passed` : undefined,
    summary.notApplicable > 0 ? `${summary.notApplicable} not applicable` : undefined,
    summary.unresolved > 0 ? `${summary.unresolved} unresolved` : undefined,
  ].filter((label) => label !== undefined)
}
