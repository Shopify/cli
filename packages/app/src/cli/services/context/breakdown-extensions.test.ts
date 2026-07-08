import {
  buildConfigExtensionIdentifiersBreakdown,
  buildDashboardBreakdownInfo,
  buildExtensionBreakdownInfo,
  configExtensionsIdentifiersReleaseBreakdown,
  extensionsIdentifiersReleaseBreakdown,
} from './breakdown-extensions.js'
import {AppModuleVersion} from '../../utilities/developer-platform-client.js'
import {AppVersionsDiffExtensionSchema} from '../../api/graphql/app_versions_diff.js'
import {
  testApp,
  testAppConfigExtensions,
  testDeveloperPlatformClient,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {versionDiffByVersion} from '../release/version-diff.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../release/version-diff')

const VERSION_DIFF_CONFIG_A: AppVersionsDiffExtensionSchema = {
  uuid: 'UUID_C_A',
  registrationTitle: 'Registration title',
  specification: {
    identifier: 'app_access',
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
    },
  },
}

const VERSION_DIFF_DASH_A: AppVersionsDiffExtensionSchema = {
  uuid: 'UUID_D_A',
  registrationTitle: 'Dashboard A',
  specification: {
    identifier: 'flow_action_definition',
    experience: 'legacy',
    options: {
      managementExperience: 'dashboard',
    },
  },
}

const VERSION_DIFF_CLI_A: AppVersionsDiffExtensionSchema = {
  uuid: 'UUID_B',
  registrationTitle: 'Checkout post purchase',
  specification: {
    identifier: 'checkout_post_purchase',
    experience: 'extension',
    options: {
      managementExperience: 'cli',
    },
  },
}

const VERSION_DIFF_DELETED_CLI_B: AppVersionsDiffExtensionSchema = {
  uuid: 'UUID_A',
  registrationTitle: 'Checkout post purchase Deleted B',
  specification: {
    identifier: 'checkout_post_purchase',
    experience: 'extension',
    options: {
      managementExperience: 'cli',
    },
  },
}

const VERSION_DIFF_DELETED_CLI_WEBHOOK: AppVersionsDiffExtensionSchema = {
  uuid: 'UUID_WEBOOK',
  registrationTitle: 'Webhook Subscription Deleted',
  specification: {
    identifier: 'webhook_subscription',
    experience: 'extension',
    options: {
      managementExperience: 'cli',
    },
  },
}

describe('extensionsIdentifiersReleaseBreakdown', () => {
  test('when active version only includes app config modules then the response will be empty', async () => {
    const versionDiff = buildVersionDiff({
      added: [],
      updated: [VERSION_DIFF_CONFIG_A],
      removed: [],
    })
    vi.mocked(versionDiffByVersion).mockResolvedValue(versionDiff)

    const result = await extensionsIdentifiersReleaseBreakdown(
      testDeveloperPlatformClient(),
      testOrganizationApp(),
      '1.0.0',
    )

    expect(result).toEqual({
      extensionIdentifiersBreakdown: {
        onlyRemote: [],
        toCreate: [],
        toUpdate: [],
        unchanged: [],
      },
      versionDetails: versionDiff.versionDetails,
    })
  })

  test('maps release version extension and dashboard changes into the prompt breakdown', async () => {
    const versionDiff = buildVersionDiff({
      added: [VERSION_DIFF_CLI_A, VERSION_DIFF_DASH_A],
      updated: [VERSION_DIFF_CLI_A, VERSION_DIFF_DASH_A],
      removed: [VERSION_DIFF_DELETED_CLI_B, VERSION_DIFF_DASH_A],
    })
    vi.mocked(versionDiffByVersion).mockResolvedValue(versionDiff)

    const result = await extensionsIdentifiersReleaseBreakdown(
      testDeveloperPlatformClient(),
      testOrganizationApp(),
      '1.0.0',
    )

    expect(result).toEqual({
      extensionIdentifiersBreakdown: {
        onlyRemote: [
          buildExtensionBreakdownInfo('Checkout post purchase Deleted B', undefined),
          buildDashboardBreakdownInfo('Dashboard A'),
        ],
        toCreate: [
          buildExtensionBreakdownInfo('Checkout post purchase', undefined),
          buildDashboardBreakdownInfo('Dashboard A'),
        ],
        toUpdate: [],
        unchanged: [
          buildExtensionBreakdownInfo('Checkout post purchase', undefined),
          buildDashboardBreakdownInfo('Dashboard A'),
        ],
      },
      versionDetails: versionDiff.versionDetails,
    })
  })

  test('does not include webhook subscriptions in release extension changes', async () => {
    const versionDiff = buildVersionDiff({
      added: [],
      updated: [],
      removed: [VERSION_DIFF_DELETED_CLI_B, VERSION_DIFF_DELETED_CLI_WEBHOOK],
    })
    vi.mocked(versionDiffByVersion).mockResolvedValue(versionDiff)

    const result = await extensionsIdentifiersReleaseBreakdown(
      testDeveloperPlatformClient(),
      testOrganizationApp(),
      '1.0.0',
    )

    expect(result).toEqual({
      extensionIdentifiersBreakdown: {
        toCreate: [],
        toUpdate: [],
        onlyRemote: [buildExtensionBreakdownInfo('Checkout post purchase Deleted B', undefined)],
        unchanged: [],
      },
      versionDetails: versionDiff.versionDetails,
    })
  })
})

