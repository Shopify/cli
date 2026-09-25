import {overwriteLocalConfigFileWithRemoteAppConfiguration} from './config/link.js'
import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {remoteAppConfigurationExtensionContent} from './select-app.js'
import {strictEventsContract} from './events-strict-schema.test-data.js'
import {fetchSpecifications} from '../generate/fetch-extension-specifications.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {DEFAULT_CONFIG, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {loadApp} from '../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {
  RemoteAwareExtensionSpecification,
  createConfigExtensionSpecification,
} from '../../models/extensions/specification.js'
import {BaseConfigType, BaseSchemaWithoutHandle} from '../../models/extensions/schemas.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import eventsSpec from '../../models/extensions/specifications/app_config_events.js'
import {AppModuleVersion, Flag} from '../../utilities/developer-platform-client.js'
import {
  ensureDeployIdentifiersFromAppVersion,
  classifyDeployExtensionChanges,
} from '../context/deploy-identifier-matching.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {writeManifestToBundle} from '../bundle.js'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {zod} from '@shopify/cli-kit/node/schema'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('../local-storage.js')
vi.mock('../../prompts/deploy-release.js')

afterEach(() => {
  vi.unstubAllEnvs()
})

const SUBSCRIPTION = {
  topic: 'products',
  actions: ['update'],
  triggers: ['title'],
  uri: 'https://myapp.com/events',
  query: '{ product { id title } }',
  query_filter: 'status:active',
}

function remoteModule(identifier: string, handle: string, config: object): AppModuleVersion {
  return {
    registrationId: handle,
    registrationTitle: handle,
    registrationUuid: `uuid-${handle}`,
    type: identifier,
    config,
    specification: {
      identifier,
      name: identifier,
      experience: 'configuration',
      options: {managementExperience: 'cli'},
    },
  }
}

