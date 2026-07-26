import {SHOPIFY_API_ACCESS_SCOPES, buildStoreAuthScopeChoices} from './scope-catalog.js'
import {describe, expect, test} from 'vitest'

describe('SHOPIFY_API_ACCESS_SCOPES', () => {
  test('has unique values', () => {
    const values = SHOPIFY_API_ACCESS_SCOPES.map((scope) => scope.value)
    expect(new Set(values).size).toBe(values.length)
  })

  test('every value matches the read_/write_ scope naming convention', () => {
    for (const scope of SHOPIFY_API_ACCESS_SCOPES) {
      expect(scope.value).toMatch(/^(read|write)_[a-z0-9_]+$/)
    }
  })

  test('every entry has a non-empty group and description', () => {
    for (const scope of SHOPIFY_API_ACCESS_SCOPES) {
      expect(scope.group.length).toBeGreaterThan(0)
      expect(scope.description.length).toBeGreaterThan(0)
    }
  })
})

describe('buildStoreAuthScopeChoices', () => {
  test('returns one choice per catalog entry with label equal to value', () => {
    const {choices} = buildStoreAuthScopeChoices()

    expect(choices).toHaveLength(SHOPIFY_API_ACCESS_SCOPES.length)
    for (const choice of choices) {
      expect(choice.label).toBe(choice.value)
    }
  })

  test('folds a scope note into its description', () => {
    const {choices} = buildStoreAuthScopeChoices()
    const readAllOrders = choices.find((choice) => choice.value === 'read_all_orders')

    expect(readAllOrders?.description).toContain('View all orders, not just those placed in the last 60 days')
    expect(readAllOrders?.description).toContain(
      'Requires requesting access from the Partner Dashboard before it can be added to an app.',
    )
  })

  test('does not append parentheses for scopes without a note', () => {
    const {choices} = buildStoreAuthScopeChoices()
    const readProducts = choices.find((choice) => choice.value === 'read_products')

    expect(readProducts?.description).toBe('View products, variants, and collections')
  })

  test('groupOrder is the sorted set of unique groups', () => {
    const {groupOrder} = buildStoreAuthScopeChoices()
    const expected = [...new Set(SHOPIFY_API_ACCESS_SCOPES.map((scope) => scope.group))].sort()

    expect(groupOrder).toEqual(expected)
  })
})
