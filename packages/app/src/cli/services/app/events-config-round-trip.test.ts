import {remoteAppConfigurationExtensionContent} from './select-app.js'
import {overwriteLocalConfigFileWithRemoteAppConfiguration} from './config/link.js'
import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {strictEventsContract} from './events-strict-schema.test-data.js'
import {fetchSpecifications} from '../generate/fetch-extension-specifications.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {
  configurationSpecifications,
  testDeveloperPlatformClient,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {AppModuleVersion, Flag} from '../../utilities/developer-platform-client.js'
import {AppManagementClient} from '../../utilities/developer-platform-client/app-management-client.js'
import {ensureDeployIdentifiersFromAppVersion} from '../context/deploy-identifier-matching.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {writeManifestToBundle} from '../bundle.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'

vi.mock('../local-storage.js')
vi.mock('../../prompts/deploy-release.js')
vi.mock('@shopify/cli-kit/node/api/app-management')
vi.mock('@shopify/cli-kit/node/api/business-platform')

const subscription = {
  topic: 'orders',
  actions: ['create', 'update'],
  triggers: ['title'],
  uri: 'https://example.com/events/orders',
  query: 'query { id }',
  query_filter: 'status:active',
}

function eventsModule(handle: string, value: unknown = subscription, apiVersion = '2026-01'): AppModuleVersion {
  return {
    registrationTitle: handle,
    registrationId: handle,
    registrationUuid: `uuid-${handle}`,
    type: 'events',
    specification: {
      identifier: 'events',
      name: 'Events',
      experience: 'configuration',
      options: {managementExperience: 'cli'},
    },
    config: {events: {api_version: apiVersion, subscription: value}},
  }
}

async function fetchedSpecifications() {
  const remoteSpecs: RemoteSpecification[] = (await configurationSpecifications()).map((spec) => ({
    identifier: spec.identifier,
    externalIdentifier: spec.identifier,
    name: spec.externalName,
    externalName: spec.externalName,
    experience: spec.experience,
    managementExperience: 'cli',
    gated: false,
    registrationLimit: spec.registrationLimit,
    uidStrategy: spec.uidStrategy,
    validationSchema: spec.identifier === 'events' ? {jsonSchema: JSON.stringify(strictEventsContract)} : undefined,
  }))
  return fetchSpecifications({
    developerPlatformClient: testDeveloperPlatformClient({specifications: async () => remoteSpecs}),
    app: testOrganizationApp(),
  })
}

async function loadConfiguration(
  directory: string,
  specifications: ExtensionSpecification[],
  flags: Flag[],
  content: object,
) {
  await writeAppConfigurationFile(
    {
      name: 'Events test',
      client_id: 'api-key',
      application_url: 'https://example.com',
      embedded: true,
      auth: {redirect_urls: ['https://example.com/auth']},
      webhooks: {api_version: '2026-01'},
      ...content,
    },
    joinPath(directory, 'shopify.app.toml'),
  )
  await writeFile(joinPath(directory, 'package.json'), '{}')
  return loadApp({
    directory,
    userProvidedConfigName: 'shopify.app.toml',
    specifications,
    remoteFlags: flags,
    skipPrompts: true,
  })
}

async function loadPulledApp(directory: string, modules: AppModuleVersion[], flags: Flag[]) {
  const specifications = await fetchedSpecifications()
  // Readback deliberately does not need the writer's opt-in.
  return loadConfiguration(
    directory,
    specifications,
    flags,
    remoteAppConfigurationExtensionContent(modules, specifications, []),
  )
}

async function matchUnchangedEvents(app: AppInterface, modules: AppModuleVersion[]) {
  const identifiers = await ensureDeployIdentifiersFromAppVersion({
    app,
    appId: 'api-key',
    appName: app.name,
    release: false,
    envIdentifiers: {},
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient(),
    activeAppVersion: {appModuleVersions: modules},
  })
  expect(deployOrReleaseConfirmationPrompt).toHaveBeenLastCalledWith(
    expect.objectContaining({
      configExtensionIdentifiersBreakdown: expect.objectContaining({
        existingFieldNames: modules.every(({type}) => type === 'events')
          ? ['events']
          : expect.arrayContaining(['events']),
        existingUpdatedFieldNames: [],
        deletedFieldNames: [],
      }),
    }),
  )
  return identifiers
}

