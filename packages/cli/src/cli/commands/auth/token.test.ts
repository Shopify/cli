import Token from './token.js'
import {authTokenJsonOutputSchema} from '../../services/commands/auth/token.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {
  ensureAuthenticatedAppManagementAndBusinessPlatform,
  setCurrentSessionAlias,
} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Config} from '@oclif/core'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system')

beforeEach(() => {
  vi.stubEnv('SHOPIFY_APP_AUTOMATION_TOKEN', undefined)
  vi.stubEnv('SHOPIFY_CLI_PARTNERS_TOKEN', undefined)
  vi.stubEnv('SHOPIFY_FLAG_API', undefined)
  vi.stubEnv('SHOPIFY_FLAG_JSON', undefined)
  vi.stubEnv('SHOPIFY_CLI_ENV', 'development')
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describe('auth token', () => {
  test.each([true, false])('prints only the API token when interactive is %s', async (interactive) => {
    const output = mockAndCaptureOutput()
    vi.mocked(terminalSupportsPrompting).mockReturnValue(interactive)
    vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValue({
      appManagementToken: 'test-app-management-token',
      businessPlatformToken: 'test-business-platform-token',
      userId: 'test-user-id',
    })

    await Token.run(['--api', 'app-management'])

    expect(output.output()).toBe('test-app-management-token')
    expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledWith({noPrompt: !interactive})
  })

  test('selects the requested account before obtaining its token', async () => {
    const output = mockAndCaptureOutput()
    vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockImplementation(async () => {
      expect(setCurrentSessionAlias).toHaveBeenCalledWith('work')
      return {appManagementToken: 'test-work-token', businessPlatformToken: 'test-bp-token', userId: 'test-work-user'}
    })

    await Token.run(['--api', 'app-management', '--auth-alias', 'work'])

    expect(output.output()).toBe('test-work-token')
  })

  test.each(['SHOPIFY_APP_AUTOMATION_TOKEN', 'SHOPIFY_CLI_PARTNERS_TOKEN'])(
    'rejects %s without printing or exchanging its value',
    async (variable) => {
      const output = mockAndCaptureOutput()
      vi.stubEnv(variable, 'test-automation-secret')

      const command = new Token(['--api', 'app-management'], await Config.load(import.meta.url))

      await expect(command.run()).rejects.toThrow('This prototype requires a signed-in Shopify account.')

      expect(output.info()).toBe('')
      expect(output.output()).not.toContain('test-automation-secret')
      expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
    },
  )

  test.each([{args: []}, {args: ['--api', 'admin']}])(
    'rejects missing or unsupported API arguments: $args',
    async ({args}) => {
      const output = mockAndCaptureOutput()

      const command = new Token(args, await Config.load(import.meta.url))

      await expect(command.run()).rejects.toThrow()

      expect(output.info()).toBe('')
      expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
    },
  )

  test('propagates authentication failures without printing a token', async () => {
    const output = mockAndCaptureOutput()
    vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockRejectedValue(new AbortError('Login required.'))

    const command = new Token(['--api', 'app-management'], await Config.load(import.meta.url))

    await expect(command.run()).rejects.toThrow('Login required.')

    expect(output.info()).toBe('')
  })

  test.each([true, false])('prints just the access token in JSON when interactive is %s', async (interactive) => {
    const output = mockAndCaptureOutput()
    vi.mocked(terminalSupportsPrompting).mockReturnValue(interactive)
    vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValue({
      appManagementToken: 'test-app-management-token',
      businessPlatformToken: 'test-business-platform-token',
      userId: 'test-user-id',
    })

    await Token.run(['--api', 'app-management', '--json'])

    expect(output.info()).toBe(JSON.stringify({accessToken: 'test-app-management-token'}, null, 2))
    expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledWith({noPrompt: !interactive})
  })

  test('keeps authentication diagnostics on stderr and only the token on stdout', async () => {
    vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockImplementation(async () => {
      outputInfo('Refreshing credentials.')
      return {appManagementToken: 'test-app-token', businessPlatformToken: 'test-bp-token', userId: 'test-user'}
    })

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await Token.run(['--api', 'app-management'])

      expect(stdout()).toBe('test-app-token\n')
      expect(stderr()).toContain('Refreshing credentials.')
      expect(stderr()).not.toContain('test-app-token')
    })
  })

  test('documents the JSON result without exposing other session credentials', () => {
    expect(Token.jsonOutputSchema).toBe(authTokenJsonOutputSchema)
    expect(Token.description).toContain('AuthTokenResult')
    expect(Token.description).toContain('not read-only or restricted to one app')
    expect(authTokenJsonOutputSchema.validate({accessToken: 'test-token', refreshToken: 'test-refresh-token'})).toEqual(
      {
        accessToken: 'test-token',
      },
    )
    expect(() => authTokenJsonOutputSchema.validate({accessToken: 123})).toThrow()
  })
})
