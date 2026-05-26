import Login from './login.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
import {getAuthStatus, resumeDeviceAuthLogin, startDeviceAuthLogin} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {isTTY} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/session-prompt')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')

describe('Login command', () => {
  beforeEach(() => {
    vi.mocked(isTTY).mockReturnValue(true)
  })

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

  test('runs login with new flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(promptSessionSelect).mockResolvedValue('new-account')

    // When
    await Login.run(['--new'])

    // Then
    expect(promptSessionSelect).toHaveBeenCalledWith(undefined, {forceNewSession: true})
    expect(outputMock.output()).toMatch('Current account: new-account.')
  })

  test('starts resumable device auth without polling in non-TTY', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(getAuthStatus).mockResolvedValue({
      status: 'not_authenticated',
      authenticated: false,
      agentGuidance: {
        instruction: 'Log in.',
      },
    })
    vi.mocked(startDeviceAuthLogin).mockResolvedValue({
      verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=ABCD-EFGH',
      userCode: 'ABCD-EFGH',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })

    // When
    await Login.run([])

    // Then
    expect(startDeviceAuthLogin).toHaveBeenCalledOnce()
    expect(promptSessionSelect).not.toHaveBeenCalled()
    expect(outputMock.info()).toMatch('shopify auth login --resume')
  })

  test('returns current session in non-TTY when already authenticated', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(getAuthStatus).mockResolvedValue({
      status: 'authenticated',
      authenticated: true,
      account: {
        userId: 'user-id',
        alias: 'user@example.com',
      },
      agentGuidance: {
        instruction: 'Continue.',
      },
    })

    // When
    await Login.run([])

    // Then
    expect(getAuthStatus).toHaveBeenCalledOnce()
    expect(startDeviceAuthLogin).not.toHaveBeenCalled()
    expect(promptSessionSelect).not.toHaveBeenCalled()
    expect(outputMock.output()).toMatch('Current account: user@example.com.')
  })

  test('--new starts device auth in non-TTY even when already authenticated', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(getAuthStatus).mockResolvedValue({
      status: 'authenticated',
      authenticated: true,
      account: {
        userId: 'user-id',
        alias: 'user@example.com',
      },
      agentGuidance: {
        instruction: 'Continue.',
      },
    })
    vi.mocked(startDeviceAuthLogin).mockResolvedValue({
      verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=ABCD-EFGH',
      userCode: 'ABCD-EFGH',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })

    // When
    await Login.run(['--new'])

    // Then
    expect(getAuthStatus).not.toHaveBeenCalled()
    expect(startDeviceAuthLogin).toHaveBeenCalledOnce()
    expect(outputMock.info()).toMatch('shopify auth login --resume')
  })

  test('--resume succeeds and outputs current account', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(resumeDeviceAuthLogin).mockResolvedValue({status: 'success', alias: 'user@example.com'})

    // When
    await Login.run(['--resume'])

    // Then
    expect(resumeDeviceAuthLogin).toHaveBeenCalledOnce()
    expect(startDeviceAuthLogin).not.toHaveBeenCalled()
    expect(promptSessionSelect).not.toHaveBeenCalled()
    expect(outputMock.output()).toMatch('Current account: user@example.com.')
  })

  test('--resume exits with error when authorization is still pending', async () => {
    // Given
    vi.mocked(resumeDeviceAuthLogin).mockResolvedValue({
      status: 'pending',
      verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=ABCD-EFGH',
      userCode: 'ABCD-EFGH',
    })

    // When
    await expect(Login.run(['--resume'])).rejects.toThrow('process.exit unexpectedly called with "1"')

    // Then
    expect(resumeDeviceAuthLogin).toHaveBeenCalledOnce()
  })

  test('--resume exits with error when no pending auth exists', async () => {
    // Given
    vi.mocked(resumeDeviceAuthLogin).mockResolvedValue({
      status: 'no_pending',
      message: 'No pending login flow. Run `shopify auth login` first.',
    })

    // When
    await expect(Login.run(['--resume'])).rejects.toThrow('process.exit unexpectedly called with "1"')

    // Then
    expect(resumeDeviceAuthLogin).toHaveBeenCalledOnce()
  })

  test('displays flags correctly in help', () => {
    // When
    const flags = Login.flags

    // Then
    expect(flags.alias).toBeDefined()
    expect(flags.alias.description).toBe('Alias of the session you want to login to.')
    expect(flags.alias.env).toBe('SHOPIFY_FLAG_AUTH_ALIAS')
    expect(flags.resume).toBeDefined()
    expect(flags.resume.description).toBe('Resume a pending non-interactive login flow.')
    expect(flags.resume.env).toBe('SHOPIFY_FLAG_AUTH_RESUME')
    expect(flags.new).toBeDefined()
    expect(flags.new.description).toBe('Log in with a new account instead of choosing from existing sessions.')
    expect(flags.new.env).toBe('SHOPIFY_FLAG_AUTH_NEW')
  })
})
