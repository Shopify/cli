/* eslint-disable @shopify/prefer-module-scope-constants */
import {classifyDeployExtensionChanges, ensureDeployIdentifiersFromAppVersion} from './deploy-app-version.js'
import {extensionMigrationPrompt} from './prompts.js'
import {AppInterface} from '../../models/app/app.js'
import {
  testApp,
  testAppConfigExtensions,
  testDeveloperPlatformClient,
  testOrganizationApp,
  testSingleWebhookSubscriptionExtension,
  testUIExtension,
} from '../../models/app/app.test-data.js'
import {OrganizationApp} from '../../models/organization.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {BaseConfigType} from '../../models/extensions/schemas.js'
import {createConfigExtensionSpecification} from '../../models/extensions/specification.js'
import {AppModuleVersion, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {migrateExtensionsToUIExtension} from '../dev/migrate-to-ui-extension.js'
import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

vi.mock('../../prompts/deploy-release.js')
vi.mock('./prompts.js')
vi.mock('../dev/migrate-to-ui-extension.js')

const REMOTE_APP: OrganizationApp = testOrganizationApp({
  id: 'app-id',
  apiKey: 'api-key',
  organizationId: 'org-id',
})

let EXTENSION_A: ExtensionInstance
let EXTENSION_B: ExtensionInstance
let EXTENSION_TO_MIGRATE: ExtensionInstance
let CONFIG_EXTENSION: ExtensionInstance
let WEBHOOK_SUBSCRIPTION_EXTENSION: ExtensionInstance
let APP: AppInterface
let REMOTE_EXTENSION_A: AppModuleVersion
let REMOTE_EXTENSION_DELETED: AppModuleVersion
let REMOTE_CONFIG_EXTENSION: AppModuleVersion

beforeAll(async () => {
  EXTENSION_A = await testUIExtension({
    directory: '/extension-a',
    configuration: {
      name: 'Extension A',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
          customer_privacy: false,
        },
        iframe: {
          sources: [],
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'uid-a',
  })

  EXTENSION_B = await testUIExtension({
    directory: '/extension-b',
    configuration: {
      name: 'Extension B',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
          customer_privacy: false,
        },
        iframe: {
          sources: [],
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'uid-b',
  })

  EXTENSION_TO_MIGRATE = await testUIExtension({
    directory: '/extension-to-migrate',
    configuration: {
      name: 'Legacy UI',
      type: 'ui_extension',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
          customer_privacy: false,
        },
        iframe: {
          sources: [],
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'uid-migration',
  })

  CONFIG_EXTENSION = await testAppConfigExtensions()
  WEBHOOK_SUBSCRIPTION_EXTENSION = await testSingleWebhookSubscriptionExtension()

  APP = testApp({
    name: 'my-app',
    directory: '/app',
    configuration: {
      client_id: REMOTE_APP.apiKey,
      name: 'my-app',
      application_url: 'https://example.com',
      embedded: true,
      access_scopes: {
        scopes: 'read_products',
      },
    },
    allExtensions: [EXTENSION_A, EXTENSION_B, CONFIG_EXTENSION],
  })

  REMOTE_EXTENSION_A = {
    registrationId: EXTENSION_A.uid,
    registrationUuid: 'remote-uuid-a',
    registrationTitle: 'Remote Extension A',
    type: 'checkout_post_purchase',
    config: await EXTENSION_A.deployConfig({apiKey: REMOTE_APP.apiKey, appConfiguration: APP.configuration}),
    specification: {
      identifier: 'checkout_post_purchase',
      name: 'Post purchase UI extension',
      experience: 'extension',
      options: {managementExperience: 'cli'},
    },
  }

  REMOTE_EXTENSION_DELETED = {
    registrationId: 'deleted-uid',
    registrationUuid: 'deleted-uuid',
    registrationTitle: 'Deleted Extension',
    type: 'checkout_post_purchase',
    config: {},
    specification: {
      identifier: 'checkout_post_purchase',
      name: 'Post purchase UI extension',
      experience: 'extension',
      options: {managementExperience: 'cli'},
    },
  }

  REMOTE_CONFIG_EXTENSION = {
    registrationId: CONFIG_EXTENSION.uid,
    registrationUuid: 'remote-config-uuid',
    registrationTitle: 'Point of Sale',
    type: 'point_of_sale',
    config: {},
    specification: {
      identifier: 'point_of_sale',
      name: 'Point of Sale',
      experience: 'configuration',
      options: {managementExperience: 'cli'},
    },
  }
})

beforeEach(() => {
  vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
  vi.mocked(extensionMigrationPrompt).mockResolvedValue(true)
  vi.mocked(migrateExtensionsToUIExtension).mockResolvedValue([])
})

function deployOptionsFor(app: AppInterface, envIdentifiers: {[localIdentifier: string]: string}) {
  return {
    app,
    appId: REMOTE_APP.apiKey,
    appName: REMOTE_APP.title,
    release: true,
    developerPlatformClient: testDeveloperPlatformClient(),
    envIdentifiers,
    remoteApp: REMOTE_APP,
  }
}

describe('classifyDeployExtensionChanges', () => {
  test('classifies local and active app version extensions in one pass', async () => {
    const changes = await classifyDeployExtensionChanges({
      options: deployOptionsFor(APP, {}),
      activeAppVersion: {appModuleVersions: [REMOTE_EXTENSION_A, REMOTE_EXTENSION_DELETED, REMOTE_CONFIG_EXTENSION]},
    })

    expect(
      changes.map((change) => ({
        status: change.status,
        local: change.local?.localIdentifier,
        remote: change.remote?.registrationTitle,
      })),
    ).toEqual([
      {status: 'unchanged', local: EXTENSION_A.localIdentifier, remote: 'Remote Extension A'},
      {status: 'created', local: EXTENSION_B.localIdentifier, remote: undefined},
      {status: 'unchanged', local: CONFIG_EXTENSION.localIdentifier, remote: 'Point of Sale'},
      {status: 'deleted', local: undefined, remote: 'Deleted Extension'},
    ])
  })

  test('classifies UUID fallback matches as updated', async () => {
    const remoteWithoutMatchingUID = {
      ...REMOTE_EXTENSION_A,
      registrationId: '',
    }

    const changes = await classifyDeployExtensionChanges({
      options: deployOptionsFor(testApp({...APP, allExtensions: [EXTENSION_A]}), {
        [EXTENSION_A.localIdentifier]: REMOTE_EXTENSION_A.registrationUuid!,
      }),
      activeAppVersion: {appModuleVersions: [remoteWithoutMatchingUID]},
    })

    expect(changes).toMatchObject([
      {
        status: 'updated',
        local: {localIdentifier: EXTENSION_A.localIdentifier},
        remote: {registrationUuid: REMOTE_EXTENSION_A.registrationUuid},
      },
    ])
  })

  test('keeps same-UID non-config extensions unchanged even when config differs', async () => {
    const changes = await classifyDeployExtensionChanges({
      options: deployOptionsFor(testApp({...APP, allExtensions: [EXTENSION_A]}), {}),
      activeAppVersion: {
        appModuleVersions: [
          {
            ...REMOTE_EXTENSION_A,
            config: {changed: true},
          },
        ],
      },
    })

    expect(changes).toMatchObject([
      {
        status: 'unchanged',
        local: {localIdentifier: EXTENSION_A.localIdentifier},
        remote: {registrationUuid: REMOTE_EXTENSION_A.registrationUuid},
      },
    ])
  })

  test('groups remote-only webhook subscription changes under configuration webhooks', async () => {
    const remoteWebhookSubscriptions = [
      {
        registrationId: 'app/uninstalled:::https://example.com/webhooks/app/uninstalled',
        registrationUuid: 'webhook-subscription-uuid-1',
        registrationTitle: 'app/uninstalled:::https://example.com/webhooks/app/uninstalled',
        type: 'webhook_subscription',
        config: {
          topic: 'app/uninstalled',
          uri: 'https://example.com/webhooks/app/uninstalled',
        },
        specification: {
          identifier: 'webhook_subscription',
          name: 'Webhook Subscription',
          experience: 'configuration',
          options: {managementExperience: 'cli'},
        },
      },
      {
        registrationId: 'scopes/update:::https://example.com/webhooks/scopes/update',
        registrationUuid: 'webhook-subscription-uuid-2',
        registrationTitle: 'scopes/update:::https://example.com/webhooks/scopes/update',
        type: 'webhook_subscription',
        config: {
          topic: 'scopes/update',
          uri: 'https://example.com/webhooks/scopes/update',
        },
        specification: {
          identifier: 'webhook_subscription',
          name: 'Webhook Subscription',
          experience: 'configuration',
          options: {managementExperience: 'cli'},
        },
      },
    ] as AppModuleVersion[]
    const app = testApp({
      ...APP,
      allExtensions: [],
      specifications: [WEBHOOK_SUBSCRIPTION_EXTENSION.specification],
    })

    await ensureDeployIdentifiersFromAppVersion({
      app,
      appId: REMOTE_APP.apiKey,
      appName: REMOTE_APP.title,
      release: true,
      developerPlatformClient: testDeveloperPlatformClient(),
      envIdentifiers: {},
      remoteApp: REMOTE_APP,
      activeAppVersion: {appModuleVersions: remoteWebhookSubscriptions},
      allowDeletes: true,
    })

    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionIdentifiersBreakdown: {
          onlyRemote: [],
          toCreate: [],
          toUpdate: [],
          unchanged: [],
        },
        configExtensionIdentifiersBreakdown: {
          existingFieldNames: [],
          existingUpdatedFieldNames: [],
          newFieldNames: [],
          deletedFieldNames: ['webhooks'],
        },
      }),
    )
  })

  test('trusts remote experience when deciding if remote-only modules are configuration', async () => {
    const remoteConfigLikeExtension = {
      registrationId: 'remote-config-id',
      registrationUuid: 'remote-config-uuid',
      registrationTitle: 'Remote Config-Like Extension',
      type: 'unknown_remote_type',
      config: {},
      specification: {
        identifier: 'unknown_remote_type',
        name: 'Unknown Remote Type',
        experience: 'configuration',
        options: {managementExperience: 'cli'},
      },
    } as AppModuleVersion
    const app = testApp({...APP, allExtensions: [], specifications: []})

    await ensureDeployIdentifiersFromAppVersion({
      app,
      appId: REMOTE_APP.apiKey,
      appName: REMOTE_APP.title,
      release: true,
      developerPlatformClient: testDeveloperPlatformClient(),
      envIdentifiers: {},
      remoteApp: REMOTE_APP,
      activeAppVersion: {appModuleVersions: [remoteConfigLikeExtension]},
      allowDeletes: true,
    })

    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionIdentifiersBreakdown: {
          onlyRemote: [],
          toCreate: [],
          toUpdate: [],
          unchanged: [],
        },
        configExtensionIdentifiersBreakdown: undefined,
      }),
    )
  })

  test('shows each config field once and collapses mixed webhook changes to updated', async () => {
    const remoteWebhookSubscription = {
      registrationId: 'app/uninstalled:::https://example.com/webhooks/app/uninstalled',
      registrationUuid: 'webhook-subscription-uuid-1',
      registrationTitle: 'app/uninstalled:::https://example.com/webhooks/app/uninstalled',
      type: 'webhook_subscription',
      config: {
        topic: 'app/uninstalled',
        uri: 'https://example.com/webhooks/app/uninstalled',
      },
      specification: {
        identifier: 'webhook_subscription',
        name: 'Webhook Subscription',
        experience: 'configuration',
        options: {managementExperience: 'cli'},
      },
    } as AppModuleVersion
    const app = testApp({
      ...APP,
      allExtensions: [WEBHOOK_SUBSCRIPTION_EXTENSION],
      specifications: [WEBHOOK_SUBSCRIPTION_EXTENSION.specification],
    })

    await ensureDeployIdentifiersFromAppVersion({
      app,
      appId: REMOTE_APP.apiKey,
      appName: REMOTE_APP.title,
      release: true,
      developerPlatformClient: testDeveloperPlatformClient(),
      envIdentifiers: {},
      remoteApp: REMOTE_APP,
      activeAppVersion: {appModuleVersions: [remoteWebhookSubscription]},
      allowDeletes: true,
    })

    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        configExtensionIdentifiersBreakdown: {
          existingFieldNames: [],
          existingUpdatedFieldNames: ['webhooks'],
          newFieldNames: [],
          deletedFieldNames: [],
        },
      }),
    )
  })

  test('only marks changed fields as updated when one config specification owns multiple fields', async () => {
    type DataConfig = BaseConfigType & {
      product?: {enabled: boolean}
      metaobject?: {enabled: boolean}
    }
    const dataSpec = createConfigExtensionSpecification<DataConfig>({
      identifier: 'data',
      schema: zod.object({
        product: zod.object({enabled: zod.boolean()}).optional(),
        metaobject: zod.object({enabled: zod.boolean()}).optional(),
      }),
      transformConfig: {
        product: 'product',
        metaobject: 'metaobject',
      },
    })
    const dataExtension = new ExtensionInstance<DataConfig>({
      configuration: {
        product: {enabled: true},
        metaobject: {enabled: true},
      },
      configurationPath: 'shopify.app.toml',
      directory: '/app',
      specification: dataSpec,
    })
    const remoteDataModule = {
      registrationId: dataExtension.uid,
      registrationUuid: 'data-uuid',
      registrationTitle: 'Data',
      type: 'data',
      config: {
        product: {enabled: false},
        metaobject: {enabled: true},
      },
      specification: {
        identifier: 'data',
        name: 'Data',
        experience: 'configuration',
        options: {managementExperience: 'cli'},
      },
    } as AppModuleVersion

    await ensureDeployIdentifiersFromAppVersion({
      app: testApp({...APP, allExtensions: [dataExtension], specifications: [dataSpec]}),
      appId: REMOTE_APP.apiKey,
      appName: REMOTE_APP.title,
      release: true,
      developerPlatformClient: testDeveloperPlatformClient(),
      envIdentifiers: {},
      remoteApp: REMOTE_APP,
      activeAppVersion: {appModuleVersions: [remoteDataModule]},
      allowDeletes: true,
    })

    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        configExtensionIdentifiersBreakdown: {
          existingFieldNames: ['metaobject'],
          existingUpdatedFieldNames: ['product'],
          newFieldNames: [],
          deletedFieldNames: [],
        },
      }),
    )
  })

  test('compares webhook subscriptions by config content instead of matching by UID', async () => {
    const localWebhookSubscription = await testSingleWebhookSubscriptionExtension({
      config: {
        topic: 'orders/delete',
        api_version: '2024-01',
        uri: '/webhooks/orders/delete',
      },
    })
    const remoteWebhookSubscription = {
      registrationId: 'orders/delete::::https://example.com/webhooks/orders/delete',
      registrationUuid: 'webhook-subscription-uuid',
      registrationTitle: 'orders/delete::::https://example.com/webhooks/orders/delete',
      type: 'webhook_subscription',
      config: {
        topic: 'orders/delete',
        api_version: '2024-01',
        uri: 'https://example.com/webhooks/orders/delete',
      },
      specification: {
        identifier: 'webhook_subscription',
        name: 'Webhook Subscription',
        experience: 'configuration',
        options: {managementExperience: 'cli'},
      },
    } as AppModuleVersion

    await ensureDeployIdentifiersFromAppVersion({
      app: testApp({
        ...APP,
        allExtensions: [localWebhookSubscription],
        specifications: [WEBHOOK_SUBSCRIPTION_EXTENSION.specification],
      }),
      appId: REMOTE_APP.apiKey,
      appName: REMOTE_APP.title,
      release: true,
      developerPlatformClient: testDeveloperPlatformClient(),
      envIdentifiers: {},
      remoteApp: REMOTE_APP,
      activeAppVersion: {appModuleVersions: [remoteWebhookSubscription]},
      allowDeletes: true,
    })

    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionIdentifiersBreakdown: {
          onlyRemote: [],
          toCreate: [],
          toUpdate: [],
          unchanged: [],
        },
        configExtensionIdentifiersBreakdown: {
          existingFieldNames: ['webhooks'],
          existingUpdatedFieldNames: [],
          newFieldNames: [],
          deletedFieldNames: [],
        },
      }),
    )
  })

  test('does not mark webhooks as updated when subscriptions are in a different order', async () => {
    const localWebhookSubscriptions = [
      await testSingleWebhookSubscriptionExtension({
        config: {
          topic: 'orders/delete',
          api_version: '2024-01',
          uri: 'https://example.com/webhooks/orders/delete',
        },
      }),
      await testSingleWebhookSubscriptionExtension({
        config: {
          topic: 'products/update',
          api_version: '2024-01',
          uri: 'https://example.com/webhooks/products/update',
        },
      }),
    ]
    const remoteWebhookSubscriptions = [
      {
        registrationId: 'products/update::::https://example.com/webhooks/products/update',
        registrationUuid: 'webhook-subscription-uuid-1',
        registrationTitle: 'products/update::::https://example.com/webhooks/products/update',
        type: 'webhook_subscription',
        config: {
          topic: 'products/update',
          api_version: '2024-01',
          uri: 'https://example.com/webhooks/products/update',
        },
        specification: {
          identifier: 'webhook_subscription',
          name: 'Webhook Subscription',
          experience: 'configuration',
          options: {managementExperience: 'cli'},
        },
      },
      {
        registrationId: 'orders/delete::::https://example.com/webhooks/orders/delete',
        registrationUuid: 'webhook-subscription-uuid-2',
        registrationTitle: 'orders/delete::::https://example.com/webhooks/orders/delete',
        type: 'webhook_subscription',
        config: {
          topic: 'orders/delete',
          api_version: '2024-01',
          uri: 'https://example.com/webhooks/orders/delete',
        },
        specification: {
          identifier: 'webhook_subscription',
          name: 'Webhook Subscription',
          experience: 'configuration',
          options: {managementExperience: 'cli'},
        },
      },
    ] as AppModuleVersion[]

    await ensureDeployIdentifiersFromAppVersion({
      app: testApp({
        ...APP,
        allExtensions: localWebhookSubscriptions,
        specifications: [WEBHOOK_SUBSCRIPTION_EXTENSION.specification],
      }),
      appId: REMOTE_APP.apiKey,
      appName: REMOTE_APP.title,
      release: true,
      developerPlatformClient: testDeveloperPlatformClient(),
      envIdentifiers: {},
      remoteApp: REMOTE_APP,
      activeAppVersion: {appModuleVersions: remoteWebhookSubscriptions},
      allowDeletes: true,
    })

    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        configExtensionIdentifiersBreakdown: {
          existingFieldNames: ['webhooks'],
          existingUpdatedFieldNames: [],
          newFieldNames: [],
          deletedFieldNames: [],
        },
      }),
    )
  })
})

