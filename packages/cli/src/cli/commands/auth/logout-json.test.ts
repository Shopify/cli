import Logout from './logout.js'
import {logout} from '@shopify/cli-kit/node/session'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {beforeEach, afterEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')

beforeEach(() => {
  vi.stubEnv('CI', '1')
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

test.each(['--json', '-j'])('writes one completed result through the launcher with %s', async (flag) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: import.meta.url,
      argv: ['auth', 'logout', flag],
      lazyCommandLoader: async () => Logout,
    })

    expect(logout).toHaveBeenCalledExactlyOnceWith()
    expect(stdout()).toBe(`${JSON.stringify({status: 'success'}, null, 2)}\n`)
    expect(stderr()).toBe('')
  })
})

test('supports the JSON environment flag', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Logout.run([], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({status: 'success'})
    expect(stderr()).toBe('')
  })
})

test.each([false, true])('keeps no-input independent from JSON output: %s', async (json) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Logout.run(['--no-input', ...(json ? ['--json'] : [])], import.meta.url)

    if (json) {
      expect(JSON.parse(stdout())).toEqual({status: 'success'})
      expect(stderr()).toBe('')
    } else {
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toBe('✅ Success! Logged out from all the accounts.\n')
    }
  })
})

test('exposes the schema in help', () => {
  expect(Logout.description).toContain('Output from `--json` conforms to the `AuthLogoutResult` schema.')
})

test.each([{}, {status: 'failed'}, {status: true}, {status: null}, {status: 'success', accessToken: 'secret'}])(
  'rejects an invalid result %j',
  (value) => {
    expect(() => Logout.jsonOutputSchema.validate(value)).toThrow()
  },
)

test('discovers the schema without logging out', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: import.meta.url,
      argv: ['auth', 'logout', '--json-schema'],
      lazyCommandLoader: async () => Logout,
    })

    expect(JSON.parse(stdout()).definitions.Result).toMatchObject({
      type: 'object',
      properties: {status: {type: 'string', const: 'success'}},
      required: ['status'],
      additionalProperties: false,
    })
    expect(logout).not.toHaveBeenCalled()
    expect(stderr()).toBe('')
  })
})

test('writes diagnostics to stderr separately from the result', async () => {
  vi.mocked(logout).mockImplementation(async () => {
    outputInfo('Session cleanup diagnostic')
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Logout.run(['--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({status: 'success'})
    expect(JSON.parse(stderr())).toMatchObject({
      type: 'diagnostic',
      level: 'info',
      message: 'Session cleanup diagnostic',
    })
  })
})

test('writes only the fatal error and preserves the failure exit code', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  vi.mocked(logout).mockRejectedValue(new AbortError('Cannot clear sessions.'))

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await Logout.run(['--json'], import.meta.url)

    expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Cannot clear sessions.'}})
    expect(stderr()).toBe('')
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  })
})
