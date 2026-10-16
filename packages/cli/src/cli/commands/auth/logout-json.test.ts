import Logout from './logout.js'
import {logout} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')

describeJsonCommand({
  command: Logout,
  commandId: 'auth:logout',
  moduleURL: import.meta.url,
  args: [],
  expectedResult: {status: 'success'},
  expectedSchema: {
    type: 'object',
    properties: {status: {type: 'string', const: 'success'}},
    required: ['status'],
    additionalProperties: false,
  },
  setup: () => {
    vi.mocked(logout).mockResolvedValue(undefined)
  },
  assertExecuted: () => {
    expect(logout).toHaveBeenCalledExactlyOnceWith()
  },
  assertNotExecuted: () => {
    expect(logout).not.toHaveBeenCalled()
  },
  textOutput: {stdout: '', stderr: '✅ Success! Logged out from all the accounts.\n'},
  diagnostics: {
    setup: () => {
      vi.mocked(logout).mockImplementation(async () => {
        outputInfo('Session cleanup diagnostic')
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Session cleanup diagnostic'}],
  },
  failure: {
    setup: () => {
      vi.mocked(logout).mockRejectedValue(new AbortError('Cannot clear sessions.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot clear sessions.'}},
    exitCode: 1,
  },
})

test.each([{}, {status: 'failed'}, {status: true}, {status: null}, {status: 'success', accessToken: 'secret'}])(
  'rejects an invalid result %j',
  (value) => {
    expect(() => Logout.jsonOutputSchema.validate(value)).toThrow()
  },
)
