import {groupIssues} from './group-issues.js'
import {describe, expect, test} from 'vitest'
import type {Issue} from '../types.js'

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'COMMITTED_SECRET',
    pattern_id: 'Shopify token',
    severity: 'high',
    title: 'Hardcoded Shopify token detected',
    message: 'A token was found.',
    points: -50,
    location: {file: 'app/a.ts', line: 1},
    fix: {automated: false, description: 'Rotate the token.'},
    ...overrides,
  }
}

describe('groupIssues', () => {
  test('uses stable rule and pattern identity, not messages, titles, or locations', () => {
    const issues = [issue(), issue({title: 'Updated wording', message: 'More detail', location: {file: 'app/b.ts'}})]
    const before = structuredClone(issues)
    const groups = groupIssues(issues)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.issues).toHaveLength(2)
    expect(groups[0]!.files).toEqual(['app/a.ts', 'app/b.ts'])
    expect(groups[0]!.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(issues).toEqual(before)
  })

  test('keeps different rules, patterns, sources, and severities separate', () => {
    expect(
      groupIssues([
        issue(),
        issue({id: 'ANOTHER_RULE'}),
        issue({pattern_id: 'Private key'}),
        issue({severity: 'low'}),
        issue({found_by: 'agent'}),
        issue({found_by: 'external'}),
      ]),
    ).toHaveLength(6)
  })

  test('normalizes Windows paths when counting distinct files', () => {
    const groups = groupIssues([issue({location: {file: 'app\\a.ts', line: 2}}), issue()])
    expect(groups[0]!.files).toEqual(['app/a.ts'])
    expect(groups[0]!.issues).toHaveLength(2)
  })

  test('preserves exactly repeated occurrences and handles empty input', () => {
    expect(groupIssues([])).toEqual([])
    const repeated = issue()
    expect(groupIssues([repeated, repeated])[0]!.issues).toHaveLength(2)
  })
})
