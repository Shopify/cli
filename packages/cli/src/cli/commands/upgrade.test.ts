import Upgrade from './upgrade.js'
import {upgradeCLI} from '@shopify/cli-kit/node/upgrade'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {afterEach, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade')

afterEach(() => mockAndCaptureOutput().clear())

const result = {
  status: 'success',
  changed: true,
  scope: 'global',
  previousVersion: '4.8.0',
  version: '4.9.0',
  packageManager: 'npm',
} as const

describeJsonCommand({
  command: Upgrade,
  commandId: 'upgrade',
  moduleURL: import.meta.url,
  args: [],
  expectedResult: result,
  expectedSchema: {anyOf: [{type: 'object'}, {type: 'object'}, {type: 'object'}]},
  setup: () => {
    vi.mocked(upgradeCLI).mockResolvedValue(result)
  },
  assertExecuted: () => {
    expect(upgradeCLI).toHaveBeenCalledExactlyOnceWith()
  },
  assertNotExecuted: () => {
    expect(upgradeCLI).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Shopify CLI upgraded.')
    expect(stderr).toContain("You're now on version 4.9.0.")
  },
  diagnostics: {
    setup: () => {
      vi.mocked(upgradeCLI).mockImplementation(async () => {
        outputInfo('Upgrade diagnostic')
        return result
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Upgrade diagnostic'}],
  },
  failure: {
    setup: () => {
      vi.mocked(upgradeCLI).mockRejectedValue(new AbortError('Cannot upgrade Shopify CLI.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot upgrade Shopify CLI.'}},
    exitCode: 1,
  },
})

test('calls upgradeCLI directly without prompting', async () => {
  vi.mocked(upgradeCLI).mockResolvedValue({status: 'skipped', reason: 'development', scope: 'global'})

  await Upgrade.run([], import.meta.url)

  expect(upgradeCLI).toHaveBeenCalledOnce()
})
