import {mapPlanToPublicHandle} from './plan.js'
import {describe, test, expect} from 'vitest'

describe('mapPlanToPublicHandle', () => {
  test('maps internal plan names to public handles', () => {
    expect(mapPlanToPublicHandle('basic')).toBe('basic')
    expect(mapPlanToPublicHandle('professional')).toBe('grow')
    expect(mapPlanToPublicHandle('unlimited')).toBe('advanced')
    expect(mapPlanToPublicHandle('shopify_plus')).toBe('plus')
  })

  test('accepts the public handles themselves', () => {
    expect(mapPlanToPublicHandle('grow')).toBe('grow')
    expect(mapPlanToPublicHandle('advanced')).toBe('advanced')
    expect(mapPlanToPublicHandle('plus')).toBe('plus')
  })

  test('is case-insensitive', () => {
    expect(mapPlanToPublicHandle('Professional')).toBe('grow')
    expect(mapPlanToPublicHandle('SHOPIFY_PLUS')).toBe('plus')
  })

  test('returns undefined for unrecognized plans', () => {
    expect(mapPlanToPublicHandle('staff')).toBeUndefined()
    expect(mapPlanToPublicHandle('development_legacy')).toBeUndefined()
    expect(mapPlanToPublicHandle('some_new_plan')).toBeUndefined()
  })

  test('returns undefined when no plan is provided', () => {
    expect(mapPlanToPublicHandle(undefined)).toBeUndefined()
    expect(mapPlanToPublicHandle('')).toBeUndefined()
  })
})