describe('buildConfigExtensionIdentifiersBreakdown', () => {
  test('compares aggregate config content with order-insensitive arrays', () => {
    const result = buildConfigExtensionIdentifiersBreakdown(
      {
        embedded: true,
        name: 'my app',
        webhooks: {
          subscriptions: [
            {topics: ['products/update', 'products/create'], uri: 'https://example.com/products'},
            {topics: ['orders/create'], uri: 'https://example.com/orders'},
          ],
        },
      },
      {
        app_proxy: {prefix: 'apps'},
        name: 'my app',
        webhooks: {
          subscriptions: [
            {topics: ['orders/create'], uri: 'https://example.com/orders'},
            {topics: ['products/create', 'products/update'], uri: 'https://example.com/products'},
          ],
        },
      },
    )

    expect(result).toEqual({
      existingFieldNames: ['name', 'webhooks'],
      existingUpdatedFieldNames: [],
      newFieldNames: ['embedded'],
      deletedFieldNames: ['app_proxy'],
    })
  })

  test('returns undefined when both configs are empty', () => {
    expect(buildConfigExtensionIdentifiersBreakdown({}, {})).toBeUndefined()
  })
})

describe('configExtensionsIdentifiersReleaseBreakdown', () => {
  test('compares the selected version config against the active version config', async () => {
    const app = testApp({
      allExtensions: [await testAppConfigExtensions()],
      specifications: await loadLocalExtensionsSpecifications(),
    })
    const result = configExtensionsIdentifiersReleaseBreakdown({
      localApp: app,
      versionAppModules: [
        configModule('branding', {name: 'my app'}),
        configModule('app_home', {app_url: 'https://new.example.com', embedded: false}),
        configModule('point_of_sale', {embedded: false}),
        configModule('webhooks', {api_version: '2025-01'}),
      ],
      activeAppVersion: {
        appModuleVersions: [
          configModule('branding', {name: 'my app'}),
          configModule('app_home', {app_url: 'https://old.example.com', embedded: false}),
          configModule('webhooks', {api_version: '2025-01'}),
        ],
      },
    })

    expect(result).toEqual({
      existingFieldNames: ['name', 'embedded', 'webhooks'],
      existingUpdatedFieldNames: ['application_url'],
      newFieldNames: ['pos'],
      deletedFieldNames: [],
    })
  })

  test('returns undefined when the local app has no config extensions', () => {
    const app = testApp({allExtensions: []})

    const result = configExtensionsIdentifiersReleaseBreakdown({
      localApp: app,
      versionAppModules: [configModule('branding', {name: 'my app'})],
    })

    expect(result).toBeUndefined()
  })
})

function buildVersionDiff(versionsDiff: {
  added: AppVersionsDiffExtensionSchema[]
  updated: AppVersionsDiffExtensionSchema[]
  removed: AppVersionsDiffExtensionSchema[]
}) {
  return {
    versionsDiff,
    versionDetails: {
      id: 1,
      uuid: 'uuid',
      location: 'location',
      versionTag: '1.0.0',
      message: 'message',
      appModuleVersions: [],
    },
  }
}

function configModule(identifier: string, config: {[key: string]: unknown}): AppModuleVersion {
  return {
    registrationId: `${identifier}-id`,
    registrationUuid: `${identifier}-uuid`,
    registrationTitle: identifier,
    type: identifier,
    config,
    specification: {
      identifier,
      name: identifier,
      experience: 'configuration',
      options: {
        managementExperience: 'cli',
      },
    },
  }
}