describe('ensureDeployIdentifiersFromAppVersion', () => {
  test('prompts with the existing UI breakdown shape and returns deploy identifiers', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()

    const identifiers = await ensureDeployIdentifiersFromAppVersion({
      app: APP,
      appId: REMOTE_APP.apiKey,
      appName: REMOTE_APP.title,
      release: true,
      developerPlatformClient,
      envIdentifiers: {},
      remoteApp: REMOTE_APP,
      activeAppVersion: {appModuleVersions: [REMOTE_EXTENSION_A, REMOTE_EXTENSION_DELETED, REMOTE_CONFIG_EXTENSION]},
      allowDeletes: true,
    })

    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith({
      extensionIdentifiersBreakdown: {
        onlyRemote: [{title: 'Deleted Extension', uid: 'deleted-uid', experience: 'extension'}],
        toCreate: [{title: EXTENSION_B.localIdentifier, uid: EXTENSION_B.uid, experience: 'extension'}],
        toUpdate: [],
        unchanged: [{title: EXTENSION_A.localIdentifier, uid: undefined, experience: 'extension'}],
      },
      configExtensionIdentifiersBreakdown: {
        existingFieldNames: [],
        existingUpdatedFieldNames: [],
        newFieldNames: ['pos'],
        deletedFieldNames: [],
      },
      appTitle: REMOTE_APP.title,
      release: true,
      allowUpdates: undefined,
      allowDeletes: true,
      installCount: undefined,
    })
    expect(identifiers).toEqual({
      appModuleUuids: {
        [EXTENSION_A.localIdentifier]: REMOTE_EXTENSION_A.registrationUuid,
        [EXTENSION_B.localIdentifier]: EXTENSION_B.uid,
        [CONFIG_EXTENSION.localIdentifier]: REMOTE_CONFIG_EXTENSION.registrationUuid,
      },
      appModuleRegistrationIds: {
        [EXTENSION_A.localIdentifier]: EXTENSION_A.uid,
        [EXTENSION_B.localIdentifier]: EXTENSION_B.uid,
        [CONFIG_EXTENSION.localIdentifier]: CONFIG_EXTENSION.uid,
      },
    })
  })

  test('runs extension migrations before classifying the app version', async () => {
    const legacyRemoteExtension = {
      uuid: 'legacy-uuid-a',
      id: '',
      title: EXTENSION_TO_MIGRATE.localIdentifier,
      type: 'CHECKOUT_UI_EXTENSION',
    }
    const migratedModule = {
      registrationId: EXTENSION_TO_MIGRATE.uid,
      registrationUuid: legacyRemoteExtension.uuid,
      registrationTitle: 'Legacy UI',
      type: 'ui_extension',
      config: await EXTENSION_TO_MIGRATE.deployConfig({apiKey: REMOTE_APP.apiKey, appConfiguration: APP.configuration}),
      specification: {
        identifier: 'ui_extension',
        name: 'UI Extension',
        experience: 'extension',
        options: {managementExperience: 'cli'},
      },
    } as AppModuleVersion
    const activeAppVersion = {appModuleVersions: [migratedModule]}
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      appExtensionRegistrations: () =>
        Promise.resolve({
          app: {
            extensionRegistrations: [legacyRemoteExtension],
            dashboardManagedExtensionRegistrations: [],
            configurationRegistrations: [],
          },
        }),
      activeAppVersion: () => Promise.resolve(activeAppVersion),
    })

    await ensureDeployIdentifiersFromAppVersion({
      app: testApp({...APP, allExtensions: [EXTENSION_TO_MIGRATE]}),
      appId: REMOTE_APP.apiKey,
      appName: REMOTE_APP.title,
      release: true,
      developerPlatformClient,
      envIdentifiers: {},
      remoteApp: REMOTE_APP,
      activeAppVersion: {appModuleVersions: []},
      allowUpdates: true,
    })

    expect(extensionMigrationPrompt).toHaveBeenCalledWith([
      {local: EXTENSION_TO_MIGRATE, remote: legacyRemoteExtension},
    ])
    expect(migrateExtensionsToUIExtension).toHaveBeenCalledWith({
      extensionsToMigrate: [{local: EXTENSION_TO_MIGRATE, remote: legacyRemoteExtension}],
      appId: REMOTE_APP.apiKey,
      remoteExtensions: [legacyRemoteExtension],
      migrationClient: expect.objectContaining({clientName: 'partners'}),
    })
    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionIdentifiersBreakdown: expect.objectContaining({
          unchanged: [{title: EXTENSION_TO_MIGRATE.localIdentifier, uid: undefined, experience: 'extension'}],
        }),
      }),
    )
  })

  test('aborts when extension migration is declined', async () => {
    const legacyRemoteExtension = {
      uuid: 'legacy-uuid-a',
      id: '',
      title: EXTENSION_TO_MIGRATE.localIdentifier,
      type: 'CHECKOUT_UI_EXTENSION',
    }
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      appExtensionRegistrations: () =>
        Promise.resolve({
          app: {
            extensionRegistrations: [legacyRemoteExtension],
            dashboardManagedExtensionRegistrations: [],
            configurationRegistrations: [],
          },
        }),
    })
    vi.mocked(extensionMigrationPrompt).mockResolvedValue(false)

    await expect(
      ensureDeployIdentifiersFromAppVersion({
        app: testApp({...APP, allExtensions: [EXTENSION_TO_MIGRATE]}),
        appId: REMOTE_APP.apiKey,
        appName: REMOTE_APP.title,
        release: true,
        developerPlatformClient,
        envIdentifiers: {},
        remoteApp: REMOTE_APP,
        activeAppVersion: {appModuleVersions: []},
      }),
    ).rejects.toThrow(AbortSilentError)
    expect(deployOrReleaseConfirmationPrompt).not.toHaveBeenCalled()
  })
})
