import {STORE_AUTH_APP_CLIENT_ID} from './constants.js'
import {describe, expect, test} from 'vitest'

describe('constants', () => {
  test('STORE_AUTH_APP_CLIENT_ID has the correct value', () => {
    expect(STORE_AUTH_APP_CLIENT_ID).toBe('7e9cb568cfd431c538f36d1ad3f2b4f6')
  })
})
