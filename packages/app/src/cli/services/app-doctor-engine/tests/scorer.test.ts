import {calculateScore} from '../scorer/index.js'
import {describe, expect, test} from 'vitest'
import type {Issue} from '../types.js'

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'UNSAFE_INNERHTML',
  severity: 'high',
  points: -25,
  title: 'Unsafe HTML',
  message: 'Unsafe HTML',
  location: {file: 'app/a.ts', line: 1},
  fix: {automated: false, description: 'Sanitize input.'},
  found_by: 'static',
  ...overrides,
})

describe('calculateScore', () => {
  test('starts from the baseline when nothing was found', () => {
    expect(calculateScore([])).toEqual({total: 100, baseline: 100, grade: 'EXCELLENT'})
  })

  test.each([
    {points: -10, total: 90, grade: 'EXCELLENT'},
    {points: -11, total: 89, grade: 'GOOD'},
    {points: -25, total: 75, grade: 'GOOD'},
    {points: -26, total: 74, grade: 'NEEDS_WORK'},
    {points: -40, total: 60, grade: 'NEEDS_WORK'},
    {points: -41, total: 59, grade: 'POOR'},
  ])('grades a $total score as $grade', ({points, total, grade}) => {
    expect(calculateScore([issue({points})])).toMatchObject({total, grade})
  })

  test('keeps the total within the grading range', () => {
    expect(calculateScore([issue({points: -500})]).total).toBe(0)
    expect(calculateScore([issue({points: 500})]).total).toBe(100)
  })

  test.each([
    {name: 'agent findings', overrides: {found_by: 'agent'} as Partial<Issue>},
    {name: 'external findings', overrides: {found_by: 'external'} as Partial<Issue>},
    {name: 'findings needing review', overrides: {confidence: 'needs_review'} as Partial<Issue>},
  ])('does not deduct for $name', ({overrides}) => {
    expect(calculateScore([issue(overrides)]).total).toBe(100)
  })

  test('deducts once per distinct piece of evidence', () => {
    const evidence = [{location: {file: 'app/a.ts', line: 1}, quote: 'element.innerHTML = input'}]
    expect(calculateScore([issue({evidence}), issue({evidence})]).total).toBe(75)
    expect(calculateScore([issue({evidence}), issue({location: {file: 'app/b.ts', line: 1}, evidence})]).total).toBe(50)
  })
})
