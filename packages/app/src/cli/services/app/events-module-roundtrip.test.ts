import {remoteAppConfigurationExtensionContent} from './select-app.js'
import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {strictEventsContract} from './events-strict-schema.test-data.js'
import {fetchSpecifications} from '../generate/fetch-extension-specifications.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {loadApp} from '../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import eventsSpec from '../../models/extensions/specifications/app_config_events.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {AppModuleVersion, Flag} from '../../utilities/developer-platform-client.js'
import {AppManagementClient} from '../../utilities/developer-platform-client/app-management-client.js'
import {ensureDeployIdentifiersFromAppVersion} from '../context/deploy-identifier-matching.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {writeManifestToBundle} from '../bundle.js'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/app-management')
vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('../../prompts/deploy-release.js')
vi.mock('../local-storage.js')
vi.mock('@shopify/cli-kit/node/multiple-installation-warning')

const BASE = {
  client_id: 'test-id',
  name: 'Events test',
  application_url: 'https://example.com',
  embedded: true,
  auth: {redirect_urls: ['https://example.com/auth']},
  webhooks: {api_version: '2026-01'},
}
const PAYLOAD = {
  topic: 'products',
  actions: ['update'],
  triggers: ['title'],
  uri: 'https://example.com/events',
  query: 'query { product { id title } }',
  query_filter: 'status:active',
}
const ENABLED = [Flag.SingleSubscriptionEventsModules]

function remoteModule(handle: string, subscription: object, apiVersion = '2026-01'): AppModuleVersion {
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
    config: {events: {api_version: apiVersion, subscription}},
  }
}

