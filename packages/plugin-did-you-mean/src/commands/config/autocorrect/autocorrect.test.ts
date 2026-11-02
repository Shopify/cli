import AutocorrectStatus from './status.js'
import AutocorrectOn from './on.js'
import AutocorrectOff from './off.js'
import {isAutocorrectEnabled, setAutocorrect} from '../../../services/conf.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi} from 'vitest'

vi.mock('../../../services/conf.js')

const commands = [
  {name: 'status', command: AutocorrectStatus, enabled: false},
  {name: 'on', command: AutocorrectOn, enabled: true},
  {name: 'off', command: AutocorrectOff, enabled: false},
]

for (const {name, command, enabled} of commands) {
  describeJsonCommand({
    command,
    commandId: `config:autocorrect:${name}`,
    moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
    args: [],
    expectedResult: {enabled},
    expectedSchema: {
      type: 'object',
      properties: {enabled: {type: 'boolean'}},
      required: ['enabled'],
      additionalProperties: false,
    },
    setup: () => {
      vi.mocked(isAutocorrectEnabled).mockReturnValue(enabled)
    },
    assertExecuted: () => {
      if (name === 'status') {
        expect(isAutocorrectEnabled).toHaveBeenCalledExactlyOnceWith()
        expect(setAutocorrect).not.toHaveBeenCalled()
      } else {
        expect(setAutocorrect).toHaveBeenCalledExactlyOnceWith(enabled)
      }
    },
    assertNotExecuted: () => {
      expect(setAutocorrect).not.toHaveBeenCalled()
      expect(isAutocorrectEnabled).not.toHaveBeenCalled()
    },
    textOutput: ({stdout, stderr}) => {
      expect(stdout).toBe('')
      expect(stderr).toContain(enabled ? 'Autocorrect on.' : 'Autocorrect off.')
    },
    diagnostics:
      name === 'status'
        ? {
            setup: () => {
              vi.mocked(isAutocorrectEnabled).mockImplementation(() => {
                outputWarn('Configuration diagnostic')
                return false
              })
            },
            expectedEvents: [{type: 'diagnostic', level: 'warning', message: 'Configuration diagnostic'}],
          }
        : undefined,
    failure: {
      setup: () => {
        const operation = name === 'status' ? isAutocorrectEnabled : setAutocorrect
        vi.mocked(operation).mockImplementation(() => {
          throw new AbortError('Cannot access autocorrect preference.')
        })
      },
      expectedError: {error: {type: 'abort', message: 'Cannot access autocorrect preference.'}},
      exitCode: 1,
    },
  })
}
