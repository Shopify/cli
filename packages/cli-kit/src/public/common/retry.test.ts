import {tryWithRetryAfterRecoveryFunction} from './retry.js'
import {describe, expect, test} from 'vitest'

describe('tryWithRetryAfterRecoveryFunction', () => {
  function failUntilRecovered() {
    let succeed = false
    const action = () => {
      if (!succeed) {
        throw new Error('fail')
      }
      return 'ok'
    }
    const recover = () => {
      succeed = true
    }
    return {action, recover}
  }

  test('succeeds when no error', async () => {
    // Given/When
    const got = await tryWithRetryAfterRecoveryFunction(() => 'ok', () => 'recovered')

    // Then
    expect(got).toBe('ok')
  })

  test('succeeds when error on first try', async () => {
    // Given
    const {action, recover} = failUntilRecovered()
    expect(action).toThrow('fail')

    // When
    const got = await tryWithRetryAfterRecoveryFunction(action, recover)

    // Then
    expect(got).toBe('ok')
  })

  test('fails when error afters recovery', async () => {
    // Given
    const {action} = failUntilRecovered()
    expect(action).toThrow('fail')


    // When/Then
    expect(tryWithRetryAfterRecoveryFunction(action, () => 'not recovering')).rejects.toThrow('fail')
  })
})
