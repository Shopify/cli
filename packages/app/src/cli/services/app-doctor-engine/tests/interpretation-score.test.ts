import {RUBY_FILE, SKIPPED_FILE, agentResult, staticResult, suppressionFor} from './fixtures/interpretation.js'
import {interpretAppDoctorCoverage} from '../interpretation/coverage.js'
import {interpretAppDoctorFindings} from '../interpretation/findings.js'
import {scoreAppDoctorInterpretation} from '../interpretation/score.js'
import {describe, expect, test} from 'vitest'
import type {AppDoctorResult} from '../results/index.js'
import type {Suppression} from '../types.js'

const scoreOf = (results: AppDoctorResult[], suppressions: Suppression[] = []) =>
  scoreAppDoctorInterpretation(
    interpretAppDoctorCoverage(results),
    interpretAppDoctorFindings(results, suppressions).findings,
  )

describe('scoreAppDoctorInterpretation', () => {
  test('grades a clean static result at the baseline', () => {
    expect(scoreOf([staticResult()])).toEqual({status: 'graded', total: 100, baseline: 100, grade: 'EXCELLENT'})
  })

  test('deducts each eligible fingerprint exactly once and ignores agent and needs_review evidence', () => {
    const results = [
      staticResult({
        checkId: 'A_CHECK',
        findings: [
          {key: 'one', points: -10},
          {key: 'two', points: -5, confidence: 'needs_review'},
        ],
      }),
      staticResult({checkId: 'B_CHECK', findings: [{key: 'three', points: -7}]}),
      // Shares the fingerprint of A_CHECK/one: merged, so no second deduction.
      agentResult({checkId: 'A_CHECK', findings: [{key: 'one', points: -40}]}),
      agentResult({checkId: 'B_CHECK', findings: [{key: 'agent-only', points: -40}]}),
    ]

    expect(scoreOf(results)).toEqual({status: 'graded', total: 83, baseline: 100, grade: 'GOOD'})
  })

  test('clamps the total at 0', () => {
    const results = [
      staticResult({
        findings: [
          {key: 'a', points: -80},
          {key: 'b', points: -80},
        ],
      }),
    ]
    expect(scoreOf(results)).toEqual({status: 'graded', total: 0, baseline: 100, grade: 'POOR'})
  })

  test('clamps the total at 100', () => {
    const results = [staticResult({findings: [{key: 'bonus', points: 15}]})]
    expect(scoreOf(results)).toEqual({status: 'graded', total: 100, baseline: 100, grade: 'EXCELLENT'})
  })

  test.each([
    [-10, 90, 'EXCELLENT'],
    [-11, 89, 'GOOD'],
    [-25, 75, 'GOOD'],
    [-26, 74, 'NEEDS_WORK'],
    [-40, 60, 'NEEDS_WORK'],
    [-41, 59, 'POOR'],
  ])('points %i → total %i graded %s', (points, total, grade) => {
    expect(scoreOf([staticResult({findings: [{key: 'k', points}]})])).toEqual({
      status: 'graded',
      total,
      baseline: 100,
      grade,
    })
  })

  test('withholds when there are no static results', () => {
    expect(scoreOf([])).toEqual({status: 'withheld', reason: 'no_static_results'})
    expect(scoreOf([agentResult({findings: [{key: 'x'}]})])).toEqual({
      status: 'withheld',
      reason: 'no_static_results',
    })
  })

  test('withholds when any static result reports a coverage gap', () => {
    const results = [
      staticResult({checkId: 'A_CHECK'}),
      staticResult({checkId: 'B_CHECK'}),
      staticResult({
        checkId: 'C_CHECK',
        coverage: {files_skipped: [{path: SKIPPED_FILE, reason: 'too_large', size_bytes: 5_000_000}]},
      }),
    ]
    expect(scoreOf(results)).toEqual({status: 'withheld', reason: 'incomplete_static_coverage'})

    const unsupported = [
      staticResult({checkId: 'A_CHECK', coverage: {unsupported_languages: [{name: 'ruby', files: [RUBY_FILE]}]}}),
    ]
    expect(scoreOf(unsupported)).toEqual({status: 'withheld', reason: 'incomplete_static_coverage'})
  })

  test('a suppressed finding still deducts', () => {
    const result = staticResult({findings: [{key: 'hidden', points: -30}]})
    const suppression = suppressionFor(result.findings[0]?.fingerprint ?? '')

    expect(scoreOf([result], [suppression])).toEqual({status: 'graded', total: 70, baseline: 100, grade: 'NEEDS_WORK'})
  })
})
