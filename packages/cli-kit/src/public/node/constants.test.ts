import {STORE_AUTH_APP_CLIENT_ID} from './constants.js'
import {describe, expect, test} from 'vitest'

describe('STORE_AUTH_APP_CLIENT_ID', () => {
  test('exports a non-empty string client ID', () => {
    expect(typeof STORE_AUTH_APP_CLIENT_ID).toBe('string')
    expect(STORE_AUTH_APP_CLIENT_ID.length).toBeGreaterThan(0)
  })
})
