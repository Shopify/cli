import ConfigLink from './link.js'
import {linkAppConfiguration as link} from '../../../services/app/config/link.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi} from 'vitest'

vi.mock('../../../services/app/config/link.js')
vi.mock('../../../services/app-context.js')

const result = {
  path: '/tmp/project/shopify.app.toml',
  app: {id: '1', gid: null, name: 'my app', clientId: 'api-key', organizationId: '1', organizationGid: null},
}
let app: ReturnType<typeof testAppLinked>

describeJsonCommand({
  command: ConfigLink,
  commandId: 'app:config:link',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: ['--client-id', 'api-key'],
  expectedResult: result,
  expectedSchema: {
    type: 'object',
    required: ['path', 'app'],
    additionalProperties: false,
    properties: {app: {$ref: '#/definitions/LinkedApp'}},
  },
  setup: () => {
    app = testAppLinked()
    vi.mocked(link).mockResolvedValue({
      remoteApp: testOrganizationApp(),
      configFileName: 'shopify.app.toml',
      configuration: app.configuration,
      packageManager: 'npm',
      result,
    })
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
  },
  assertExecuted: () => {
    expect(link).toHaveBeenCalledExactlyOnceWith({
      directory: expect.any(String),
      apiKey: 'api-key',
      organizationId: undefined,
      configName: undefined,
      fileName: undefined,
      force: false,
    })
    expect(linkedAppContext).toHaveBeenCalledExactlyOnceWith({
      directory: expect.any(String),
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: 'shopify.app.toml',
    })
  },
  assertNotExecuted: () => {
    expect(link).not.toHaveBeenCalled()
    expect(linkedAppContext).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain(`is now linked to "${app.configuration.name}" on Shopify`)
    expect(stderr).toContain('Using shopify.app.toml as your default config.')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(link).mockImplementation(async () => {
        outputInfo('Configuration fetched')
        return {
          remoteApp: testOrganizationApp(),
          configFileName: 'shopify.app.toml',
          configuration: app.configuration,
          packageManager: 'npm',
          result,
        }
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Configuration fetched'}],
  },
  failure: {
    setup: () => {
      vi.mocked(linkedAppContext).mockRejectedValue(new AbortError('App loading failed'))
    },
    expectedError: {error: {type: 'abort', message: 'App loading failed'}},
    exitCode: 1,
  },
})
