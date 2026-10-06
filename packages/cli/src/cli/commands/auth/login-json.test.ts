import Login from './login.js'
import {authLoginJsonOutputSchema} from '../../services/commands/auth/login/types.js'
import {promptSessionSelectWithDetails} from '@shopify/cli-kit/node/session-prompt'
import * as system from '@shopify/cli-kit/node/system'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo, outputCompleted, unstyled} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {beforeEach, afterEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session-prompt')

beforeEach(() => {
  vi.stubEnv('CI', '1')
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
  vi.mocked(promptSessionSelectWithDetails).mockResolvedValue({userId: 'user-123', alias: 'Work account', email: null})
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

test.each(['--json', '-j'])('writes the selected alias through the real launcher with %s', async (flag) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: import.meta.url,
      argv: ['auth', 'login', '--alias', 'Work account', flag],
      lazyCommandLoader: async () => Login,
    })

    expect(promptSessionSelectWithDetails).toHaveBeenCalledExactlyOnceWith('Work account')
    expect(stdout()).toBe(
      `${JSON.stringify({status: 'success', userId: 'user-123', alias: 'Work account', email: null}, null, 2)}\n`,
    )
    expect(stderr()).toBe('')
  })
})

test('uses the selected alias rather than the requested one', async () => {
  vi.mocked(promptSessionSelectWithDetails).mockResolvedValue({userId: 'user-123', alias: 'Other account', email: null})

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(['--alias', 'Missing account', '--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({status: 'success', userId: 'user-123', alias: 'Other account', email: null})
    expect(stderr()).toBe('')
  })
})

test('outputs the selected user ID and verified email without inferring either from the alias', async () => {
  vi.mocked(promptSessionSelectWithDetails).mockResolvedValue({
    userId: 'selected-user',
    alias: 'nickname@example.com',
    email: 'verified@example.com',
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(['--alias', 'nickname@example.com', '--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      userId: 'selected-user',
      alias: 'nickname@example.com',
      email: 'verified@example.com',
    })
    expect(stderr()).toBe('')
  })
})

test('supports JSON and alias environment flags', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.stubEnv('SHOPIFY_FLAG_AUTH_ALIAS', 'Work account')

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run([], import.meta.url)

    expect(promptSessionSelectWithDetails).toHaveBeenCalledExactlyOnceWith('Work account')
    expect(JSON.parse(stdout())).toEqual({status: 'success', userId: 'user-123', alias: 'Work account', email: null})
    expect(stderr()).toBe('')
  })
})

test.each([false, true])('allows interactive session selection independently of JSON: %s', async (json) => {
  vi.spyOn(system, 'terminalSupportsPrompting').mockReturnValue(true)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(json ? ['--json'] : [], import.meta.url)

    expect(promptSessionSelectWithDetails).toHaveBeenCalledExactlyOnceWith(undefined)
    if (json) {
      expect(JSON.parse(stdout())).toEqual({status: 'success', userId: 'user-123', alias: 'Work account', email: null})
      expect(stderr()).toBe('')
    } else {
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toBe('✔ Current account: Work account.\n')
    }
  })
})

test.each([false, true])('supports no-input with an explicit alias independently of JSON: %s', async (json) => {
  vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(['--alias', 'Work account', '--no-input', ...(json ? ['--json'] : [])], import.meta.url)

    expect(promptSessionSelectWithDetails).toHaveBeenCalledExactlyOnceWith('Work account')
    if (json) {
      expect(JSON.parse(stdout())).toEqual({status: 'success', userId: 'user-123', alias: 'Work account', email: null})
      expect(stderr()).toBe('')
    } else {
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toBe('✔ Current account: Work account.\n')
    }
  })
})

test.each([false, true])('requires an alias before authentication when input is disabled, JSON: %s', async (json) => {
  vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
  if (json) vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(['--no-input', ...(json ? ['--json'] : [])], import.meta.url)

    expect(promptSessionSelectWithDetails).not.toHaveBeenCalled()
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
    if (json) {
      expect(JSON.parse(stdout()).error).toMatchObject({type: 'abort', message: expect.stringContaining('--alias')})
      expect(stderr()).toBe('')
    } else {
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toContain('--alias')
    }
  })
})

test('exposes the result schema and keeps the alias requirement in help', () => {
  expect(Login.jsonOutputSchema).toBe(authLoginJsonOutputSchema)
  expect(Login.description).toContain('Output from `--json` conforms to the `AuthLoginResult` schema.')
  expect(Login.flags.alias).toMatchObject({requiredIfNonInteractive: true})
})

test('discovers the schema without requiring an alias or starting authentication', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: import.meta.url,
      argv: ['auth', 'login', '--json-schema'],
      lazyCommandLoader: async () => Login,
    })

    expect(JSON.parse(stdout()).definitions.Result).toMatchObject({
      type: 'object',
      properties: {
        status: {type: 'string', const: 'success'},
        userId: {type: 'string'},
        alias: {type: 'string'},
        email: {anyOf: [{type: 'string', minLength: 1}, {type: 'null'}]},
      },
      required: ['status', 'userId', 'alias', 'email'],
      additionalProperties: false,
    })
    expect(promptSessionSelectWithDetails).not.toHaveBeenCalled()
    expect(stderr()).toBe('')
  })
})

test('keeps authentication guidance and completion events on stderr', async () => {
  vi.mocked(promptSessionSelectWithDetails).mockImplementation(async () => {
    outputInfo('To run this command, log in to Shopify.')
    outputCompleted('Logged in.')
    return {userId: 'user-123', alias: 'Work account', email: null}
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(['--alias', 'Work account', '--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({status: 'success', userId: 'user-123', alias: 'Work account', email: null})
    const events = stderr()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(events).toEqual([
      expect.objectContaining({type: 'diagnostic', level: 'info', message: 'To run this command, log in to Shopify.'}),
      expect.objectContaining({type: 'diagnostic', level: 'info', message: 'Logged in.'}),
    ])
  })
})

test('writes only the fatal error after authentication fails', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  vi.mocked(promptSessionSelectWithDetails).mockRejectedValue(new AbortError('Authentication failed.'))

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(['--alias', 'Work account', '--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Authentication failed.'}})
    expect(stderr()).toBe('')
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  })
})

test.each([
  {status: 'failed', userId: 'user-123', alias: 'Work account', email: null},
  {status: 'success', userId: 123, alias: 'Work account', email: null},
  {status: 'success', userId: 'user-123', alias: 1, email: null},
  {status: 'success', userId: 'user-123', alias: 'Work account', email: 1},
  {status: 'success', userId: 'user-123', alias: 'Work account', email: ''},
  {status: 'success', userId: 'user-123', alias: 'Work account'},
  {status: 'success', userId: 'user-123', alias: 'Work account', email: null, accessToken: 'secret'},
])('rejects an invalid account result %j', (value) => {
  expect(() => Login.jsonOutputSchema.validate(value)).toThrow()
})

test('outputs only public account details from the selected session', async () => {
  const account = {
    userId: 'user-123',
    alias: 'Work account',
    email: 'verified@example.com',
    accessToken: 'private-access-token',
    refreshToken: 'private-refresh-token',
  }
  vi.mocked(promptSessionSelectWithDetails).mockResolvedValue(account)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(['--alias', 'Work account', '--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      userId: 'user-123',
      alias: 'Work account',
      email: 'verified@example.com',
    })
    expect(stdout()).not.toContain('private-')
    expect(stderr()).toBe('')
  })
})
