import Login from './login.js'
import {describe, expect, vi, test} from 'vitest'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
import {startDeviceAuthNoPolling, resumeDeviceAuth} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/session-prompt')
vi.mock('@shopify/cli-kit/node/session')

describe('Login command', () => {
  test('runs login without alias flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(promptSessionSelect).mockResolvedValue('test-account')

    // When
    await Login.run([])

    // Then
    expect(promptSessionSelect).toHaveBeenCalledWith(undefined)
    expect(outputMock.output()).toMatch('Current account: test-account.')
  })

  test('runs login with alias flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(promptSessionSelect).mockResolvedValue('test-account')

    // When
    await Login.run(['--alias', 'my-work-account'])

    // Then
    expect(promptSessionSelect).toHaveBeenCalledWith('my-work-account')
    expect(outputMock.output()).toMatch('Current account: test-account.')
  })

  test('displays flags correctly in help', () => {
    // When
    const flags = Login.flags

    // Then
    expect(flags.alias).toBeDefined()
    expect(flags.alias.description).toBe('Alias of the session you want to login to.')
    expect(flags.alias.env).toBe('SHOPIFY_FLAG_AUTH_ALIAS')
    expect(flags['no-polling']).toBeDefined()
    expect(flags.resume).toBeDefined()
  })

  test('--no-polling starts device auth and prints URL', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(startDeviceAuthNoPolling).mockResolvedValue({
      verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=ABCD-EFGH',
    })

    // When
    await Login.run(['--no-polling'])

    // Then
    expect(startDeviceAuthNoPolling).toHaveBeenCalledOnce()
    expect(outputMock.info()).toMatch('shopify auth login --resume')
    expect(promptSessionSelect).not.toHaveBeenCalled()
  })

  test('--resume succeeds and outputs alias', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(resumeDeviceAuth).mockResolvedValue({status: 'success', alias: 'user@example.com'})

    // When
    await Login.run(['--resume'])

    // Then
    expect(resumeDeviceAuth).toHaveBeenCalledOnce()
    expect(outputMock.output()).toMatch('Logged in as: user@example.com')
  })

  test('--resume exits with error when authorization is still pending', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(resumeDeviceAuth).mockResolvedValue({
      status: 'pending',
      verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=ABCD-EFGH',
    })

    // When
    await expect(Login.run(['--resume'])).rejects.toThrow()

    // Then
    expect(outputMock.error()).toMatch('Authorization is still pending.')
  })

  test('--resume exits with error when no pending auth exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(resumeDeviceAuth).mockResolvedValue({
      status: 'no_pending',
      message: 'No pending login flow. Run `shopify auth login --no-polling` first.',
    })

    // When
    await expect(Login.run(['--resume'])).rejects.toThrow()

    // Then
    expect(outputMock.error()).toMatch('No pending login flow.')
  })

  test('--resume exits with error when auth has expired', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(resumeDeviceAuth).mockResolvedValue({
      status: 'expired',
      message: 'The login flow has expired. Run `shopify auth login --no-polling` again.',
    })

    // When
    await expect(Login.run(['--resume'])).rejects.toThrow()

    // Then
    expect(outputMock.error()).toMatch('The login flow has expired.')
  })
})
