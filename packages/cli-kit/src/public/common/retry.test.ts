import {performActionWithRetryAfterRecovery} from './retry.js'
import {describe, expect, test} from 'vitest'

describe('performActionWithRetryAfterRecovery', () => {
  function failUntilRecovered() {
    let succeed = false
    async function action(): Promise<string> {
      if (!succeed) {
        throw new Error('fail')
      }
      return 'ok'
    }
    async function recover(): Promise<void> {
      succeed = true
    }
    async function failToRecover(): Promise<void> {
      // dummy recovery action
    }
    return {action, recover, failToRecover}
  }

  test('succeeds when no error', async () => {
    // Given/When
    const got = await performActionWithRetryAfterRecovery<string>(
      async () => 'ok',
      async () => {},
    )

    // Then
    expect(got).toBe('ok')
  })

  test('succeeds when error on first try', async () => {
    // Given
    const {action, recover} = failUntilRecovered()
    await expect(action()).rejects.toThrow('fail')

    // When
    const got = await performActionWithRetryAfterRecovery(action, recover)

    // Then
    expect(got).toBe('ok')
  })

  test('fails when error afters recovery', async () => {
    // Given
    const {action, failToRecover} = failUntilRecovered()
    await expect(action()).rejects.toThrow('fail')

    // When/Then
    await expect(performActionWithRetryAfterRecovery(action, failToRecover)).rejects.toThrow('fail')
  })
})