async function initializeApp(directory: string, flags: Flag[] = []) {
  vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '')
  vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
  const remoteSpecs: RemoteSpecification[] = (await loadLocalExtensionsSpecifications()).map((spec) => ({
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
  await writeFile(joinPath(directory, 'package.json'), '{}')
  await writeAppConfigurationFile(
    {...DEFAULT_CONFIG, auth: {redirect_urls: ['https://myapp.com/callback']}},
    joinPath(directory, 'shopify.app.toml'),
  )
  const app = await loadApp({directory, userProvidedConfigName: undefined, specifications, remoteFlags: flags})
  expect(app.errors.isEmpty()).toBe(true)
  const modules = await Promise.all(
    app.allExtensions.map(async (extension) =>
      remoteModule(
        extension.specification.identifier,
        extension.handle,
        (await extension.deployConfig({apiKey: 'api-key', appConfiguration: app.configuration})) ?? {},
      ),
    ),
  )
  return {app, modules, specifications}
}

async function pullAndLoad(
  app: AppInterface,
  modules: AppModuleVersion[],
  specifications: RemoteAwareExtensionSpecification[],
  flags: Flag[],
) {
  const activeAppVersion = {appModuleVersions: modules}
  const developerPlatformClient = testDeveloperPlatformClient({activeAppVersion: async () => activeAppVersion})
  const remoteApp = testOrganizationApp({apiKey: 'api-key'})
  await overwriteLocalConfigFileWithRemoteAppConfiguration({
    remoteApp,
    developerPlatformClient,
    specifications,
    flags,
    configFileName: 'shopify.app.toml',
    appDirectory: app.directory,
    localAppOptions: {
      state: 'reusable-current-app',
      scopes: '',
      localAppIdMatchedRemote: true,
      existingBuildOptions: undefined,
      existingConfig: app.configuration,
      appDirectory: app.directory,
      packageManager: 'npm',
    },
  })
  const loaded = await loadApp({
    directory: app.directory,
    userProvidedConfigName: undefined,
    specifications,
    remoteFlags: flags,
  })
  expect(loaded.errors.getErrors()).toEqual([])
  const options = {
    app: loaded,
    appId: 'api-key',
    appName: loaded.name,
    release: false,
    developerPlatformClient,
    remoteApp,
    envIdentifiers: {},
    activeAppVersion,
  }
  return {loaded, options, developerPlatformClient}
}

describe('Events pull → TOML → loader → deployment', () => {
  test.each([
    {mixed: false, reversed: false},
    {mixed: false, reversed: true},
    {mixed: true, reversed: false},
    {mixed: true, reversed: true},
  ])('preserves identity, effective versions and no-op comparison: %j', async ({mixed, reversed}) => {
    await inTemporaryDirectory(async (directory) => {
      const flags = [Flag.SingleSubscriptionEventsModules]
      const {app, modules, specifications} = await initializeApp(directory, flags)
      const events = [
        remoteModule('events', 'events', {
          events: {api_version: '2026-04', subscription: {...SUBSCRIPTION, identifier: 'server-one'}},
        }),
        remoteModule('events', 'Exact_Case', {
          events: {
            api_version: '2026-10',
            subscription: {...SUBSCRIPTION, handle: 'stale-nested', identifier: 'server-two'},
          },
        }),
      ]
      if (mixed)
        events.push(
          remoteModule('events', 'Legacy_Module', {
            events: {
              api_version: '2026-07',
              subscription: [
                {...SUBSCRIPTION, handle: 'Legacy_Entry', identifier: 'server-three'},
                {...SUBSCRIPTION, handle: 'Override', api_version: '2026-01', identifier: 'server-four'},
              ],
            },
          }),
        )
      if (reversed) events.reverse()
      const before = structuredClone(events)
      const {loaded, options, developerPlatformClient} = await pullAndLoad(
        app,
        [...modules, ...events],
        specifications,
        flags,
      )
      const identifiers = await ensureDeployIdentifiersFromAppVersion(options)
      expect(deployOrReleaseConfirmationPrompt).toHaveBeenLastCalledWith(
        expect.objectContaining({
          configExtensionIdentifiersBreakdown: expect.objectContaining({
            existingUpdatedFieldNames: [],
            newFieldNames: [],
            deletedFieldNames: [],
            existingFieldNames: expect.arrayContaining(['events']),
          }),
        }),
      )
      expect(identifiers.appModuleUuids).toMatchObject({events: 'uuid-events', Exact_Case: 'uuid-Exact_Case'})
      expect(identifiers.appModuleRegistrationIds).toMatchObject({events: 'events', Exact_Case: 'Exact_Case'})
      const changes = await classifyDeployExtensionChanges({options, activeAppVersion: options.activeAppVersion})
      expect(changes.filter((change) => change.remote?.registrationTitle === 'Exact_Case')).toMatchObject([
        {status: 'unchanged', local: {handle: 'Exact_Case', uid: 'Exact_Case'}},
      ])

      const expectedVersions = mixed
        ? {events: '2026-04', Exact_Case: '2026-10', Legacy_Entry: '2026-07', Override: '2026-01'}
        : {events: '2026-04', Exact_Case: '2026-10'}
      const extensions = loaded.allExtensions.filter((extension) => extension.specification.identifier === 'events')
      expect(extensions).toHaveLength(Object.keys(expectedVersions).length)
      const toml = await readFile(joinPath(directory, 'shopify.app.toml'))
      expect(toml).toContain('[[events.subscription]]')
      expect(toml).toContain('handle = "Exact_Case"')
      expect(toml).toContain('uri = "https://myapp.com/events"')
      expect(toml).not.toContain('server-one')
      expect(toml).not.toContain('stale-nested')
      expect(loaded.configuration).not.toHaveProperty('handle')
      const lastDefault = mixed ? '2026-07' : '2026-10'
      expect(getPathValue(loaded.configuration, 'events.api_version')).toBe(reversed ? '2026-04' : lastDefault)

      // Deploy only attaches historical UUIDs for UUID-strategy modules, not Events' single-strategy modules.
      const manifest = await loaded.manifest({})
      await writeManifestToBundle(manifest, directory)
      expect(JSON.parse(await readFile(joinPath(directory, 'manifest.json')))).toEqual(
        JSON.parse(JSON.stringify(manifest)),
      )
      const eventModules = manifest.modules.filter((module) => module.type === 'events')
      expect(eventModules).toHaveLength(extensions.length)
      for (const module of eventModules) {
        expect(jsonSchemaValidate(module.config, strictEventsContract, 'fail')).toMatchObject({state: 'ok'})
      }
      await Promise.all(
        extensions.map(async (extension) => {
          const beforeConfiguration = structuredClone(extension.configuration)
          const deployConfig = await extension.deployConfig({apiKey: 'api-key', appConfiguration: loaded.configuration})
          if (!deployConfig) throw new Error('Expected Events deploy configuration')
          const subscription = getPathValue(deployConfig, 'events.subscription')
          expect(subscription).toEqual({...SUBSCRIPTION, api_version: getPathValue(expectedVersions, extension.handle)})
          expect(deployConfig).not.toHaveProperty('handle')
          expect(subscription).not.toHaveProperty('handle')
          expect(subscription).not.toHaveProperty('identifier')
          expect(extension.configuration).toMatchObject({handle: extension.handle})
          expect(getPathValue(extension.configuration, 'events.subscription')).not.toHaveProperty('handle')
          const bundle = await extension.bundleConfig({
            apiKey: 'api-key',
            appConfiguration: loaded.configuration,
            appModuleUuids: identifiers.appModuleUuids,
            developerPlatformClient,
          })
          expect(bundle).toMatchObject({
            handle: extension.handle,
            uid: extension.handle,
            uuid: identifiers.appModuleUuids[extension.handle],
          })
          expect(JSON.parse(bundle!.config)).toEqual(deployConfig)
          expect(eventModules.find((module) => module.handle === extension.handle)).toMatchObject({
            uid: extension.handle,
            config: deployConfig,
          })
          expect(extension.configuration).toEqual(beforeConfiguration)
        }),
      )
      expect(events).toEqual(before)
    })
  })

  test.each([{subscription: undefined}, {subscription: null}, {subscription: []}, {subscription: {}}])(
    'empty later modules cannot erase subscriptions through pull and no-op comparison: %j',
    async ({subscription}) => {
      await inTemporaryDirectory(async (directory) => {
        const flags = [Flag.SingleSubscriptionEventsModules]
        const {app, modules, specifications} = await initializeApp(directory, flags)
        const events = [
          remoteModule('events', 'Exact_Case', {events: {api_version: '2026-04', subscription: SUBSCRIPTION}}),
          remoteModule('events', 'empty', {events: {api_version: '2026-10', subscription}}),
        ]
        const {loaded, options} = await pullAndLoad(app, [...modules, ...events], specifications, flags)
        await ensureDeployIdentifiersFromAppVersion(options)
        expect(deployOrReleaseConfirmationPrompt).toHaveBeenLastCalledWith(
          expect.objectContaining({
            configExtensionIdentifiersBreakdown: expect.objectContaining({
              existingUpdatedFieldNames: [],
              newFieldNames: [],
              deletedFieldNames: [],
            }),
          }),
        )
        const manifest = await loaded.manifest({})
        expect(manifest.modules.filter((module) => module.type === 'events')).toMatchObject([
          {
            handle: 'Exact_Case',
            config: {events: {api_version: '2026-10', subscription: {...SUBSCRIPTION, api_version: '2026-04'}}},
          },
        ])
      })
    },
  )

  test.each([
    {objectShape: false, fanout: false},
    {objectShape: false, fanout: true},
    {objectShape: true, fanout: false},
    {objectShape: true, fanout: true},
  ])('loads editing TOML through the fetched contract and resolves URIs: %j', async ({objectShape, fanout}) => {
    await inTemporaryDirectory(async (directory) => {
      const {app, specifications} = await initializeApp(directory)
      const subscription = {...SUBSCRIPTION, handle: 'Local_Case', uri: '/events'}
      const configuration = {
        ...app.configuration,
        events: {api_version: '2026-07', subscription: objectShape ? subscription : [subscription]},
      }
      await writeAppConfigurationFile(configuration, joinPath(directory, 'shopify.app.toml'))
      const loaded = await loadApp({
        directory,
        userProvidedConfigName: undefined,
        specifications,
        remoteFlags: fanout ? [Flag.SingleSubscriptionEventsModules] : [],
      })
      expect(loaded.errors.getErrors()).toEqual([])
      const manifest = await loaded.manifest({})
      const modules = manifest.modules.filter((module) => module.type === 'events')
      expect(modules).toHaveLength(1)
      expect(jsonSchemaValidate(modules[0]!.config, strictEventsContract, 'fail')).toMatchObject({state: 'ok'})
      expect(modules[0]!.config).not.toHaveProperty('handle')
      if (objectShape || fanout) {
        expect(getPathValue(modules[0]!.config, 'events.subscription')).not.toHaveProperty('handle')
      }
      expect(modules[0]).toMatchObject(
        objectShape || fanout
          ? {handle: 'Local_Case', uid: 'Local_Case', config: {events: {subscription: SUBSCRIPTION}}}
          : {
              handle: 'events',
              uid: 'events',
              config: {events: {subscription: [{...SUBSCRIPTION, handle: 'Local_Case'}]}},
            },
      )
      await writeManifestToBundle(manifest, directory)
      expect(JSON.parse(await readFile(joinPath(directory, 'manifest.json')))).toEqual(
        JSON.parse(JSON.stringify(manifest)),
      )
      expect(getPathValue(loaded.configuration, 'events.subscription')).toEqual(
        objectShape ? subscription : [subscription],
      )
    })
  })

  test.each([false, true])(
    'readback works without writer flag; environment override: %s',
    async (environmentOverride) => {
      await inTemporaryDirectory(async (directory) => {
        const {app, modules, specifications} = await initializeApp(directory)
        if (environmentOverride) vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '1')
        const events = [
          remoteModule('events', 'Exact_Case', {events: {api_version: '2026-07', subscription: SUBSCRIPTION}}),
        ]
        const {loaded} = await pullAndLoad(app, [...modules, ...events], specifications, [])
        const manifest = await loaded.manifest({})
        const eventModules = manifest.modules.filter((module) => module.type === 'events')
        expect(eventModules).toHaveLength(1)
        const subscription = {...SUBSCRIPTION, api_version: '2026-07'}
        expect(eventModules[0]).toMatchObject(
          environmentOverride
            ? {handle: 'Exact_Case', uid: 'Exact_Case', config: {events: {subscription}}}
            : {
                handle: 'events',
                uid: 'events',
                config: {events: {subscription: [{...subscription, handle: 'Exact_Case'}]}},
              },
        )
      })
    },
  )

  test.each([{flags: []}, {flags: [Flag.SingleSubscriptionEventsModules]}])(
    'rejects duplicate handles case-insensitively with flags %j',
    async ({flags}) => {
      await inTemporaryDirectory(async (directory) => {
        const {app, modules, specifications} = await initializeApp(directory, flags)
        const events = ['Exact_Case', 'exact_case'].map((handle) =>
          remoteModule('events', handle, {events: {api_version: '2026-07', subscription: SUBSCRIPTION}}),
        )
        expect(
          getPathValue<unknown[]>(
            remoteAppConfigurationExtensionContent(events, specifications, []),
            'events.subscription',
          ),
        ).toHaveLength(2)
        await expect(pullAndLoad(app, [...modules, ...events], specifications, flags)).rejects.toThrow(
          /Duplicated handle.*case-insensitive/,
        )
      })
    },
  )

  test.each([undefined, '', ' bad ', 1])(
    'validates local object identity before ExtensionInstance fallback: %j',
    (handle) => {
      const configuration = {type: 'events', events: {api_version: '2026-07', subscription: {...SUBSCRIPTION, handle}}}
      expect(
        () =>
          new ExtensionInstance({
            configuration,
            configurationPath: '/unused/shopify.app.toml',
            directory: '/unused',
            specification: eventsSpec,
          }),
      ).toThrow(/handle/)
    },
  )

  test('prefers normalized first-class identity when constructing an Events instance directly', () => {
    const extension = new ExtensionInstance({
      configuration: {
        handle: 'Exact_Case',
        events: {api_version: '2026-07', subscription: {...SUBSCRIPTION, handle: 'ignored'}},
      },
      configurationPath: '/unused/shopify.app.toml',
      directory: '/unused',
      specification: eventsSpec,
    })
    expect(extension.handle).toBe('Exact_Case')
    expect(extension.uid).toBe('Exact_Case')
  })

  test.each([false, true])('rejects a missing local handle through real TOML loading (list: %s)', async (list) => {
    await inTemporaryDirectory(async (directory) => {
      const {specifications} = await initializeApp(directory)
      await writeFile(
        joinPath(directory, 'shopify.app.toml'),
        `${await readFile(joinPath(directory, 'shopify.app.toml'))}\n[events]\napi_version = "2026-07"\n${list ? '[[events.subscription]]' : '[events.subscription]'}\ntopic = "products"\nactions = ["update"]\nuri = "/events"\n`,
      )
      await expect(loadApp({directory, userProvidedConfigName: undefined, specifications})).rejects.toThrow(/handle/)
    })
  })

  test('reparses normalized object configurations without mutating the editing copy', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {specifications} = await initializeApp(directory)
      const specification = specifications.find((spec) => spec.identifier === 'events')!
      const editingConfig = {
        events: {api_version: '2026-07', subscription: {...SUBSCRIPTION, handle: 'Exact_Case'}},
      }
      const before = structuredClone(editingConfig)
      const parsed = specification.parseConfigurationObject(editingConfig)
      expect(parsed).toEqual({
        state: 'ok',
        data: {handle: 'Exact_Case', events: {api_version: '2026-07', subscription: SUBSCRIPTION}},
        errors: undefined,
      })
      if (parsed.state !== 'ok') throw new Error('Expected valid Events configuration')
      expect(specification.parseConfigurationObject(parsed.data)).toEqual(parsed)
      expect(editingConfig).toEqual(before)
      const invalid = specification.parseConfigurationObject({
        ...parsed.data,
        events: {api_version: '2026-07', subscription: {...SUBSCRIPTION, unexpected: true}},
      })
      expect(invalid.state).toBe('error')
      expect(JSON.stringify(invalid.errors)).toContain('unexpected')
    })
  })

  test.each([
    {subscription: {...SUBSCRIPTION, unexpected: true}, error: /unexpected/},
    {subscription: {...SUBSCRIPTION, topic: 'not-a-topic'}, error: /topic/},
    {subscription: {...SUBSCRIPTION, actions: []}, error: /actions/},
    {subscription: {...SUBSCRIPTION, uri: 123}, error: /uri/},
  ])('fetched contract still rejects invalid subscription: %j', async ({subscription, error}) => {
    await inTemporaryDirectory(async (directory) => {
      const {app, specifications} = await initializeApp(directory)
      await writeAppConfigurationFile(
        {...app.configuration, events: {api_version: '2026-07', subscription: {...subscription, handle: 'Exact_Case'}}},
        joinPath(directory, 'shopify.app.toml'),
      )
      const loaded = await loadApp({directory, userProvidedConfigName: undefined, specifications})
      expect(loaded.errors.isEmpty()).toBe(false)
      expect(JSON.stringify(loaded.errors.getErrors())).toMatch(error)
      expect(loaded.allExtensions.filter((extension) => extension.specification.identifier === 'events')).toEqual([])
    })
  })

  test.each([undefined, '', ' invalid ', 1])('rejects invalid normalized handle %j', async (handle) => {
    await inTemporaryDirectory(async (directory) => {
      const {specifications} = await initializeApp(directory)
      const specification = specifications.find((spec) => spec.identifier === 'events')!
      const parsed = specification.parseConfigurationObject({
        handle,
        events: {api_version: '2026-07', subscription: SUBSCRIPTION},
      })
      expect(parsed.state).toBe('error')
      expect(JSON.stringify(parsed.errors)).toContain('handle')
    })
  })

  test('supplies identical optional context to a synthetic non-Events spec in both generic callers', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {app, modules, specifications} = await initializeApp(directory)
      const reverse = vi.fn((content: object) => content)
      const custom: RemoteAwareExtensionSpecification = {
        ...createConfigExtensionSpecification<BaseConfigType>({
          identifier: 'synthetic_config',
          schema: BaseSchemaWithoutHandle.extend({synthetic_config: zod.object({value: zod.string()})}),
          transformConfig: {
            forward: (content) => ({synthetic_config: getPathValue(content, 'synthetic_config')}),
            reverse,
          },
        }),
        loadedRemoteSpecs: true,
      }
      const flags = [Flag.SingleSubscriptionEventsModules]
      const remote = remoteModule('synthetic_config', 'synthetic_config', {synthetic_config: {value: 'unchanged'}})
      const {options} = await pullAndLoad(app, [...modules, remote], [...specifications, custom], flags)
      reverse.mockClear()
      await ensureDeployIdentifiersFromAppVersion(options)
      expect(reverse).toHaveBeenCalledTimes(2)
      expect(reverse).toHaveBeenNthCalledWith(1, remote.config, {flags, module: {handle: 'synthetic_config'}})
      expect(reverse).toHaveBeenNthCalledWith(2, remote.config, {flags, module: {handle: 'synthetic_config'}})
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
})