async function loadEventsApp(directory: string, eventsConfig: object, remoteFlags: Flag[] = ENABLED) {
  await writeAppConfigurationFile({...BASE, ...eventsConfig}, joinPath(directory, 'shopify.app.toml'))
  await writeFile(joinPath(directory, 'package.json'), JSON.stringify({name: 'events-test', private: true}))
  const remoteSpecs: RemoteSpecification[] = (await loadLocalExtensionsSpecifications()).map((spec) => ({
    identifier: spec.identifier,
    externalIdentifier: spec.externalIdentifier,
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
  return loadApp({
    directory,
    userProvidedConfigName: undefined,
    specifications,
    remoteFlags,
    skipPrompts: true,
  })
}

afterEach(() => vi.unstubAllEnvs())

describe('Events module round trip', () => {
  test('failed flag lookup still loads and emits the historical list shape', async () => {
    vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '')
    AppManagementClient.resetInstance()
    const client = AppManagementClient.getInstance()
    client.token = async () => 'token'
    client.businessPlatformToken = async () => 'business-platform-token'
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
      app: {
        id: 'gid://shopify/App/123',
        key: 'test-id',
        organizationId: 'gid://shopify/Organization/123',
        activeRoot: {grantedShopifyApprovalScopes: [], clientCredentials: {secrets: [{key: 'secret'}]}},
        activeRelease: {id: 'gid://shopify/Release/1', version: {name: BASE.name, appModules: []}},
      },
    })
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValueOnce(new Error('flag lookup failed'))
    const remoteApp = await client.appFromIdentifiers(BASE.client_id)
    expect(remoteApp?.flags).toEqual([])
    await inTemporaryDirectory(async (directory) => {
      const config = remoteAppConfigurationExtensionContent([remoteModule('One', PAYLOAD)], [eventsSpec], [])
      const app = await loadEventsApp(directory, config, remoteApp?.flags)
      expect(app.errors.getErrors()).toEqual([])
      const manifest = await app.manifest(undefined)
      const events = manifest.modules.filter((module) => module.type === eventsSpec.externalIdentifier)
      expect(events).toHaveLength(1)
      expect(events[0]?.handle).toBe('events')
      expect(events[0]?.config).toHaveProperty('events.subscription', [{...PAYLOAD, handle: 'One'}])
    })
  })

  test('missing remote object identity fails rather than using nested identity or UID', () => {
    const module = remoteModule('known-uid', {...PAYLOAD, handle: 'nested-is-not-a-fallback'})
    Reflect.deleteProperty(module, 'registrationTitle')
    expect(() => remoteAppConfigurationExtensionContent([module], [eventsSpec], [])).toThrow(
      'identity must be a handle',
    )
  })

  test.each([false, true])(
    'mixed remote lists/objects preserve every entry through real TOML (fanout=%j)',
    async (fanout) => {
      vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '')
      await inTemporaryDirectory(async (directory) => {
        const modules = [
          remoteModule(
            'ignored-outer',
            [
              {...PAYLOAD, handle: 'Legacy_A'},
              {...PAYLOAD, handle: 'Legacy_B', api_version: '2026-07'},
            ],
            '2026-04',
          ),
          remoteModule('Object', {...PAYLOAD, uri: 'https://example.com/object'}),
        ]
        const config = remoteAppConfigurationExtensionContent(modules, [eventsSpec], [])
        const app = await loadEventsApp(directory, config, fanout ? ENABLED : [])
        expect(app.errors.getErrors()).toEqual([])
        const manifest = await app.manifest(undefined)
        const events = manifest.modules.filter((module) => module.type === eventsSpec.externalIdentifier)
        expect(events).toHaveLength(fanout ? 3 : 1)
        const readback = events.map(
          (module): AppModuleVersion => ({...remoteModule(module.handle, {}), config: module.config}),
        )
        expect(remoteAppConfigurationExtensionContent(readback, [eventsSpec], [])).toEqual(config)
        if (fanout) expect(events.map((module) => module.handle)).toEqual(['Legacy_A', 'Legacy_B', 'Object'])
        else
          expect(events[0]?.config).toHaveProperty('events.subscription', [
            {...PAYLOAD, handle: 'Legacy_A', api_version: '2026-04'},
            {...PAYLOAD, handle: 'Legacy_B', api_version: '2026-07'},
            {...PAYLOAD, handle: 'Object', uri: 'https://example.com/object'},
          ])
      })
    },
  )

  test('handleless remote objects survive real TOML, loader, deployConfig, bundleConfig and manifest.json', async () => {
    vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '')
    await inTemporaryDirectory(async (directory) => {
      const remoteModules = [
        remoteModule('Exact_CASE', {...PAYLOAD, identifier: 'server-owned'}),
        remoteModule('events', {...PAYLOAD, uri: 'https://example.com/other'}, '2026-04'),
      ]
      // Readback must not depend on the current writer rollout flag.
      const config = remoteAppConfigurationExtensionContent(remoteModules, [eventsSpec], [])
      const app = await loadEventsApp(directory, config)
      expect(app.errors.getErrors()).toEqual([])
      const events = app.allExtensions.filter((extension) => extension.type === 'events')
      expect(events.map(({handle, uid}) => ({handle, uid}))).toEqual([
        {handle: 'Exact_CASE', uid: 'Exact_CASE'},
        {handle: 'events', uid: 'events'},
      ])
      await expect(readFile(joinPath(directory, 'shopify.app.toml'))).resolves.toContain('handle = "Exact_CASE"')

      const uuids = Object.fromEntries(
        events.map((extension) => [extension.localIdentifier, `uuid-${extension.handle}`]),
      )
      const configs = await Promise.all(
        events.map((extension) =>
          extension.deployConfig({apiKey: BASE.client_id, appConfiguration: app.configuration}),
        ),
      )
      expect(configs).toEqual([
        {events: {api_version: '2026-01', subscription: PAYLOAD}},
        {
          events: {
            api_version: '2026-01',
            subscription: {...PAYLOAD, uri: 'https://example.com/other', api_version: '2026-04'},
          },
        },
      ])
      const bundles = await Promise.all(
        events.map((extension) =>
          extension.bundleConfig({
            apiKey: BASE.client_id,
            appConfiguration: app.configuration,
            appModuleUuids: uuids,
            developerPlatformClient: testDeveloperPlatformClient(),
          }),
        ),
      )
      bundles.forEach((bundle, index) => {
        expect(bundle).toMatchObject({
          handle: events[index]?.handle,
          uid: events[index]?.uid,
          uuid: `uuid-${events[index]?.handle}`,
        })
        expect(JSON.parse(bundle?.config ?? '{}')).toEqual(configs[index])
        expect(events[index]?.configuration).toHaveProperty('handle', events[index]?.handle)
        expect(events[index]?.configuration).not.toHaveProperty('events.subscription.handle')
      })
      const manifest = await app.manifest(uuids)
      const manifestEvents = manifest.modules.filter((module) => module.type === eventsSpec.externalIdentifier)
      expect(manifestEvents).toHaveLength(2)
      manifestEvents.forEach((module, index) => {
        expect(module).toMatchObject({
          handle: events[index]?.handle,
          uid: events[index]?.uid,
          uuid: `uuid-${events[index]?.handle}`,
          config: configs[index],
        })
        expect(module.config).not.toHaveProperty('events.subscription.handle')
      })
      const bundleDirectory = joinPath(directory, 'bundle')
      await mkdir(bundleDirectory)
      await writeManifestToBundle(manifest, bundleDirectory)
      const written = JSON.parse(await readFile(joinPath(bundleDirectory, 'manifest.json')))
      expect(written).toEqual(JSON.parse(JSON.stringify(manifest)))
      expect(written.modules.filter((module: {type: string}) => module.type === eventsSpec.externalIdentifier)).toEqual(
        manifestEvents,
      )

      const readbackModules = manifestEvents.map(
        (module): AppModuleVersion => ({...remoteModule(module.handle, {}), config: module.config}),
      )
      expect(remoteAppConfigurationExtensionContent(readbackModules, [eventsSpec], [])).toEqual(config)
      await writeAppConfigurationFile({...BASE, ...config}, joinPath(directory, 'shopify.app.toml'))
      const again = await loadApp({
        directory,
        specifications: app.specifications,
        userProvidedConfigName: undefined,
        remoteFlags: ENABLED,
        skipPrompts: true,
      })
      await expect(again.manifest(uuids)).resolves.toEqual(manifest)
    })
  })

  test.each([false, true])(
    'no-op deployment retains remote UUID/UID and normalized Events section (reverse=%j)',
    async (reverse) => {
      vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '')
      vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
      await inTemporaryDirectory(async (directory) => {
        const modules = [
          remoteModule('Exact_CASE', {...PAYLOAD, handle: 'stale-nested', api_version: '2026-04'}, '2026-04'),
          remoteModule('Other', {...PAYLOAD, uri: 'https://example.com/other'}, '2026-01'),
        ]
        const remoteEvents = reverse ? [...modules].reverse() : modules
        const app = await loadEventsApp(
          directory,
          remoteAppConfigurationExtensionContent(remoteEvents, [eventsSpec], []),
        )
        expect(app.errors.getErrors()).toEqual([])
        const manifest = await app.manifest(undefined)
        const remote = manifest.modules.map((module): AppModuleVersion => {
          const event = remoteEvents.find((event) => event.registrationTitle === module.handle)
          if (event) return event
          const specification = app.specifications.find((spec) => spec.externalIdentifier === module.type)
          if (!specification) throw new Error(`Missing specification ${module.type}`)
          return {
            registrationTitle: module.handle,
            registrationId: module.uid,
            registrationUuid: `uuid-${module.uid}`,
            type: specification.identifier,
            config: module.config,
            specification: {
              identifier: specification.identifier,
              name: specification.externalName,
              experience: specification.experience,
              options: {managementExperience: 'cli'},
            },
          }
        })
        const identifiers = await ensureDeployIdentifiersFromAppVersion({
          app,
          appId: BASE.client_id,
          appName: BASE.name,
          release: true,
          envIdentifiers: {},
          activeAppVersion: {appModuleVersions: remote},
          remoteApp: testOrganizationApp(),
          developerPlatformClient: testDeveloperPlatformClient(),
        })
        expect(deployOrReleaseConfirmationPrompt).toHaveBeenLastCalledWith(
          expect.objectContaining({
            configExtensionIdentifiersBreakdown: {
              existingFieldNames: expect.arrayContaining(['events']),
              existingUpdatedFieldNames: [],
              newFieldNames: [],
              deletedFieldNames: [],
            },
          }),
        )
        for (const extension of app.allExtensions.filter((extension) => extension.type === 'events')) {
          expect(identifiers.appModuleUuids[extension.localIdentifier]).toBe(`uuid-${extension.handle}`)
          expect(identifiers.appModuleRegistrationIds[extension.localIdentifier]).toBe(extension.handle)
        }
      })
    },
  )

  test.each([
    {flags: ENABLED, optIn: '', fanout: true},
    {flags: [], optIn: '1', fanout: true},
    {flags: [], optIn: '', fanout: false},
  ])('preserves writer rollout policy (%j)', async ({flags, optIn, fanout}) => {
    vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', optIn)
    await inTemporaryDirectory(async (directory) => {
      const subscriptions = [
        {...PAYLOAD, handle: 'One'},
        {...PAYLOAD, handle: 'Two', uri: '/relative'},
      ]
      const app = await loadEventsApp(directory, {events: {api_version: '2026-01', subscription: subscriptions}}, flags)
      expect(app.errors.getErrors()).toEqual([])
      const manifest = await app.manifest(undefined)
      const events = manifest.modules.filter((module) => module.type === eventsSpec.externalIdentifier)
      expect(events).toHaveLength(fanout ? 2 : 1)
      if (fanout) {
        expect(events.map((module) => module.handle)).toEqual(['One', 'Two'])
        events.forEach((module) => expect(module.config).not.toHaveProperty('events.subscription.handle'))
        expect(events[1]?.config).toHaveProperty('events.subscription.uri', 'https://example.com/relative')
      } else {
        expect(events[0]?.handle).toBe('events')
        expect(events[0]?.config).toEqual({
          events: {
            api_version: '2026-01',
            subscription: [subscriptions[0], {...subscriptions[1], uri: 'https://example.com/relative'}],
          },
        })
      }
    })
  })

  test.each([undefined, '', 'has space', 'x'.repeat(51), 42])(
    'invalid local object handle fails instead of falling back to events (%j)',
    async (handle) => {
      await inTemporaryDirectory(async (directory) => {
        await expect(
          loadEventsApp(directory, {
            events: {api_version: '2026-01', subscription: {...PAYLOAD, ...(handle === undefined ? {} : {handle})}},
          }),
        ).rejects.toThrow('identity must be a handle')
      })
    },
  )

  test('case-variant duplicates survive remote fan-in and local fanout for Core to reject, without case folding', async () => {
    await inTemporaryDirectory(async (directory) => {
      const config = remoteAppConfigurationExtensionContent(
        [remoteModule('Case', PAYLOAD), remoteModule('case', PAYLOAD)],
        [eventsSpec],
        [],
      )
      const app = await loadEventsApp(directory, config)
      const manifest = await app.manifest(undefined)
      expect(
        manifest.modules
          .filter((module) => module.type === eventsSpec.externalIdentifier)
          .map((module) => module.handle),
      ).toEqual(['Case', 'case'])
    })
  })
})
