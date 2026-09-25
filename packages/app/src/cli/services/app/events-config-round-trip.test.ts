import {remoteAppConfigurationExtensionContent} from './select-app.js'
import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {strictEventsContract} from './events-strict-schema.test-data.js'
import {fetchSpecifications} from '../generate/fetch-extension-specifications.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {loadApp} from '../../models/app/loader.js'
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
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'

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

async function loadPulledApp(directory: string, modules: AppModuleVersion[], flags: Flag[]) {
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
  const specifications = await fetchSpecifications({
    developerPlatformClient: testDeveloperPlatformClient({specifications: async () => remoteSpecs}),
    app: testOrganizationApp(),
  })
  // Readback deliberately does not need the writer's opt-in.
  const pulled = remoteAppConfigurationExtensionContent(modules, specifications, [])
  await writeAppConfigurationFile(
    {
      name: 'Events test',
      client_id: 'api-key',
      application_url: 'https://example.com',
      embedded: true,
      auth: {redirect_urls: ['https://example.com/auth']},
      webhooks: {api_version: '2026-01'},
      ...pulled,
    },
    joinPath(directory, 'shopify.app.toml'),
  )
  await writeFile(joinPath(directory, 'package.json'), JSON.stringify({name: 'events-test', version: '1.0.0'}))
  return loadApp({
    directory,
    userProvidedConfigName: 'shopify.app.toml',
    specifications,
    remoteFlags: flags,
    skipPrompts: true,
  })
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
        await loadPulledApp(directory, [], [])
        const configPath = joinPath(directory, 'shopify.app.toml')
        const base = await readFile(configPath)
        await writeFile(
          configPath,
          `${base}\n[events]\napi_version = "2026-01"\n[[events.subscription]]\ntopic = "orders"\nactions = ["create"]\nuri = "/events/orders"\n${handle === undefined ? '' : `handle = ${JSON.stringify(handle)}`}\n`,
        )
        await expect(
          loadApp({
            directory,
            userProvidedConfigName: 'shopify.app.toml',
            specifications: await configurationSpecifications(),
            remoteFlags: [Flag.SingleSubscriptionEventsModules],
            skipPrompts: true,
          }),
        ).rejects.toThrow('Events subscription identity requires a handle')
      })
    },
  )

  test.each(['Same', 'sAME'])(
    'retains then rejects local duplicate %s rather than silently collapsing it',
    async (handle) => {
      await inTemporaryDirectory(async (directory) => {
        await loadPulledApp(directory, [], [])
        const configPath = joinPath(directory, 'shopify.app.toml')
        const base = await readFile(configPath)
        const entries = ['Same', handle]
          .map(
            (value) =>
              `[[events.subscription]]\nhandle = "${value}"\ntopic = "orders"\nactions = ["create"]\nuri = "/events/orders"`,
          )
          .join('\n')
        await writeFile(configPath, `${base}\n[events]\napi_version = "2026-01"\n${entries}\n`)
        const app = await loadApp({
          directory,
          userProvidedConfigName: 'shopify.app.toml',
          specifications: await configurationSpecifications(),
          remoteFlags: [Flag.SingleSubscriptionEventsModules],
          skipPrompts: true,
        })
        expect(app.allExtensions.filter((extension) => extension.type === 'events')).toHaveLength(2)
        expect(app.errors.isEmpty()).toBe(handle !== 'Same')
        await expect(
          ensureDeployIdentifiersFromAppVersion({
            app,
            appId: 'api-key',
            appName: app.name,
            release: false,
            envIdentifiers: {},
            remoteApp: testOrganizationApp(),
            developerPlatformClient: testDeveloperPlatformClient(),
          }),
        ).rejects.toThrow(`Duplicate Events subscription handle: ${handle}`)
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
      expect(toml).toContain('https://example.com/events/orders')

      const developerPlatformClient = testDeveloperPlatformClient()
      const identifiers = await ensureDeployIdentifiersFromAppVersion({
        app,
        appId: 'api-key',
        appName: app.name,
        release: false,
        envIdentifiers: {},
        remoteApp: testOrganizationApp(),
        developerPlatformClient,
        activeAppVersion: {appModuleVersions: remoteModules},
      })
      expect(identifiers.appModuleUuids).toMatchObject({Orders_UPDATED: 'uuid-Orders_UPDATED', events: 'uuid-events'})
      expect(identifiers.appModuleRegistrationIds).toMatchObject({Orders_UPDATED: 'Orders_UPDATED', events: 'events'})
      expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          configExtensionIdentifiersBreakdown: expect.objectContaining({
            existingFieldNames: ['events'],
            existingUpdatedFieldNames: [],
            deletedFieldNames: [],
          }),
        }),
      )

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
            developerPlatformClient,
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
          eventsModule(
            'legacy',
            [
              {...subscription, handle: 'ListDefault'},
              {...subscription, handle: 'ListOverride', api_version: '2026-10'},
            ],
            '2026-01',
          ),
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
        await ensureDeployIdentifiersFromAppVersion({
          app,
          appId: 'api-key',
          appName: app.name,
          release: false,
          envIdentifiers: {},
          remoteApp: testOrganizationApp(),
          developerPlatformClient: testDeveloperPlatformClient(),
          activeAppVersion: {appModuleVersions: [...modules].reverse()},
        })
        expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            configExtensionIdentifiersBreakdown: expect.objectContaining({
              existingFieldNames: ['events'],
              existingUpdatedFieldNames: [],
            }),
          }),
        )
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
        await ensureDeployIdentifiersFromAppVersion({
          app,
          appId: 'api-key',
          appName: app.name,
          release: false,
          envIdentifiers: {},
          remoteApp: testOrganizationApp(),
          developerPlatformClient: testDeveloperPlatformClient(),
          activeAppVersion: {appModuleVersions: modules},
        })
        expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            configExtensionIdentifiersBreakdown: expect.objectContaining({
              existingFieldNames: ['events'],
              existingUpdatedFieldNames: [],
            }),
          }),
        )
      })
    },
  )
})
