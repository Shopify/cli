import {EnsureDeploymentIdsPresenceOptions, RemoteSource} from './identifiers.js'
import {extensionMigrationPrompt} from './prompts.js'
import {migrateFlowExtensions} from '../dev/migrate-flow-extension.js'
import {migrateExtensionsToUIExtension} from '../dev/migrate-to-ui-extension.js'
import {
  AdminLinkModulesMap,
  FlowModulesMap,
  getModulesToMigrate,
  MarketingModulesMap,
  migrateAppModules,
  UIModulesMap,
} from '../dev/migrate-app-module.js'
import {MigrationDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {PartnersClient} from '../../utilities/developer-platform-client/partners-client.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

/** Returns a fresh active app version when migrations changed remote modules. */
export async function activeAppVersionAfterMigrations(options: EnsureDeploymentIdsPresenceOptions) {
  const didMigrateExtensions = await migrateExtensionsIfNeeded(options)
  return didMigrateExtensions
    ? options.developerPlatformClient.activeAppVersion(options.remoteApp)
    : options.activeAppVersion
}

/** Runs supported legacy extension migrations before deploy classification. */
async function migrateExtensionsIfNeeded(options: EnsureDeploymentIdsPresenceOptions) {
  const {app, appId, developerPlatformClient, envIdentifiers, remoteApp} = options
  const registrations = await developerPlatformClient.appExtensionRegistrations(remoteApp, options.activeAppVersion)
  const localExtensions = app.allExtensions
  const identifiers = envIdentifiers
  const remoteExtensions = registrations.app.extensionRegistrations
  const dashboardExtensions = registrations.app.dashboardManagedExtensionRegistrations
  const migrationClient = PartnersClient.getInstance()

  let didMigrate = false
  let migratedRemoteExtensions = remoteExtensions

  const uiExtensionsToMigrate = getModulesToMigrate(
    localExtensions,
    migratedRemoteExtensions,
    identifiers,
    UIModulesMap,
  )
  if (uiExtensionsToMigrate.length > 0) {
    const confirmedMigration = await extensionMigrationPrompt(uiExtensionsToMigrate)
    if (!confirmedMigration) throw new AbortSilentError()
    migratedRemoteExtensions = await migrateExtensionsToUIExtension({
      extensionsToMigrate: uiExtensionsToMigrate,
      appId,
      remoteExtensions: migratedRemoteExtensions,
      migrationClient,
    })
    didMigrate = true
  }

  const dashboardMigrations = [
    {typesMap: FlowModulesMap, migrate: migrateFlowExtensions},
    migrationGroup(MarketingModulesMap, 'marketing_activity'),
    migrationGroup(AdminLinkModulesMap, 'admin_link'),
  ]

  for (const migration of dashboardMigrations) {
    const extensionsToMigrate = getModulesToMigrate(
      localExtensions,
      dashboardExtensions,
      identifiers,
      migration.typesMap,
    )
    if (extensionsToMigrate.length === 0) continue

    // eslint-disable-next-line no-await-in-loop
    const confirmedMigration = await extensionMigrationPrompt(extensionsToMigrate, false)
    if (!confirmedMigration) throw new AbortSilentError()

    // eslint-disable-next-line no-await-in-loop
    const newRemoteExtensions = await migration.migrate({
      extensionsToMigrate,
      appId,
      remoteExtensions: dashboardExtensions,
      migrationClient,
    })
    migratedRemoteExtensions = migratedRemoteExtensions.concat(newRemoteExtensions)
    didMigrate = true
  }

  return didMigrate
}

/** Adapts app-module migrations to the shared dashboard migration loop. */
function migrationGroup(typesMap: {[key: string]: string[]}, type: string) {
  return {
    typesMap,
    migrate: (options: {
      extensionsToMigrate: Parameters<typeof migrateAppModules>[0]['extensionsToMigrate']
      appId: string
      remoteExtensions: RemoteSource[]
      migrationClient: MigrationDeveloperPlatformClient
    }) => migrateAppModules({...options, type}),
  }
}
