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
          SHOPIFY_API_KEY: remoteApp.apiKey,
          ...(secret === undefined ? {} : {SHOPIFY_API_SECRET: secret}),
          SCOPES: scopes,
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

test('exposes the schema and JSON flag', () => {
  expect(EnvShow.jsonOutputSchema).toBe(appEnvShowJsonOutputSchema)
  expect(EnvShow.description).toContain('AppEnvShowResult')
  expect(EnvShow.flags.json).toBeDefined()
})

test('propagates failures before writing any result', async () => {
  vi.mocked(linkedAppContext).mockRejectedValue(new Error('Authentication failed'))
  const command = new EnvShow(['--json'], await Config.load())
  await withCapturedStandardStreams(async ({stdout}) => {
    await expect(command.run()).rejects.toThrow('Authentication failed')
    expect(stdout()).toBe('')
  })
})

test.each([
  {SHOPIFY_API_KEY: 1, SCOPES: ''},
  {SHOPIFY_API_KEY: 'key', SHOPIFY_API_SECRET: null, SCOPES: ''},
  {SHOPIFY_API_KEY: 'key', SCOPES: []},
])('rejects malformed data %j', (value) => {
  expect(() => appEnvShowJsonOutputSchema.validate(value)).toThrow()
})
