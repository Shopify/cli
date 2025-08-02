import Login from './login.js'
import {describe, expect, vi, test} from 'vitest'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/session-prompt')

describe('Login command', () => {
  test('runs login without alias flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(promptSessionSelect).mockResolvedValue({userId: 'test-user-id'})

    // When
    await Login.run([])

    // Then
    expect(promptSessionSelect).toHaveBeenCalledWith(undefined)
    expect(outputMock.output()).toBe('')
  })

  test('runs login with alias flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(promptSessionSelect).mockResolvedValue({userId: 'test-user-id'})

    // When
    await Login.run(['--alias', 'my-work-account'])

    // Then
    expect(promptSessionSelect).toHaveBeenCalledWith('my-work-account')
    expect(outputMock.output()).toBe('')
  })

  test('displays flags correctly in help', () => {
    // When
    const flags = Login.flags

    // Then
    expect(flags.alias).toBeDefined()
    expect(flags.alias.description).toBe('An alias to identify the session.')
    expect(flags.alias.env).toBe('SHOPIFY_FLAG_AUTH_ALIAS')
  })
})
