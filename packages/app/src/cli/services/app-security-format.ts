import type {CombinedChecksSummary} from './app-security-engine/index.js'

/**
 * Words shared by the app security commands' terminal output, so `review` and `record` describe checks and
 * counts the same way.
 */

/** "1 check", "2 checks". */
export function countLabel(total: number, noun: string): string {
  return `${total} ${total === 1 ? noun : `${noun}s`}`
}

/** "7", "7 and 8", "7, 8 and 9". */
export function listedNumbers(numbers: (number | string)[]): string {
  if (numbers.length === 1) return String(numbers[0])
  return `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
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
