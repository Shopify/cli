/* eslint-disable @shopify/prefer-module-scope-constants */
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {
  buildDashboardBreakdownInfo,
  buildExtensionBreakdownInfo,
  configExtensionsIdentifiersBreakdown,
  extensionsIdentifiersDeployBreakdown,
  extensionsIdentifiersReleaseBreakdown,
} from './breakdown-extensions.js'
import {RemoteSource} from './identifiers.js'
import {fetchActiveAppVersion, fetchAppExtensionRegistrations} from '../dev/fetch.js'
import {AppConfiguration, AppInterface, CurrentAppConfiguration} from '../../models/app/app.js'
import {
  buildVersionedAppSchema,
  testApp,
  testAppConfigExtensions,
  testUIExtension,
} from '../../models/app/app.test-data.js'
import {OrganizationApp} from '../../models/organization.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {AppModuleVersion} from '../../api/graphql/app_active_version.js'
import {AppVersionsDiffExtensionSchema} from '../../api/graphql/app_versions_diff.js'
import {versionDiffByVersion} from '../release/version-diff.js'
import {describe, vi, test, beforeAll, expect} from 'vitest'
import {setPathValue} from '@shopify/cli-kit/common/object'

const REGISTRATION_A: RemoteSource = {
  uuid: 'UUID_A',
  id: 'A',
  title: 'A',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_DASH_MIGRATED_A: RemoteSource = {
  uuid: 'UUID_DM_A',
  id: 'DM_A',
  title: 'DM A',
  type: 'CUSTOMER_ACCOUNTS_UI_EXTENSION',
}

const REGISTRATION_DASHBOARD_A = {
  id: 'D_A',
  title: 'Dashboard A',
  uuid: 'UUID_D_A',
  type: 'flow_action_definition',
  activeVersion: {
    config: '{}',
  },
}

const REGISTRATION_DASHBOARD_NEW = {
  id: 'D_NEW',
  title: 'Dashboard New',
  uuid: 'UUID_D_NEW',
  type: 'flow_action_definition',
  activeVersion: {
    config: '{}',
  },
}

const MODULE_CLI_A: AppModuleVersion = {
  registrationId: 'A',
  registrationUuid: 'UUID_A',
  registrationTitle: 'Checkout post purchase',
  type: 'post_purchase_ui_extension',
  specification: {
    identifier: 'post_purchase_ui_extension',
    name: 'Post purchase UI extension',
    experience: 'extension',
    options: {
      managementExperience: 'cli',
    },
  },
}

const MODULE_DASHBOARD_MIGRATED_CLI_A: AppModuleVersion = {
  registrationId: 'A',
  registrationUuid: 'UUID_A',
  registrationTitle: 'Checkout post purchase',
  type: 'post_purchase_ui_extension',
  specification: {
    identifier: 'post_purchase_ui_extension',
    name: 'Post purchase UI extension',
    experience: 'extension',
    options: {
      managementExperience: 'cli',
    },
  },
}

const MODULE_CONFIG_A: AppModuleVersion = {
  registrationId: 'C_A',
  registrationUuid: 'UUID_C_A',
  registrationTitle: 'Registration title',
  type: 'app_access',
  specification: {
    identifier: 'app_access',
    name: 'App access',
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
    },
  },
}

const MODULE_DASHBOARD_A: AppModuleVersion = {
  registrationId: 'D_A',
  registrationUuid: 'UUID_D_A',
  registrationTitle: 'Dashboard A',
  type: 'flow_action_definition',
  specification: {
    identifier: 'flow_action_definition',
    name: 'Flow action definition',
    experience: 'deprecated',
    options: {
      managementExperience: 'dashboard',
    },
  },
}

