import {checkStatusLabels, checksWithFindingsLabel, countLabel} from './app-security-format.js'
import {describe, expect, test} from 'vitest'
import type {CombinedChecksSummary} from './app-security-engine/index.js'

function summary(counts: Partial<CombinedChecksSummary> = {}): CombinedChecksSummary {
  return {withFindings: 0, passed: 0, notApplicable: 0, unresolved: 0, suppressed: 0, superseded: 0, ...counts}
}

describe('countLabel', () => {
  test('pluralizes every count except one, including zero', () => {
    expect(countLabel(0, 'check')).toBe('0 checks')
    expect(countLabel(1, 'check')).toBe('1 check')
    expect(countLabel(2, 'check')).toBe('2 checks')
    expect(countLabel(1, 'finding')).toBe('1 finding')
    expect(countLabel(12, 'finding')).toBe('12 findings')
  })
})

describe('checksWithFindingsLabel', () => {
  test('counts the checks with findings and ignores the other counts', () => {
    expect(checksWithFindingsLabel(summary({withFindings: 1, passed: 4, unresolved: 2}))).toBe('1 check with findings')
    expect(checksWithFindingsLabel(summary({withFindings: 3}))).toBe('3 checks with findings')
    expect(checksWithFindingsLabel(summary({passed: 5}))).toBe('0 checks with findings')
  })
})

describe('checkStatusLabels', () => {
  test('lists the statuses in display order: passed, not applicable, unresolved', () => {
    expect(checkStatusLabels(summary({passed: 5, notApplicable: 1, unresolved: 2}))).toEqual([
      '5 passed',
      '1 not applicable',
      '2 unresolved',
    ])
  })

  test('omits a status with no checks, keeping the order of the rest', () => {
    expect(checkStatusLabels(summary({passed: 1, unresolved: 3}))).toEqual(['1 passed', '3 unresolved'])
    expect(checkStatusLabels(summary({notApplicable: 2}))).toEqual(['2 not applicable'])
  })

  test('is empty when every check has findings, so the caller renders no status line', () => {
    expect(checkStatusLabels(summary({withFindings: 4, suppressed: 1, superseded: 2}))).toEqual([])
  })

  test('does not pluralize the status counts, which name a status rather than a noun', () => {
    expect(checkStatusLabels(summary({passed: 1, notApplicable: 1, unresolved: 1}))).toEqual([
      '1 passed',
      '1 not applicable',
      '1 unresolved',
    ])
  })
})
