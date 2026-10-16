import Login from './login.js'
import {authLoginJsonOutputSchema} from '../../services/commands/auth/login/types.js'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
import * as system from '@shopify/cli-kit/node/system'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
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
  vi.mocked(promptSessionSelect).mockResolvedValue('Work account')
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describeJsonCommand({
  command: Login,
  commandId: 'auth:login',
  moduleURL: import.meta.url,
  args: ['--alias', 'Work account'],
  expectedResult: {status: 'success', alias: 'Work account'},
  expectedSchema: {
    type: 'object',
    properties: {status: {type: 'string', const: 'success'}, alias: {type: 'string'}},
    required: ['status', 'alias'],
    additionalProperties: false,
  },
  setup: () => {
    vi.mocked(promptSessionSelect).mockResolvedValue('Work account')
  },
  assertExecuted: () => {
    expect(promptSessionSelect).toHaveBeenCalledExactlyOnceWith('Work account')
  },
  assertNotExecuted: () => {
    expect(promptSessionSelect).not.toHaveBeenCalled()
  },
  textOutput: {stdout: '', stderr: '✔ Current account: Work account.\n'},
  diagnostics: {
    setup: () => {
      vi.mocked(promptSessionSelect).mockImplementation(async () => {
        outputInfo('To run this command, log in to Shopify.')
        outputCompleted('Logged in.')
        return 'Work account'
      })
    },
    expectedEvents: [
      {type: 'diagnostic', level: 'info', message: 'To run this command, log in to Shopify.'},
      {type: 'diagnostic', level: 'info', message: 'Logged in.'},
    ],
  },
  failure: {
    setup: () => {
      vi.mocked(promptSessionSelect).mockRejectedValue(new AbortError('Authentication failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Authentication failed.'}},
    exitCode: 1,
  },
})

test('uses the selected alias rather than the requested one', async () => {
  vi.mocked(promptSessionSelect).mockResolvedValue('Other account')

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(['--alias', 'Missing account', '--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({status: 'success', alias: 'Other account'})
    expect(stderr()).toBe('')
  })
})

test('supports JSON and alias environment flags', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.stubEnv('SHOPIFY_FLAG_AUTH_ALIAS', 'Work account')

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run([], import.meta.url)

    expect(promptSessionSelect).toHaveBeenCalledExactlyOnceWith('Work account')
    expect(JSON.parse(stdout())).toEqual({status: 'success', alias: 'Work account'})
    expect(stderr()).toBe('')
  })
})

test.each([false, true])('allows interactive session selection independently of JSON: %s', async (json) => {
  vi.spyOn(system, 'terminalSupportsPrompting').mockReturnValue(true)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Login.run(json ? ['--json'] : [], import.meta.url)

    expect(promptSessionSelect).toHaveBeenCalledExactlyOnceWith(undefined)
    if (json) {
      expect(JSON.parse(stdout())).toEqual({status: 'success', alias: 'Work account'})
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

    expect(promptSessionSelect).toHaveBeenCalledExactlyOnceWith('Work account')
    if (json) {
      expect(JSON.parse(stdout())).toEqual({status: 'success', alias: 'Work account'})
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

    expect(promptSessionSelect).not.toHaveBeenCalled()
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

test.each([
  {status: 'failed', alias: 'Work account'},
  {status: 'success', alias: 1},
  {status: 'success'},
  {status: 'success', alias: 'Work account', accessToken: 'secret'},
])('rejects an invalid result %j', (value) => {
  expect(() => Login.jsonOutputSchema.validate(value)).toThrow()
})
