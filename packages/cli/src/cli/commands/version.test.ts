import Version from './version.js'
import * as versionServices from '../services/commands/version/index.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi, type MockInstance} from 'vitest'

let versionService: MockInstance<typeof versionServices.versionService>

describeJsonCommand({
  command: Version,
  commandId: 'version',
  moduleURL: import.meta.url,
  args: [],
  expectedResult: {version: CLI_KIT_VERSION},
  expectedSchema: {
    type: 'object',
    properties: {version: {type: 'string'}},
    required: ['version'],
    additionalProperties: false,
  },
  setup: () => {
    versionService = vi.spyOn(versionServices, 'versionService')
    return () => versionService.mockRestore()
  },
  assertExecuted: () => {
    expect(versionService).toHaveBeenCalledExactlyOnceWith()
  },
  assertNotExecuted: () => {
    expect(versionService).not.toHaveBeenCalled()
  },
  textOutput: {stdout: `${CLI_KIT_VERSION}\n`, stderr: ''},
})