beforeEach(() => {
  vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '')
  AppManagementClient.resetInstance()
  vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
})
afterEach(() => vi.unstubAllEnvs())

describe('Events module identity round trip', () => {
  test.each([undefined, '', 'bad/handle', 12, 'a'.repeat(51)])(
    'rejects invalid local fanout identity %j before deriving a static UID',
    async (handle) => {
      await inTemporaryDirectory(async (directory) => {
        await expect(
          loadConfiguration(directory, await configurationSpecifications(), [Flag.SingleSubscriptionEventsModules], {
            events: {api_version: '2026-01', subscription: [{...subscription, handle}]},
          }),
        ).rejects.toThrow('Events subscription identity requires a handle')
      })
    },
  )

  test.each(['Same', 'sAME'])(
    'retains then rejects local duplicate %s rather than silently collapsing it',
    async (handle) => {
      await inTemporaryDirectory(async (directory) => {
        const app = await loadConfiguration(
          directory,
          await fetchedSpecifications(),
          [Flag.SingleSubscriptionEventsModules],
          {
            events: {
              api_version: '2026-01',
              subscription: ['Same', handle].map((value) => ({...subscription, handle: value})),
            },
          },
        )
        expect(app.allExtensions.filter((extension) => extension.type === 'events')).toHaveLength(2)
        expect(app.errors.isEmpty()).toBe(handle !== 'Same')
        await expect(matchUnchangedEvents(app, [])).rejects.toThrow(`Duplicate Events subscription handle: ${handle}`)
      })
    },
  )

  test('pulls handleless objects through TOML and the loader to deployConfig, bundleConfig and the modern manifest wire', async () => {
    await inTemporaryDirectory(async (directory) => {
      const remoteModules = [
        eventsModule('Orders_UPDATED'),
        eventsModule('events', {...subscription, handle: 'historical-nested', identifier: 'server-owned'}),
      ]
      const app = await loadPulledApp(directory, remoteModules, [Flag.SingleSubscriptionEventsModules])
      expect(app.errors.isEmpty()).toBe(true)
      const toml = await readFile(joinPath(directory, 'shopify.app.toml'))
      expect(toml).toContain('[[events.subscription]]')
      expect(toml).toContain('handle = "Orders_UPDATED"')
      expect(toml).toContain('handle = "events"')
      expect(toml).not.toContain('historical-nested')
      expect(toml).not.toContain('server-owned')
      expect(toml).toContain(subscription.uri)

      const identifiers = await matchUnchangedEvents(app, remoteModules)
      expect(identifiers.appModuleUuids).toMatchObject({Orders_UPDATED: 'uuid-Orders_UPDATED', events: 'uuid-events'})
      expect(identifiers.appModuleRegistrationIds).toMatchObject({Orders_UPDATED: 'Orders_UPDATED', events: 'events'})
      const extensions = app.allExtensions.filter((extension) => extension.type === 'events')
      expect(extensions.map(({handle, uid}) => ({handle, uid}))).toEqual([
        {handle: 'Orders_UPDATED', uid: 'Orders_UPDATED'},
        {handle: 'events', uid: 'events'},
      ])
      const expectedConfig = {events: {api_version: '2026-01', subscription: {...subscription, api_version: '2026-01'}}}
      await Promise.all(
        extensions.map(async (extension) => {
          expect(extension.configuration).toMatchObject({handle: extension.handle})
          expect(extension.configuration).not.toHaveProperty('events.subscription.handle')
          await expect(
            extension.deployConfig({apiKey: 'api-key', appConfiguration: app.configuration}),
          ).resolves.toEqual(expectedConfig)
          const bundle = await extension.bundleConfig({
            apiKey: 'api-key',
            appConfiguration: app.configuration,
            appModuleUuids: identifiers.appModuleUuids,
            developerPlatformClient: testDeveloperPlatformClient(),
          })
          expect(bundle).toMatchObject({handle: extension.handle, uid: extension.uid, uuid: `uuid-${extension.handle}`})
          expect(JSON.parse(bundle?.config ?? '{}')).toEqual(expectedConfig)
        }),
      )
      const manifest = await app.manifest(identifiers.appModuleUuids)
      expect(manifest.modules.filter(({type}) => type === 'events')).toEqual(
        extensions.map((extension) => ({
          type: 'events',
          handle: extension.handle,
          uid: extension.uid,
          uuid: `uuid-${extension.handle}`,
          assets: extension.uid,
          target: extension.contextValue,
          config: expectedConfig,
        })),
      )
      await writeManifestToBundle(manifest, directory)
      expect(JSON.parse(await readFile(joinPath(directory, 'manifest.json')))).toEqual(manifest)

      const client = AppManagementClient.getInstance()
      client.token = async () => 'test-token'
      vi.mocked(appManagementRequestDoc).mockResolvedValue({appVersionCreate: {version: null, userErrors: []}})
      const deployOptions = {
        appManifest: manifest,
        apiKey: 'api-key',
        appId: 'gid://shopify/App/123',
        name: app.name,
        organizationId: '123',
        skipPublish: true,
      }
      await client.deploy(deployOptions)
      expect(appManagementRequestDoc).toHaveBeenLastCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({version: {source: manifest}}),
        }),
      )
      await client.deploy({...deployOptions, bundleUrl: 'https://storage.example.com/bundle.zip'})
      expect(appManagementRequestDoc).toHaveBeenLastCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({version: {sourceUrl: 'https://storage.example.com/bundle.zip'}}),
        }),
      )
    })
  })

  test.each([false, true])(
    'mixed lists and objects preserve effective versions and produce no Events diff (reverse=%s)',
    async (reverse) => {
      await inTemporaryDirectory(async (directory) => {
        const modules = [
          eventsModule('Object', subscription, '2026-07'),
          eventsModule('legacy', [
            {...subscription, handle: 'ListDefault'},
            {...subscription, handle: 'ListOverride', api_version: '2026-10'},
          ]),
          eventsModule('Override', {...subscription, api_version: '2025-10'}, '2026-04'),
        ]
        const app = await loadPulledApp(directory, reverse ? [...modules].reverse() : modules, [
          Flag.SingleSubscriptionEventsModules,
        ])
        expect(app.errors.isEmpty()).toBe(true)
        const manifest = await app.manifest(undefined)
        expect(manifest.modules.filter(({type}) => type === 'events')).toHaveLength(4)
        for (const [handle, version] of Object.entries({
          Object: '2026-07',
          ListDefault: '2026-01',
          ListOverride: '2026-10',
          Override: '2025-10',
        })) {
          expect(manifest.modules.find((module) => module.handle === handle)?.config).toEqual({
            events: {api_version: '2026-01', subscription: {...subscription, api_version: version}},
          })
        }
        await matchUnchangedEvents(app, [...modules].reverse())
      })
    },
  )

  test.each(['remote-enabled', 'disabled', 'lookup-failed', 'env-after-lookup-failed'])(
    'retains writer rollout behavior: %s',
    async (mode) => {
      await inTemporaryDirectory(async (directory) => {
        const client = AppManagementClient.getInstance()
        client.token = async () => 'test-token'
        client.businessPlatformToken = async () => 'test-token'
        vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
          app: {
            id: 'gid://shopify/App/123',
            key: 'api-key',
            organizationId: 'gid://shopify/Organization/123',
            activeRoot: {grantedShopifyApprovalScopes: [], clientCredentials: {secrets: [{key: 'secret'}]}},
            activeRelease: {id: 'gid://shopify/Release/1', version: {name: 'app-name', appModules: []}},
          },
        })
        if (mode.includes('lookup-failed')) {
          vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValueOnce(new Error('offline flag lookup'))
        } else {
          vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
            organization: {id: 'gid://organization/Organization/123', enabledFlags: [mode === 'remote-enabled']},
          })
        }
        const remote = await client.appFromIdentifiers('api-key')
        expect(remote?.flags).toEqual(mode === 'remote-enabled' ? [Flag.SingleSubscriptionEventsModules] : [])
        if (mode === 'env-after-lookup-failed') vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '1')
        const modules = [eventsModule('One'), eventsModule('Two')]
        const app = await loadPulledApp(directory, modules, remote?.flags ?? [])
        const manifest = await app.manifest(undefined)
        const events = manifest.modules.filter(({type}) => type === 'events')
        const fanout = mode === 'remote-enabled' || mode === 'env-after-lookup-failed'
        expect(events).toHaveLength(fanout ? 2 : 1)
        if (fanout) {
          expect(events.map(({handle}) => handle)).toEqual(['One', 'Two'])
          expect(events.every(({config}) => !JSON.stringify(config).includes('"handle"'))).toBe(true)
        } else {
          expect(events[0]).toMatchObject({
            handle: 'events',
            uid: 'events',
            config: {
              events: {
                subscription: [
                  {...subscription, handle: 'One', api_version: '2026-01'},
                  {...subscription, handle: 'Two', api_version: '2026-01'},
                ],
              },
            },
          })
        }
        await matchUnchangedEvents(app, modules)
      })
    },
  )

  test.each([
    {flags: [], keepEarlier: false},
    {flags: [], keepEarlier: true},
    {flags: [Flag.SingleSubscriptionEventsModules], keepEarlier: false},
    {flags: [Flag.SingleSubscriptionEventsModules], keepEarlier: true},
  ])(
    'pulls explicit empty lists into existing TOML without erasing earlier modules: %j',
    async ({flags, keepEarlier}) => {
      await inTemporaryDirectory(async (directory) => {
        const specifications = await fetchedSpecifications()
        const app = await loadConfiguration(directory, specifications, flags, {
          events: {api_version: '2026-01', subscription: [{...subscription, handle: 'Removed'}]},
        })
        const nonEvents: AppModuleVersion[] = await Promise.all(
          app.allExtensions
            .filter((extension) => extension.type !== 'events')
            .map(async (extension) => ({
              registrationId: extension.handle,
              registrationTitle: extension.handle,
              registrationUuid: `uuid-${extension.handle}`,
              type: extension.type,
              config: await extension.deployConfig({apiKey: 'api-key', appConfiguration: app.configuration}),
              specification: {
                identifier: extension.specification.identifier,
                name: extension.type,
                experience: 'configuration',
                options: {managementExperience: 'cli'},
              },
            })),
        )
        const remoteApp = testOrganizationApp({apiKey: 'api-key'})
        const modules = [...nonEvents, ...(keepEarlier ? [eventsModule('Kept')] : []), eventsModule('events', [])]
        await overwriteLocalConfigFileWithRemoteAppConfiguration({
          remoteApp,
          specifications,
          flags,
          configFileName: 'shopify.app.toml',
          appDirectory: directory,
          developerPlatformClient: testDeveloperPlatformClient({
            activeAppVersion: async () => ({appModuleVersions: modules}),
          }),
          localAppOptions: {
            state: 'reusable-current-app',
            scopes: '',
            localAppIdMatchedRemote: true,
            existingBuildOptions: undefined,
            existingConfig: app.configuration,
            appDirectory: directory,
            packageManager: 'npm',
          },
        })
        const loaded = await loadApp({
          directory,
          userProvidedConfigName: 'shopify.app.toml',
          specifications,
          remoteFlags: flags,
          skipPrompts: true,
        })
        expect(loaded.errors.isEmpty()).toBe(true)
        expect(getPathValue(loaded.configuration, 'events.subscription')).toEqual(
          keepEarlier ? [{...subscription, handle: 'Kept', api_version: '2026-01'}] : [],
        )
        await expect(readFile(joinPath(directory, 'shopify.app.toml'))).resolves.not.toContain('Removed')
        const manifest = await loaded.manifest({})
        if (!keepEarlier) {
          expect(manifest.modules.filter(({type}) => type === 'events')).toMatchObject([
            {handle: 'events', uid: 'events', config: {events: {api_version: '2026-01', subscription: []}}},
          ])
        }
        await writeManifestToBundle(manifest, directory)
        expect(JSON.parse(await readFile(joinPath(directory, 'manifest.json')))).toEqual(
          JSON.parse(JSON.stringify(manifest)),
        )
        await matchUnchangedEvents(loaded, modules)
        expect(deployOrReleaseConfirmationPrompt).toHaveBeenLastCalledWith(
          expect.objectContaining({
            configExtensionIdentifiersBreakdown: expect.objectContaining({newFieldNames: []}),
          }),
        )
      })
    },
  )

  test.each([
    {list: false, flags: []},
    {list: false, flags: [Flag.SingleSubscriptionEventsModules]},
    {list: true, flags: []},
    {list: true, flags: [Flag.SingleSubscriptionEventsModules]},
  ])('loads editing TOML through strict fetched schemas and repeated parsing: %j', async ({list, flags}) => {
    await inTemporaryDirectory(async (directory) => {
      const specifications = await fetchedSpecifications()
      const specification = specifications.find((spec) => spec.identifier === 'events')!
      const editing = {...subscription, handle: 'Exact_CASE', uri: '/events'}
      const input = {events: {api_version: '2026-01', subscription: list ? [editing] : editing}}
      const before = structuredClone(input)
      const parsed = specification.parseConfigurationObject(input)
      expect(parsed.state).toBe('ok')
      if (parsed.state !== 'ok') throw new Error('Expected valid Events config')
      expect(specification.parseConfigurationObject(parsed.data)).toEqual(parsed)
      expect(input).toEqual(before)
      const app = await loadConfiguration(directory, specifications, flags, input)
      expect(app.errors.isEmpty()).toBe(true)
      expect(getPathValue(app.configuration, 'events')).toEqual(input.events)
      const manifest = await app.manifest(undefined)
      const events = manifest.modules.filter(({type}) => type === 'events')
      const emitsList = list && flags.length === 0
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        handle: emitsList ? 'events' : 'Exact_CASE',
        uid: emitsList ? 'events' : 'Exact_CASE',
      })
      const config = events[0]!.config
      expect(config).not.toHaveProperty('handle')
      expect(config).not.toHaveProperty('events.subscription.handle')
      expect(config).toHaveProperty(
        emitsList ? 'events.subscription.0.handle' : 'events.subscription.topic',
        emitsList ? 'Exact_CASE' : 'orders',
      )
      expect(config).toHaveProperty(
        emitsList ? 'events.subscription.0.uri' : 'events.subscription.uri',
        'https://example.com/events',
      )
      expect(jsonSchemaValidate(config, strictEventsContract, 'fail').state).toBe('ok')
    })
  })

  test.each([{unexpected: true}, {topic: 'not-a-topic'}, {actions: []}, {uri: 123}])(
    'fetched parser still rejects invalid object fields: %j',
    async (invalid) => {
      const specification = (await fetchedSpecifications()).find((spec) => spec.identifier === 'events')!
      const input = {events: {api_version: '2026-01', subscription: {...subscription, handle: 'Exact_CASE'}}}
      expect(
        specification.parseConfigurationObject({
          events: {...input.events, subscription: {...input.events.subscription, ...invalid}},
        }).state,
      ).toBe('error')
      const parsed = specification.parseConfigurationObject(input)
      if (parsed.state !== 'ok') throw new Error('Expected valid Events config')
      expect(
        specification.parseConfigurationObject({
          ...parsed.data,
          events: {...input.events, subscription: {...subscription, ...invalid}},
        }).state,
      ).toBe('error')
    },
  )
})
