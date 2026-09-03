import {storeTypeHandle, storeTypeLabel} from './store-type.js'
import {describe, expect, test} from 'vitest'

describe('storeTypeHandle', () => {
  test('returns dev for development store types', () => {
    expect(storeTypeHandle('APP_DEVELOPMENT')).toBe('dev')
    expect(storeTypeHandle('DEVELOPMENT')).toBe('dev')
    expect(storeTypeHandle('DEVELOPMENT_SUPERSET')).toBe('dev')
  })

  test('returns expected handles for non-dev store types', () => {
    expect(storeTypeHandle('CLIENT_TRANSFER')).toBe('client_transfer')
    expect(storeTypeHandle('COLLABORATOR')).toBe('collaborator')
    expect(storeTypeHandle('PRODUCTION')).toBe('production')
  })

  test('returns undefined for unrecognized store types', () => {
    expect(storeTypeHandle('UNKNOWN_STORE_TYPE')).toBeUndefined()
  })

  test('returns undefined for empty, null, or undefined values', () => {
    expect(storeTypeHandle('')).toBeUndefined()
    expect(storeTypeHandle(null)).toBeUndefined()
    expect(storeTypeHandle(undefined)).toBeUndefined()
  })
})

describe('storeTypeLabel', () => {
  test('returns title-cased labels for store handles', () => {
    expect(storeTypeLabel('dev')).toBe('Dev')
    expect(storeTypeLabel('client_transfer')).toBe('Client Transfer')
    expect(storeTypeLabel('collaborator')).toBe('Collaborator')
    expect(storeTypeLabel('production')).toBe('Production')
  })

  test('returns empty string for undefined or empty handle', () => {
    expect(storeTypeLabel(undefined)).toBe('')
    expect(storeTypeLabel('')).toBe('')
  })
})
