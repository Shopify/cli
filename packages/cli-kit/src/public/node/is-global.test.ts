import {currentProcessIsGlobal} from './is-global.js'
import {describe, expect, test} from 'vitest'

describe('currentProcessIsGlobal', () => {
  test('returns true if npm_config_user_agent is undefined', () => {
    // Given
    const env = {}

    // When
    const got = currentProcessIsGlobal(env)

    // Then
    expect(got).toBeTruthy()
  })

  test('returns pnpm if the npm_config_user_agent variable contains pnpm', () => {
    // Given
    const env = {npm_config_user_agent: 'pnpm'}

    // When
    const got = currentProcessIsGlobal(env)

    // Then
    expect(got).toBeFalsy()
  })
})
