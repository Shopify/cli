import {storeTypeFilters, storeTypeFilterValue, storeTypeHandle, storeTypeLabel} from './store-type.js'
import {describe, expect, test} from 'vitest'

describe('storeTypeHandle', () => {
  test('collapses both dev store types, and the superset alias, onto one handle', () => {
    expect(storeTypeHandle('DEVELOPMENT')).toBe('dev')
    expect(storeTypeHandle('APP_DEVELOPMENT')).toBe('dev')
    expect(storeTypeHandle('DEVELOPMENT_SUPERSET')).toBe('dev')
  })

  test('returns undefined for missing and unrecognized store types', () => {
    expect(storeTypeHandle(undefined)).toBeUndefined()
    expect(storeTypeHandle(null)).toBeUndefined()
    expect(storeTypeHandle('SOMETHING_NEWER_THAN_THE_GENERATED_TYPES')).toBeUndefined()
  })
})

describe('storeTypeLabel', () => {
  test('title-cases a handle and renders a missing one as blank', () => {
    expect(storeTypeLabel('dev')).toBe('Dev')
    expect(storeTypeLabel('client_transfer')).toBe('Client Transfer')
    expect(storeTypeLabel(undefined)).toBe('')
  })
})

describe('storeTypeFilterValue', () => {
  // `dev` has to reach BP as `development_superset`, its alias for "development OR
  // app_development", or `--type dev` would miss one of the two dev store types.
  test('maps every accepted filter to its Business Platform STORE_TYPE value', () => {
    expect(storeTypeFilters.map((filter) => [filter, storeTypeFilterValue(filter)])).toEqual([
      ['dev', 'development_superset'],
      ['production', 'production'],
      ['client_transfer', 'client_transfer'],
      ['collaborator', 'collaborator'],
    ])
  })

  // Every filter has to name a type the listing can render back, so the Type column of a filtered
  // listing never disagrees with the filter that produced it.
  test('accepts only handles that store rows can also report', () => {
    const rowHandles = ['dev', 'production', 'client_transfer', 'collaborator']

    expect(storeTypeFilters.every((filter) => rowHandles.includes(filter))).toBe(true)
  })
})