const MODULE_DELETED_DASHBOARD_B: AppModuleVersion = {
  registrationId: 'D_B',
  registrationUuid: 'UUID_D_B',
  registrationTitle: 'Dashboard Deleted B',
  type: 'flow_action_definition',
  specification: {
    identifier: 'flow_action_definition',
    name: 'Flow action definition',
    experience: 'deprecated',
    options: {
      managementExperience: 'dashboard',
    },
  },
}

const MODULE_DELETED_CLI_B: AppModuleVersion = {
  registrationId: 'B',
  registrationUuid: 'UUID_B',
  registrationTitle: 'Checkout post purchase Deleted B',
  type: 'post_purchase_ui_extension',
  specification: {
    identifier: 'post_purchase_ui_extension',
    name: 'Post purchase UI extension',
    experience: 'extension',
    options: {
      managementExperience: 'cli',
    },
  },
}

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
    identifier: 'post_purchase_ui_extension',
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
    identifier: 'post_purchase_ui_extension',
    experience: 'extension',
    options: {
      managementExperience: 'cli',
    },
  },
}

const APP_CONFIGURATION: CurrentAppConfiguration = {
  path: 'shopify.app.development.toml',
  name: 'my app',
  client_id: '12345',
  webhooks: {
    api_version: '2023-04',
  },
  application_url: 'https://myapp.com',
  embedded: true,
  build: {
    include_config_on_deploy: true,
  },
}

const LOCAL_APP = async (
  uiExtensions: ExtensionInstance[],
  configuration: AppConfiguration = APP_CONFIGURATION,
  betas = [],
): Promise<AppInterface> => {
  const versionSchema = await buildVersionedAppSchema()

  const localApp = testApp({
    name: 'my-app',
    directory: '/app',
    configuration,
    allExtensions: [...uiExtensions, await testAppConfigExtensions()],
    specifications: versionSchema.configSpecifications,
    configSchema: versionSchema.schema,
  })

  setPathValue(localApp, 'remoteBetaFlags', betas)
  return localApp
}

const options = async (
  uiExtensions: ExtensionInstance[],
  identifiers: any = {},
  partnersApp?: OrganizationApp,
  release = true,
) => {
  return {
    app: await LOCAL_APP(uiExtensions),
    token: 'token',
    appId: 'appId',
    appName: 'appName',
    envIdentifiers: {extensions: identifiers},
    force: false,
    partnersApp,
    release,
  }
}

let EXTENSION_A: ExtensionInstance
let EXTENSION_A_2: ExtensionInstance
let DASH_MIGRATED_EXTENSION_A: ExtensionInstance

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../dev/fetch')
vi.mock('./identifiers-extensions')
vi.mock('../release/version-diff')
vi.mock('../../prompts/deploy-release')

