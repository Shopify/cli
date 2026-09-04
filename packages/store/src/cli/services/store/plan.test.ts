import {planHandle, planLabel} from './plan.js'
import {describe, test, expect} from 'vitest'

describe('planHandle', () => {
  test('maps internal plan names to public handles', () => {
    expect(planHandle('basic')).toBe('basic')
    expect(planHandle('professional')).toBe('grow')
    expect(planHandle('unlimited')).toBe('advanced')
    expect(planHandle('shopify_plus')).toBe('plus')
  })

  test('accepts the public handles themselves', () => {
    expect(planHandle('grow')).toBe('grow')
    expect(planHandle('advanced')).toBe('advanced')
    expect(planHandle('plus')).toBe('plus')
  })

  test('is case-insensitive', () => {
    expect(planHandle('Professional')).toBe('grow')
    expect(planHandle('SHOPIFY_PLUS')).toBe('plus')
  })

  test('returns undefined for unrecognized plans', () => {
    expect(planHandle('staff')).toBeUndefined()
    expect(planHandle('development_legacy')).toBeUndefined()
    expect(planHandle('some_new_plan')).toBeUndefined()
  })

  test('returns undefined when no plan is provided', () => {
    expect(planHandle(undefined)).toBeUndefined()
    expect(planHandle(null)).toBeUndefined()
    expect(planHandle('')).toBeUndefined()
  })
})

describe('planLabel', () => {
  test('title-cases the public handle', () => {
    expect(planLabel('basic')).toBe('Basic')
    expect(planLabel('grow')).toBe('Grow')
    expect(planLabel('advanced')).toBe('Advanced')
    expect(planLabel('plus')).toBe('Plus')
  })

  test('renders an empty column for an unrecognized plan', () => {
    expect(planLabel(undefined)).toBe('')
  })
})
