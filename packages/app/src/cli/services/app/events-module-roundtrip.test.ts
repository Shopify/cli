import {remoteAppConfigurationExtensionContent} from './select-app.js'
import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {overwriteLocalConfigFileWithRemoteAppConfiguration} from './config/link.js'
import {strictEventsContract} from './events-strict-schema.test-data.js'
import {fetchSpecifications} from '../generate/fetch-extension-specifications.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
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
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'
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

async function fetchedSpecifications() {
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
  return fetchSpecifications({
    developerPlatformClient: testDeveloperPlatformClient({specifications: async () => remoteSpecs}),
    app: testOrganizationApp(),
  })
}

async function loadEventsApp(directory: string, eventsConfig: object, remoteFlags: Flag[] = ENABLED) {
  await writeAppConfigurationFile({...BASE, ...eventsConfig}, joinPath(directory, 'shopify.app.toml'))
  await writeFile(joinPath(directory, 'package.json'), JSON.stringify({name: 'events-test', private: true}))
  return loadApp({
    directory,
    userProvidedConfigName: undefined,
    specifications: await fetchedSpecifications(),
    remoteFlags,
    skipPrompts: true,
  })
}

async function remoteAppModules(app: AppInterface): Promise<AppModuleVersion[]> {
  const manifest = await app.manifest(undefined)
  return manifest.modules.map((module) => {
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
        events.forEach((module) =>
          expect(jsonSchemaValidate(module.config, strictEventsContract, 'fail').state).toBe('ok'),
        )
        const readback = events.map(
          (module): AppModuleVersion => ({...remoteModule(module.handle, {}), config: module.config}),
        )
        expect(remoteAppConfigurationExtensionContent(readback, [eventsSpec], [])).toEqual(config)
        if (fanout) expect(events.map((module) => module.handle)).toEqual(['Legacy_A', 'Legacy_B', 'Object'])
        else {
          expect(events[0]).toMatchObject({handle: 'events', uid: 'events'})
          expect(events[0]?.config).toHaveProperty('events.subscription', [
            {...PAYLOAD, handle: 'Legacy_A', api_version: '2026-04'},
            {...PAYLOAD, handle: 'Legacy_B', api_version: '2026-07'},
            {...PAYLOAD, handle: 'Object', uri: 'https://example.com/object'},
          ])
        }
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
        expect(module.config).not.toHaveProperty('handle')
        expect(module.config).not.toHaveProperty('events.subscription.handle')
        expect(jsonSchemaValidate(module.config, strictEventsContract, 'fail').state).toBe('ok')
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
        const remote = (await remoteAppModules(app)).map(
          (module) => remoteEvents.find((event) => event.registrationTitle === module.registrationTitle) ?? module,
        )
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

  test.each([false, true])('pulling an explicit empty list clears existing TOML (fanout=%j)', async (fanout) => {
    const flags = fanout ? ENABLED : []
    vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '')
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    await inTemporaryDirectory(async (directory) => {
      const app = await loadEventsApp(
        directory,
        {events: {api_version: '2026-01', subscription: [{...PAYLOAD, handle: 'Removed'}]}},
        flags,
      )
      expect(app.errors.isEmpty()).toBe(true)
      const modules = (await remoteAppModules(app)).filter((module) => module.type !== 'events')
      modules.push(remoteModule('events', []))
      const activeAppVersion = {appModuleVersions: modules}
      const developerPlatformClient = testDeveloperPlatformClient({activeAppVersion: async () => activeAppVersion})
      const remoteApp = testOrganizationApp({apiKey: BASE.client_id})
      await overwriteLocalConfigFileWithRemoteAppConfiguration({
        remoteApp,
        developerPlatformClient,
        specifications: app.specifications,
        flags,
        configFileName: 'shopify.app.toml',
        appDirectory: directory,
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
        userProvidedConfigName: undefined,
        specifications: app.specifications,
        remoteFlags: flags,
      })
      expect(loaded.errors.isEmpty()).toBe(true)
      expect(loaded.configuration).toHaveProperty('events.subscription', [])
      await expect(readFile(joinPath(directory, 'shopify.app.toml'))).resolves.not.toContain('Removed')
      const manifest = await loaded.manifest({})
      const events = manifest.modules.filter((module) => module.type === eventsSpec.externalIdentifier)
      expect(events).toMatchObject([
        {handle: 'events', uid: 'events', config: {events: {api_version: '2026-01', subscription: []}}},
      ])
      events.forEach((module) =>
        expect(jsonSchemaValidate(module.config, strictEventsContract, 'fail').state).toBe('ok'),
      )
      await writeManifestToBundle(manifest, directory)
      expect(JSON.parse(await readFile(joinPath(directory, 'manifest.json')))).toEqual(
        JSON.parse(JSON.stringify(manifest)),
      )
      await ensureDeployIdentifiersFromAppVersion({
        app: loaded,
        appId: BASE.client_id,
        appName: loaded.name,
        release: false,
        developerPlatformClient,
        remoteApp,
        envIdentifiers: {},
        activeAppVersion,
      })
      expect(deployOrReleaseConfirmationPrompt).toHaveBeenLastCalledWith(
        expect.objectContaining({
          configExtensionIdentifiersBreakdown: expect.objectContaining({
            existingUpdatedFieldNames: [],
            newFieldNames: [],
            deletedFieldNames: [],
          }),
        }),
      )
    })
  })

  test.each([false, true])('fetched parser preserves editing input and repeated validation (list=%j)', async (list) => {
    const specification = (await fetchedSpecifications()).find((spec) => spec.identifier === 'events')
    if (!specification) throw new Error('Missing Events specification')
    const subscription = {...PAYLOAD, handle: 'Exact_CASE', uri: '/events'}
    const input = {events: {api_version: '2026-01', subscription: list ? [subscription] : subscription}}
    const before = structuredClone(input)
    const parsed = specification.parseConfigurationObject(input)
    expect(parsed.state).toBe('ok')
    if (parsed.state !== 'ok') throw new Error('Expected valid Events config')
    expect(specification.parseConfigurationObject(parsed.data)).toEqual(parsed)
    expect(input).toEqual(before)
    if (!list) {
      expect(parsed.data).toHaveProperty('handle', 'Exact_CASE')
      expect(parsed.data).not.toHaveProperty('events.subscription.handle')
    }
    const invalid = {...PAYLOAD, unexpected: true, ...(list ? {handle: 'Exact_CASE'} : {})}
    expect(
      specification.parseConfigurationObject({
        ...parsed.data,
        events: {api_version: '2026-01', subscription: list ? [invalid] : invalid},
      }).state,
    ).toBe('error')
  })

  test.each([{unexpected: true}, {topic: 'not-a-topic'}, {actions: []}, {uri: 123}])(
    'fetched parser still rejects invalid subscription fields: %j',
    async (invalid) => {
      const specification = (await fetchedSpecifications()).find((spec) => spec.identifier === 'events')
      if (!specification) throw new Error('Missing Events specification')
      expect(
        specification.parseConfigurationObject({
          events: {api_version: '2026-01', subscription: {...PAYLOAD, handle: 'Exact_CASE', ...invalid}},
        }).state,
      ).toBe('error')
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