beforeAll(async () => {
  EXTENSION_A = await testUIExtension({
    directory: '/EXTENSION_A',
    configuration: {
      name: 'EXTENSION A',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  EXTENSION_A_2 = await testUIExtension({
    directory: '/EXTENSION_A_2',
    configuration: {
      name: 'EXTENSION A 2',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  DASH_MIGRATED_EXTENSION_A = await testUIExtension({
    directory: '/DASH_MIGRATED_EXTENSION_A',
    configuration: {
      name: 'DASH MIGRATED EXTENSION A',
      type: 'pos_ui_extension',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })
})

describe('extensionsIdentifiersDeployBreakdown', () => {
  describe('deploy with no release', () => {
    test('returns the current valid local extensions content', async () => {
      // Given
      const remoteExtensionRegistrations = {
        app: {
          extensionRegistrations: [REGISTRATION_A],
          configurationRegistrations: [],
          dashboardManagedExtensionRegistrations: [REGISTRATION_DASHBOARD_A],
        },
      }
      vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue(remoteExtensionRegistrations)
      const extensionsToConfirm = {
        validMatches: {EXTENSION_A: 'UUID_A'},
        dashboardOnlyExtensions: [],
        extensionsToCreate: [EXTENSION_A_2],
      }
      vi.mocked(ensureExtensionsIds).mockResolvedValue(extensionsToConfirm)

      // When
      const result = await extensionsIdentifiersDeployBreakdown(
        await options([EXTENSION_A, EXTENSION_A_2], {}, undefined, false),
      )

      // Then
      expect(result).toEqual({
        extensionIdentifiersBreakdown: {
          onlyRemote: [],
          toCreate: [],
          toUpdate: [buildExtensionBreakdownInfo('EXTENSION_A'), buildExtensionBreakdownInfo('extension-a-2')],
        },
        extensionsToConfirm,
        remoteExtensionsRegistrations: remoteExtensionRegistrations.app,
      })
    })
  })
  describe('deploy with release', () => {
    test('and there is no active version then every extension should be created', async () => {
      // Given
      const remoteExtensionRegistrations = {
        app: {
          extensionRegistrations: [REGISTRATION_A],
          configurationRegistrations: [],
          dashboardManagedExtensionRegistrations: [REGISTRATION_DASHBOARD_A],
        },
      }
      vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue(remoteExtensionRegistrations)
      const extensionsToConfirm = {
        validMatches: {EXTENSION_A: 'UUID_A'},
        dashboardOnlyExtensions: [REGISTRATION_DASHBOARD_A],
        extensionsToCreate: [EXTENSION_A_2],
      }
      vi.mocked(ensureExtensionsIds).mockResolvedValue(extensionsToConfirm)
      const activeVersion = {app: {activeAppVersion: {appModuleVersions: []}}}
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await extensionsIdentifiersDeployBreakdown(await options([EXTENSION_A, EXTENSION_A_2]))

      // Then
      expect(result).toEqual({
        extensionIdentifiersBreakdown: {
          onlyRemote: [],
          toCreate: [
            buildExtensionBreakdownInfo('EXTENSION_A'),
            buildExtensionBreakdownInfo('extension-a-2'),
            buildDashboardBreakdownInfo('Dashboard A'),
          ],
          toUpdate: [],
        },
        extensionsToConfirm,
        remoteExtensionsRegistrations: remoteExtensionRegistrations.app,
      })
    })
    test('and there is an active version with only app config app modules then every extension should be created', async () => {
      // Given
      const remoteExtensionRegistrations = {
        app: {
          extensionRegistrations: [REGISTRATION_A],
          configurationRegistrations: [],
          dashboardManagedExtensionRegistrations: [REGISTRATION_DASHBOARD_A],
        },
      }
      vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue(remoteExtensionRegistrations)
      const extensionsToConfirm = {
        validMatches: {EXTENSION_A: 'UUID_A'},
        dashboardOnlyExtensions: [REGISTRATION_DASHBOARD_A],
        extensionsToCreate: [EXTENSION_A_2],
      }
      vi.mocked(ensureExtensionsIds).mockResolvedValue(extensionsToConfirm)
      const activeVersion = {app: {activeAppVersion: {appModuleVersions: [MODULE_CONFIG_A, MODULE_DASHBOARD_A]}}}
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await extensionsIdentifiersDeployBreakdown(await options([EXTENSION_A, EXTENSION_A_2]))

      // Then
      expect(result).toEqual({
        extensionIdentifiersBreakdown: {
          onlyRemote: [],
          toCreate: [buildExtensionBreakdownInfo('EXTENSION_A'), buildExtensionBreakdownInfo('extension-a-2')],
          toUpdate: [buildDashboardBreakdownInfo('Dashboard A')],
        },
        extensionsToConfirm,
        remoteExtensionsRegistrations: remoteExtensionRegistrations.app,
      })
    })
    test('and there is an active version with matching cli app modules then cli extension should be updated', async () => {
      // Given
      const remoteExtensionRegistrations = {
        app: {
          extensionRegistrations: [REGISTRATION_A],
          configurationRegistrations: [],
          dashboardManagedExtensionRegistrations: [REGISTRATION_DASHBOARD_A],
        },
      }
      vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue(remoteExtensionRegistrations)
      const extensionsToConfirm = {
        validMatches: {EXTENSION_A: 'UUID_A'},
        dashboardOnlyExtensions: [REGISTRATION_DASHBOARD_A],
        extensionsToCreate: [EXTENSION_A_2],
      }
      vi.mocked(ensureExtensionsIds).mockResolvedValue(extensionsToConfirm)
      const activeVersion = {
        app: {activeAppVersion: {appModuleVersions: [MODULE_CONFIG_A, MODULE_DASHBOARD_A, MODULE_CLI_A]}},
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await extensionsIdentifiersDeployBreakdown(await options([EXTENSION_A, EXTENSION_A_2]))

      // Then
      expect(result).toEqual({
        extensionIdentifiersBreakdown: {
          onlyRemote: [],
          toCreate: [buildExtensionBreakdownInfo('extension-a-2')],
          toUpdate: [buildExtensionBreakdownInfo('EXTENSION_A'), buildDashboardBreakdownInfo('Dashboard A')],
        },
        extensionsToConfirm,
        remoteExtensionsRegistrations: remoteExtensionRegistrations.app,
      })
    })
    test('and there is an active version with matching dashboard migrated cli app modules then migrated extension should be returned in the to create', async () => {
      // Given
      const remoteExtensionRegistrations = {
        app: {
          extensionRegistrations: [REGISTRATION_A, REGISTRATION_DASH_MIGRATED_A],
          configurationRegistrations: [],
          dashboardManagedExtensionRegistrations: [REGISTRATION_DASHBOARD_A, REGISTRATION_DASH_MIGRATED_A],
        },
      }
      vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue(remoteExtensionRegistrations)
      const extensionsToConfirm = {
        validMatches: {EXTENSION_A: 'UUID_A', DASH_MIGRATED_EXTENSION_A: 'UUID_DM_A'},
        dashboardOnlyExtensions: [REGISTRATION_DASHBOARD_A, REGISTRATION_DASH_MIGRATED_A],
        extensionsToCreate: [EXTENSION_A_2],
      }
      vi.mocked(ensureExtensionsIds).mockResolvedValue(extensionsToConfirm)
      const activeVersion = {
        app: {
          activeAppVersion: {
            appModuleVersions: [MODULE_CONFIG_A, MODULE_DASHBOARD_A, MODULE_CLI_A, MODULE_DASHBOARD_MIGRATED_CLI_A],
          },
        },
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await extensionsIdentifiersDeployBreakdown(await options([EXTENSION_A, EXTENSION_A_2]))

      // Then
      expect(result).toEqual({
        extensionIdentifiersBreakdown: {
          onlyRemote: [],
          toCreate: [
            buildExtensionBreakdownInfo('DASH_MIGRATED_EXTENSION_A'),
            buildExtensionBreakdownInfo('extension-a-2'),
          ],
          toUpdate: [buildExtensionBreakdownInfo('EXTENSION_A'), buildDashboardBreakdownInfo('Dashboard A')],
        },
        extensionsToConfirm,
        remoteExtensionsRegistrations: remoteExtensionRegistrations.app,
      })
    })
    test('and there is an active version with no matching local app modules then they should be returned in the extensions list to delete', async () => {
      // Given
      const remoteExtensionRegistrations = {
        app: {
          extensionRegistrations: [REGISTRATION_A, REGISTRATION_DASH_MIGRATED_A],
          configurationRegistrations: [],
          dashboardManagedExtensionRegistrations: [
            REGISTRATION_DASHBOARD_A,
            REGISTRATION_DASH_MIGRATED_A,
            REGISTRATION_DASHBOARD_NEW,
          ],
        },
      }
      vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue(remoteExtensionRegistrations)
      const extensionsToConfirm = {
        validMatches: {EXTENSION_A: 'UUID_A', DASH_MIGRATED_EXTENSION_A: 'UUID_DM_A'},
        dashboardOnlyExtensions: [REGISTRATION_DASHBOARD_A, REGISTRATION_DASH_MIGRATED_A, REGISTRATION_DASHBOARD_NEW],
        extensionsToCreate: [EXTENSION_A_2],
      }
      vi.mocked(ensureExtensionsIds).mockResolvedValue(extensionsToConfirm)
      const activeVersion = {
        app: {
          activeAppVersion: {
            appModuleVersions: [
              MODULE_CONFIG_A,
              MODULE_DASHBOARD_A,
              MODULE_CLI_A,
              MODULE_DASHBOARD_MIGRATED_CLI_A,
              MODULE_DELETED_DASHBOARD_B,
              MODULE_DELETED_CLI_B,
            ],
          },
        },
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await extensionsIdentifiersDeployBreakdown(await options([EXTENSION_A, EXTENSION_A_2]))

      // Then
      expect(result).toEqual({
        extensionIdentifiersBreakdown: {
          onlyRemote: [
            buildExtensionBreakdownInfo('Checkout post purchase Deleted B'),
            buildDashboardBreakdownInfo('Dashboard Deleted B'),
          ],
          toCreate: [
            buildExtensionBreakdownInfo('DASH_MIGRATED_EXTENSION_A'),
            buildExtensionBreakdownInfo('extension-a-2'),
            buildDashboardBreakdownInfo('Dashboard New'),
          ],
          toUpdate: [buildExtensionBreakdownInfo('EXTENSION_A'), buildDashboardBreakdownInfo('Dashboard A')],
        },
        extensionsToConfirm,
        remoteExtensionsRegistrations: remoteExtensionRegistrations.app,
      })
    })
  })
})

describe('extensionsIdentifiersReleaseBreakdown', () => {
  test('when active version only includes app config modules then the response will be empty', async () => {
    // Given
    const versionDiff = {
      versionsDiff: {
        added: [],
        updated: [VERSION_DIFF_CONFIG_A],
        removed: [],
      },
      versionDetails: {
        id: 1,
        uuid: 'uuid',
        location: 'location',
        versionTag: '1.0.0',
        message: 'message',
        appModuleVersions: [],
      },
    }
    vi.mocked(versionDiffByVersion).mockResolvedValue(versionDiff)

    // When
    const result = await extensionsIdentifiersReleaseBreakdown('token', 'apiKey', ' 1.0.0')

    // Then
    expect(result).toEqual({
      extensionIdentifiersBreakdown: {
        onlyRemote: [],
        toCreate: [],
        toUpdate: [],
      },
      versionDetails: versionDiff.versionDetails,
    })
  })

  test('when active version only includes not only app config modules then the response will return them', async () => {
    // Given
    const versionDiff = {
      versionsDiff: {
        added: [VERSION_DIFF_CLI_A],
        updated: [VERSION_DIFF_CONFIG_A, VERSION_DIFF_DASH_A],
        removed: [VERSION_DIFF_DELETED_CLI_B],
      },
      versionDetails: {
        id: 1,
        uuid: 'uuid',
        location: 'location',
        versionTag: '1.0.0',
        message: 'message',
        appModuleVersions: [],
      },
    }
    vi.mocked(versionDiffByVersion).mockResolvedValue(versionDiff)

    // When
    const result = await extensionsIdentifiersReleaseBreakdown('token', 'apiKey', ' 1.0.0')

    // Then
    expect(result).toEqual({
      extensionIdentifiersBreakdown: {
        onlyRemote: [buildExtensionBreakdownInfo('Checkout post purchase Deleted B')],
        toCreate: [buildExtensionBreakdownInfo('Checkout post purchase')],
        toUpdate: [buildDashboardBreakdownInfo('Dashboard A')],
      },
      versionDetails: versionDiff.versionDetails,
    })
  })
})

describe('configExtensionsIdentifiersBreakdown', () => {
  describe('deploy with no release', () => {
    test('returns the list of the local config versioned top level fields', async () => {
      // Given
      const configuration = {
        path: 'shopify.app.development.toml',
        name: 'my app',
        client_id: '12345',
        application_url: 'https://myapp.com',
        embedded: true,
        pos: {
          embedded: false,
        },
        app_proxy: {
          url: 'https://my-proxy-new.dev',
          subpath: 'subpath-whatever',
          prefix: 'apps',
        },
        build: {
          automatically_update_urls_on_dev: false,
          dev_store_url: 'https://my-dev-store.com',
          include_config_on_deploy: true,
        },
        webhooks: {
          api_version: '2023-04',
        },
      }

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], configuration),
        release: false,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: ['name', 'application_url', 'embedded', 'pos', 'app_proxy', 'webhooks'],
        existingUpdatedFieldNames: [],
        newFieldNames: [],
        deletedFieldNames: [],
      })
    })
  })
  describe('deploy with release using local configuration', () => {
    test('when the same local config and remote app module type exists and have same values it will be returned in the existing list', async () => {
      // Given
      const configuration = {
        path: 'shopify.app.development.toml',
        name: 'my app',
        client_id: '12345',
        application_url: 'https://myapp.com',
        embedded: true,
        webhooks: {
          api_version: '2023-04',
        },
        build: {
          include_config_on_deploy: true,
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const brandingActiveAppModule: AppModuleVersion = {
        registrationId: 'C_B',
        registrationUuid: 'UUID_C_B',
        registrationTitle: 'Registration title',
        type: 'branding',
        config: JSON.stringify({name: 'my app'}),
        specification: {
          identifier: 'branding',
          name: 'branding',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const webhooksActiveAppModule: AppModuleVersion = {
        registrationId: 'C_C',
        registrationUuid: 'UUID_C_C',
        registrationTitle: 'Registration title',
        type: 'webhooks',
        config: JSON.stringify({api_version: '2023-04'}),
        specification: {
          identifier: 'webhooks',
          name: 'webhooks',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {
        app: {
          activeAppVersion: {
            appModuleVersions: [
              configActiveAppModule,
              brandingActiveAppModule,
              webhooksActiveAppModule,
              MODULE_DASHBOARD_A,
            ],
          },
        },
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], configuration),
        release: true,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: ['name', 'application_url', 'embedded', 'webhooks'],
        existingUpdatedFieldNames: [],
        newFieldNames: [],
        deletedFieldNames: [],
      })
    })

    test('when the same local config and remote app module type exists and have different values it will be returned in the update list', async () => {
      // Given
      const configuration = {
        path: 'shopify.app.development.toml',
        name: 'my app',
        client_id: '12345',
        application_url: 'https://myapp.com',
        embedded: true,
        webhooks: {
          api_version: '2023-04',
        },
        build: {
          include_config_on_deploy: true,
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp-edited.com', embedded: false}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const brandingActiveAppModule: AppModuleVersion = {
        registrationId: 'C_B',
        registrationUuid: 'UUID_C_B',
        registrationTitle: 'Registration title',
        type: 'branding',
        config: JSON.stringify({name: 'my app'}),
        specification: {
          identifier: 'branding',
          name: 'branding',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const webhooksActiveAppModule: AppModuleVersion = {
        registrationId: 'C_C',
        registrationUuid: 'UUID_C_C',
        registrationTitle: 'Registration title',
        type: 'webhooks',
        config: JSON.stringify({api_version: '2023-04'}),
        specification: {
          identifier: 'webhooks',
          name: 'webhooks',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {
        app: {
          activeAppVersion: {
            appModuleVersions: [
              configActiveAppModule,
              brandingActiveAppModule,
              webhooksActiveAppModule,
              MODULE_DASHBOARD_A,
            ],
          },
        },
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], configuration),
        release: true,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: ['name', 'webhooks'],
        existingUpdatedFieldNames: ['application_url', 'embedded'],
        newFieldNames: [],
        deletedFieldNames: [],
      })
    })
    test('when a new local config app module type exists it will be returned in the new list', async () => {
      // Given
      const configuration = {
        path: 'shopify.app.development.toml',
        name: 'my app',
        client_id: '12345',
        application_url: 'https://myapp.com',
        embedded: true,
        pos: {
          embedded: false,
        },
        webhooks: {
          api_version: '2023-04',
        },
        build: {
          include_config_on_deploy: true,
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {
        app: {
          activeAppVersion: {
            appModuleVersions: [configActiveAppModule, MODULE_DASHBOARD_A],
          },
        },
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], configuration),
        release: true,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: ['application_url', 'embedded'],
        existingUpdatedFieldNames: [],
        newFieldNames: ['name', 'webhooks', 'pos'],
        deletedFieldNames: [],
      })
    })
    test('when a remote config app module type not exists locally it will be returned in the delete list', async () => {
      // Given
      const configuration = {
        path: 'shopify.app.development.toml',
        name: 'my app',
        client_id: '12345',
        application_url: 'https://myapp.com',
        embedded: true,
        webhooks: {
          api_version: '2023-04',
        },
        build: {
          include_config_on_deploy: true,
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const brandingActiveAppModule: AppModuleVersion = {
        registrationId: 'C_B',
        registrationUuid: 'UUID_C_B',
        registrationTitle: 'Registration title',
        type: 'branding',
        config: JSON.stringify({name: 'my app', app_handle: 'handle'}),
        specification: {
          identifier: 'branding',
          name: 'Branding',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const webhooksActiveAppModule: AppModuleVersion = {
        registrationId: 'C_C',
        registrationUuid: 'UUID_C_C',
        registrationTitle: 'Registration title',
        type: 'webhooks',
        config: JSON.stringify({api_version: '2023-04'}),
        specification: {
          identifier: 'webhooks',
          name: 'webhooks',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const configActivePosConfigurationAppModule: AppModuleVersion = {
        registrationId: 'C_B',
        registrationUuid: 'UUID_C_B',
        registrationTitle: 'Registration title',
        type: 'point_of_sale',
        config: JSON.stringify({
          embedded: false,
        }),
        specification: {
          identifier: 'point_of_sale',
          name: 'Pos configuration',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {
        app: {
          activeAppVersion: {
            appModuleVersions: [
              configActiveAppModule,
              configActivePosConfigurationAppModule,
              brandingActiveAppModule,
              webhooksActiveAppModule,
              MODULE_DASHBOARD_A,
            ],
          },
        },
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], configuration),
        release: true,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: ['name', 'application_url', 'embedded', 'webhooks'],
        existingUpdatedFieldNames: [],
        newFieldNames: [],
        deletedFieldNames: ['pos'],
      })
    })
  })
  describe('deploy with release using a remote version configuration', () => {
    test('when the version to release config and remote remote current app exists and have same values it will be returned in the existing list', async () => {
      // Given
      const configToReleaseAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {app: {activeAppVersion: {appModuleVersions: [configActiveAppModule, MODULE_DASHBOARD_A]}}}
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], APP_CONFIGURATION),
        versionAppModules: [configToReleaseAppModule],
        release: true,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: ['application_url', 'embedded'],
        existingUpdatedFieldNames: [],
        newFieldNames: [],
        deletedFieldNames: [],
      })
    })
    test('when the version to release config and remote remote current app exists and have different values it will be returned in the update list', async () => {
      // Given
      const configToReleaseAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp-edited.com', embedded: false}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {
        app: {activeAppVersion: {appModuleVersions: [configActiveAppModule, MODULE_DASHBOARD_A]}},
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], APP_CONFIGURATION),
        versionAppModules: [configToReleaseAppModule],
        release: true,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: [],
        existingUpdatedFieldNames: ['application_url', 'embedded'],
        newFieldNames: [],
        deletedFieldNames: [],
      })
    })
    test('when the version to release includes a new config it will be returned in the new list', async () => {
      // Given
      const configToReleaseAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({
          app_url: 'https://myapp.com',
          embedded: true,
        }),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const configToReleasePosAppModule: AppModuleVersion = {
        registrationId: 'C_B',
        registrationUuid: 'UUID_C_B',
        registrationTitle: 'Registration title',
        type: 'point_of_sale',
        config: JSON.stringify({
          embedded: false,
        }),
        specification: {
          identifier: 'point_of_sale',
          name: 'Pos configuration',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {
        app: {
          activeAppVersion: {
            appModuleVersions: [configActiveAppModule, MODULE_DASHBOARD_A],
          },
        },
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], APP_CONFIGURATION),
        versionAppModules: [configToReleaseAppModule, configToReleasePosAppModule],
        release: true,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: ['application_url', 'embedded'],
        existingUpdatedFieldNames: [],
        newFieldNames: ['pos'],
        deletedFieldNames: [],
      })
    })
    test('when the version to release config doesnt include a config module that exists in the remote remote current app it will be returned in the delete list', async () => {
      // Given
      const configToReleaseAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({
          app_url: 'https://myapp.com',
          embedded: true,
        }),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const configActivePosConfigurationAppModule: AppModuleVersion = {
        registrationId: 'C_B',
        registrationUuid: 'UUID_C_B',
        registrationTitle: 'Registration title',
        type: 'point_of_sale',
        config: JSON.stringify({
          embedded: false,
        }),
        specification: {
          identifier: 'point_of_sale',
          name: 'Pos configuration',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {
        app: {
          activeAppVersion: {
            appModuleVersions: [configActiveAppModule, configActivePosConfigurationAppModule, MODULE_DASHBOARD_A],
          },
        },
      }
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], APP_CONFIGURATION),
        versionAppModules: [configToReleaseAppModule],
        release: true,
      })

      // Then
      expect(result).toEqual({
        existingFieldNames: ['application_url', 'embedded'],
        existingUpdatedFieldNames: [],
        newFieldNames: [],
        deletedFieldNames: ['pos'],
      })
    })
  })
  describe('deploy not including the configuration app modules', () => {
    test('when the include_config_on_deploy is not true the configuration breakdown info is not returned', async () => {
      // Given
      const configuration = {
        path: 'shopify.app.development.toml',
        name: 'my app',
        client_id: '12345',
        application_url: 'https://myapp.com',
        embedded: true,
        pos: {
          embedded: false,
        },
        build: {
          include_config_on_deploy: false,
        },
        webhooks: {
          api_version: '2023-04',
        },
      }
      const configToReleaseAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const configActiveAppModule: AppModuleVersion = {
        registrationId: 'C_A',
        registrationUuid: 'UUID_C_A',
        registrationTitle: 'Registration title',
        type: 'app_home',
        config: JSON.stringify({app_url: 'https://myapp.com', embedded: true}),
        specification: {
          identifier: 'app_home',
          name: 'App Ui',
          experience: 'configuration',
          options: {
            managementExperience: 'cli',
          },
        },
      }
      const activeVersion = {app: {activeAppVersion: {appModuleVersions: [configActiveAppModule, MODULE_DASHBOARD_A]}}}
      vi.mocked(fetchActiveAppVersion).mockResolvedValue(activeVersion)

      // When
      const result = await configExtensionsIdentifiersBreakdown({
        token: 'token',
        apiKey: 'apiKey',
        localApp: await LOCAL_APP([], configuration),
        versionAppModules: [configToReleaseAppModule],
        release: true,
      })

      // Then
      expect(result).toBeUndefined()
    })
  })
})
