import Login from './login.js'
import {describe, expect, vi, test} from 'vitest'
import {promptSessionSelectWithDetails} from '@shopify/cli-kit/node/session-prompt'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/session-prompt')
vi.mock('@shopify/cli-kit/node/system')

describe('Login command', () => {
  test('runs login without alias flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(promptSessionSelectWithDetails).mockResolvedValue({
      userId: 'user-123',
      alias: 'test-account',
      email: null,
    })

    // When
    await Login.run([])

    // Then
    expect(promptSessionSelectWithDetails).toHaveBeenCalledWith(undefined)
    expect(outputMock.output()).toMatch('Current account: test-account.')
  })

  test('runs login with alias flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(promptSessionSelectWithDetails).mockResolvedValue({
      userId: 'user-123',
      alias: 'test-account',
      email: null,
    })

    // When
    await Login.run(['--alias', 'my-work-account'])

    // Then
    expect(promptSessionSelectWithDetails).toHaveBeenCalledWith('my-work-account')
    expect(outputMock.output()).toMatch('Current account: test-account.')
  })

  test('displays flags correctly in help', () => {
    // When
    const flags = Login.flags

    // Then
    expect(flags.alias).toBeDefined()
    expect(flags.alias).toMatchObject({requiredIfNonInteractive: true})
    expect(flags.alias.description).toBe('Alias of an existing session you want to use. Required if non interactive.')
    expect(flags.alias.env).toBe('SHOPIFY_FLAG_AUTH_ALIAS')
  })
})
