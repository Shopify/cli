import AutoupgradeOn from './on.js'
import AutoupgradeOff from './off.js'
import AutoupgradeStatus from './status.js'
import {getAutoUpgradeEnabled, setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {afterEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/upgrade')

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

const commands = [
  {name: 'status', command: AutoupgradeStatus, enabled: false},
  {name: 'on', command: AutoupgradeOn, enabled: true},
  {name: 'off', command: AutoupgradeOff, enabled: false},
]

for (const {name, command, enabled} of commands) {
  describeJsonCommand({
    command,
    commandId: `config:autoupgrade:${name}`,
    moduleURL: import.meta.url,
    args: [],
    expectedResult: {enabled},
    expectedSchema: {
      type: 'object',
      properties: {enabled: {type: 'boolean'}},
      required: ['enabled'],
      additionalProperties: false,
    },
    setup: () => {
      vi.mocked(getAutoUpgradeEnabled).mockReturnValue(enabled)
    },
    assertExecuted: () => {
      if (name === 'status') {
        expect(getAutoUpgradeEnabled).toHaveBeenCalledExactlyOnceWith()
        expect(setAutoUpgradeEnabled).not.toHaveBeenCalled()
      } else {
        expect(setAutoUpgradeEnabled).toHaveBeenCalledExactlyOnceWith(enabled)
        expect(getAutoUpgradeEnabled).not.toHaveBeenCalled()
      }
    },
    assertNotExecuted: () => {
      expect(setAutoUpgradeEnabled).not.toHaveBeenCalled()
      expect(getAutoUpgradeEnabled).not.toHaveBeenCalled()
    },
    textOutput: ({stdout, stderr}) => {
      expect(stdout).toBe('')
      expect(stderr).toContain(enabled ? 'Auto-upgrade on.' : 'Auto-upgrade off.')
    },
    diagnostics:
      name === 'status'
        ? {
            setup: () => {
              vi.mocked(getAutoUpgradeEnabled).mockImplementation(() => {
                outputWarn('Configuration diagnostic')
                return false
              })
            },
            expectedEvents: [{type: 'diagnostic', level: 'warning', message: 'Configuration diagnostic'}],
          }
        : undefined,
    failure: {
      setup: () => {
        const operation = name === 'status' ? getAutoUpgradeEnabled : setAutoUpgradeEnabled
        vi.mocked(operation).mockImplementation(() => {
          throw new AbortError('Cannot access auto-upgrade preference.')
        })
      },
      expectedError: {error: {type: 'abort', message: 'Cannot access auto-upgrade preference.'}},
      exitCode: 1,
    },
  })
}

test.each([false, true])('reports an enabled preference without changing it: JSON %s', async (json) => {
  vi.stubEnv('CI', '1')
  vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await AutoupgradeStatus.run(['--no-input', ...(json ? ['--json'] : [])], import.meta.url)

    if (json) {
      expect(JSON.parse(stdout())).toEqual({enabled: true})
      expect(stderr()).toBe('')
    } else {
      expect(stdout()).toBe('')
      expect(stderr()).toContain('Auto-upgrade on.')
    }
  })
  expect(getAutoUpgradeEnabled).toHaveBeenCalledExactlyOnceWith()
  expect(setAutoUpgradeEnabled).not.toHaveBeenCalled()
})
