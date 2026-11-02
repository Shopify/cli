import EnvShow from './show.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {OrganizationSource} from '../../../models/organization.js'
import {appEnvShowJsonOutputSchema} from '../../../services/app/env/show/types.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/context.js')

function mockLinkedAppContext({secret, scopes}: {secret: string | undefined; scopes: string}) {
  const app = testAppLinked()
  app.configuration.access_scopes = {scopes}
  const remoteApp = testOrganizationApp({apiSecretKeys: secret === undefined ? [] : [{secret}]})
  vi.mocked(linkedAppContext).mockImplementation(async () => {
    outputInfo('Loaded app')
    return {
      app,
      remoteApp,
      organization: {id: '1', businessName: 'Example', source: OrganizationSource.BusinessPlatform},
    } as Awaited<ReturnType<typeof linkedAppContext>>
  })
  return {app, remoteApp}
}

test.each([
  {secret: 'secret', scopes: 'read_products'},
  {secret: undefined, scopes: ''},
  {secret: '', scopes: ''},
])('writes one JSON result with secret $secret and scopes $scopes', async ({secret, scopes}) => {
  const {remoteApp} = mockLinkedAppContext({secret, scopes})
  const command = new EnvShow(['--json'], await Config.load())
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () => command.run())
    expect(stdout()).toBe(
      `${JSON.stringify(
        {
          variables: [
            {name: 'SHOPIFY_API_KEY', value: remoteApp.apiKey, isSecret: false},
            ...(secret === undefined ? [] : [{name: 'SHOPIFY_API_SECRET', value: secret, isSecret: true}]),
            {name: 'SCOPES', value: scopes, isSecret: false},
          ],
        },
        null,
        2,
      )}\n`,
    )
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Loaded app'})
    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
  })
})

test('keeps the environment text on stdout, with an empty missing secret', async () => {
  mockLinkedAppContext({secret: undefined, scopes: 'read_products'})
  const command = new EnvShow([], await Config.load())
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await command.run()
    expect(unstyled(stdout())).toBe(
      '\n    SHOPIFY_API_KEY=api-key\n    SHOPIFY_API_SECRET=\n    SCOPES=read_products\n  \n',
    )
    expect(stderr()).toContain('Loaded app')
  })
})

test.each([
  {variables: [{name: 'KEY', value: 1}]},
  {variables: [{name: 'KEY', value: null}]},
  {variables: [{name: 'KEY', unknown: true}]},
  {variables: [], unknown: true},
])('rejects malformed data %j', (value) => {
  expect(() => appEnvShowJsonOutputSchema.validate(value)).toThrow()
})

describeJsonCommand({
  command: EnvShow,
  commandId: 'app:env:show',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: {
    variables: [
      {name: 'SHOPIFY_API_KEY', value: 'api-key', isSecret: false},
      {name: 'SHOPIFY_API_SECRET', value: 'api-secret', isSecret: true},
      {name: 'SCOPES', value: 'read_products', isSecret: false},
    ],
  },
  expectedSchema: {type: 'object', required: ['variables'], additionalProperties: false},
  setup: () => {
    mockLinkedAppContext({secret: 'api-secret', scopes: 'read_products'})
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledExactlyOnceWith({
      directory: expect.any(String),
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(unstyled(stdout)).toBe(
      '\n    SHOPIFY_API_KEY=api-key\n    SHOPIFY_API_SECRET=api-secret\n    SCOPES=read_products\n  \n',
    )
    expect(stderr).toBe('Loaded app\n')
  },
  expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Loaded app'}],
  failure: {
    setup: () => {
      vi.mocked(linkedAppContext).mockRejectedValue(new AbortError('Authentication failed'))
    },
    expectedError: {error: {type: 'abort', message: 'Authentication failed'}},
    exitCode: 1,
  },
})
