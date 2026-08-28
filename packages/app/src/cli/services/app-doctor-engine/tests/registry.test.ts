import {DETERMINISTIC_RULES, getRegistry, loadChecks} from '../index.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {describe, expect, test} from 'vitest'

describe('authoritative registry', () => {
  test('contains every executable deterministic rule and shipped agent check exactly once', () => {
    const registry = getRegistry()
    expect(
      registry
        .filter((entry) => entry.kind === 'deterministic')
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(DETERMINISTIC_RULES.map((entry) => entry.id).sort())
    expect(
      registry
        .filter((entry) => entry.kind === 'agent')
        .map((entry) => entry.id)
        .sort(),
    ).toEqual([...loadChecks().keys()].sort())
    expect(new Set(registry.map((entry) => `${entry.kind}:${entry.id}`)).size).toBe(registry.length)
  })

  test('has catalog documentation for every deterministic rule', () => {
    const catalogIds = new Set(RULE_CATALOG.map((entry) => entry.id))
    expect(DETERMINISTIC_RULES.filter((entry) => !catalogIds.has(entry.id))).toEqual([])
  })
})
