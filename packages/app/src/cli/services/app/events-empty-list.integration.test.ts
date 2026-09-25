import {overwriteLocalConfigFileWithRemoteAppConfiguration} from './config/link.js'
import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {DEFAULT_CONFIG, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {loadApp} from '../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {RemoteAwareExtensionSpecification} from '../../models/extensions/specification.js'
import {AppModuleVersion, Flag} from '../../utilities/developer-platform-client.js'
import {ensureDeployIdentifiersFromAppVersion} from '../context/deploy-identifier-matching.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {writeManifestToBundle} from '../bundle.js'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {afterEach, expect, test, vi} from 'vitest'

vi.mock('../local-storage.js')
vi.mock('../../prompts/deploy-release.js')
afterEach(() => vi.unstubAllEnvs())

test.each([{flags: []}, {flags: [Flag.SingleSubscriptionEventsModules]}])(
  'pulling an explicit empty remote list clears existing subscriptions with flags %j',
  async ({flags}) => {
    vi.stubEnv('SHOPIFY_CLI_EVENTS_SUBSCRIPTION_FANOUT', '')
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    await inTemporaryDirectory(async (directory) => {
      const specifications: RemoteAwareExtensionSpecification[] = (await loadLocalExtensionsSpecifications()).map(
        (spec) => ({
          ...spec,
          externalIdentifier: spec.identifier,
          loadedRemoteSpecs: true,
        }),
      )
      const configuration = {
        ...DEFAULT_CONFIG,
        auth: {redirect_urls: ['https://myapp.com/callback']},
        events: {
          api_version: '2026-07',
          subscription: [{handle: 'Removed', topic: 'products', actions: ['update'], uri: 'https://myapp.com/events'}],
        },
      }
      const configPath = joinPath(directory, 'shopify.app.toml')
      await writeFile(joinPath(directory, 'package.json'), '{}')
      await writeAppConfigurationFile(configuration, configPath)
      const app = await loadApp({directory, userProvidedConfigName: undefined, specifications, remoteFlags: flags})
      expect(app.errors.isEmpty()).toBe(true)
      const modules: AppModuleVersion[] = await Promise.all(
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
      modules.push({
        registrationId: 'events',
        registrationTitle: 'events',
        registrationUuid: 'uuid-events',
        type: 'events',
        config: {events: {api_version: '2026-07', subscription: []}},
        specification: {
          identifier: 'events',
          name: 'Events',
          experience: 'configuration',
          options: {managementExperience: 'cli'},
        },
      })
      const activeAppVersion = {appModuleVersions: modules}
      const developerPlatformClient = testDeveloperPlatformClient({activeAppVersion: async () => activeAppVersion})
      const remoteApp = testOrganizationApp({apiKey: 'api-key'})
      await overwriteLocalConfigFileWithRemoteAppConfiguration({
        remoteApp,
        developerPlatformClient,
        specifications,
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
      const loaded = await loadApp({directory, userProvidedConfigName: undefined, specifications, remoteFlags: flags})
      expect(loaded.errors.isEmpty()).toBe(true)
      expect(getPathValue(loaded.configuration, 'events.subscription')).toEqual([])
      await expect(readFile(configPath)).resolves.not.toContain('Removed')
      const manifest = await loaded.manifest({})
      expect(manifest.modules.filter((module) => module.type === 'events')).toMatchObject([
        {handle: 'events', uid: 'events', config: {events: {api_version: '2026-07', subscription: []}}},
      ])
      await writeManifestToBundle(manifest, directory)
      expect(JSON.parse(await readFile(joinPath(directory, 'manifest.json')))).toEqual(
        JSON.parse(JSON.stringify(manifest)),
      )
      await ensureDeployIdentifiersFromAppVersion({
        app: loaded,
        appId: 'api-key',
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
  },
)
