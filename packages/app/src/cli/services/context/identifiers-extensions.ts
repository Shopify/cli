import {manualMatchIds} from './id-manual-matching.js'
import {automaticMatchmaking} from './id-matching.js'
import {EnsureDeploymentIdsPresenceOptions, LocalSource, MatchingError, RemoteSource} from './identifiers.js'
import {deployConfirmationPrompt, extensionMigrationPrompt, matchConfirmationPrompt} from './prompts.js'
import {createExtension} from '../dev/create-extension.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getUIExtensionsToMigrate, migrateExtensionsToUIExtension} from '../dev/migrate-to-ui-extension.js'
import {getFlowExtensionsToMigrate, migrateFlowExtensions} from '../dev/migrate-flow-extension.js'
import {AppInterface} from '../../models/app/app.js'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {outputCompleted} from '@shopify/cli-kit/node/output'

interface AppWithExtensions {
  extensionRegistrations: RemoteSource[]
  configExtensionRegistrations: RemoteSource[]
  dashboardManagedExtensionRegistrations: RemoteSource[]
}

export async function ensureExtensionsIds(
  options: EnsureDeploymentIdsPresenceOptions,
  {
    extensionRegistrations: initialRemoteExtensions,
    configExtensionRegistrations,
    dashboardManagedExtensionRegistrations: dashboardOnlyExtensions,
  }: AppWithExtensions,
): Promise<Result<{extensions: IdentifiersExtensions; extensionIds: IdentifiersExtensions}, MatchingError>> {
  let remoteExtensions = initialRemoteExtensions
  const validIdentifiers = options.envIdentifiers.extensions ?? {}
  const {configIdentifiers, extensionIdentifiers} = groupIdentifiers(validIdentifiers, options.app)
  const localExtensions = options.app.allExtensions

  const uiExtensionsToMigrate = getUIExtensionsToMigrate(localExtensions, remoteExtensions, extensionIdentifiers)
  const flowExtensionsToMigrate = getFlowExtensionsToMigrate(
    localExtensions,
    dashboardOnlyExtensions,
    extensionIdentifiers,
  )

  if (uiExtensionsToMigrate.length > 0) {
    const confirmedMigration = await extensionMigrationPrompt(uiExtensionsToMigrate)
    if (!confirmedMigration) return err('user-cancelled')
    remoteExtensions = await migrateExtensionsToUIExtension(uiExtensionsToMigrate, options.appId, remoteExtensions)
  }

  if (flowExtensionsToMigrate.length > 0) {
    const confirmedMigration = await extensionMigrationPrompt(flowExtensionsToMigrate, false)
    if (!confirmedMigration) return err('user-cancelled')
    const newRemoteExtensions = await migrateFlowExtensions(
      flowExtensionsToMigrate,
      options.appId,
      dashboardOnlyExtensions,
    )
    remoteExtensions = remoteExtensions.concat(newRemoteExtensions)
  }

  const matchExtensions = await automaticMatchmaking(localExtensions, remoteExtensions, extensionIdentifiers, 'uuid')

  let validMatches = matchExtensions.identifiers
  const validMatchesById: {[key: string]: string} = {}

  const extensionsToCreate = matchExtensions.toCreate ?? []

  for (const pending of matchExtensions.toConfirm) {
    // eslint-disable-next-line no-await-in-loop
    const confirmed = await matchConfirmationPrompt(pending.local, pending.remote)
    if (confirmed) {
      validMatches[pending.local.localIdentifier] = pending.remote.uuid
    } else {
      extensionsToCreate.push(pending.local)
    }
  }

  let onlyRemoteExtensions = matchExtensions.toManualMatch.remote ?? []

  if (matchExtensions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchExtensions.toManualMatch, 'uuid')
    validMatches = {...validMatches, ...matchResult.identifiers}
    extensionsToCreate.push(...matchResult.toCreate)
    onlyRemoteExtensions = matchResult.onlyRemote
  }

  if (!options.force) {
    let question

    if (options.release) {
      question = `Release a new version of ${options.partnersApp?.title}?`
    } else {
      question = `Create a new version of ${options.partnersApp?.title}?`
    }

    const confirmed = await deployConfirmationPrompt({
      summary: {
        appTitle: options.partnersApp?.title,
        question,
        identifiers: validMatches,
        toCreate: extensionsToCreate,
        dashboardOnly: dashboardOnlyExtensions,
      },
      release: options.release,
      apiKey: options.appId,
      token: options.token,
      app: options.app,
    })
    if (!confirmed) return err('user-cancelled')
  }

  // Add existing or toCreate config extensions
  const matchConfigExtensions = await automaticMatchmaking(
    options.app.configExtensions,
    configExtensionRegistrations,
    configIdentifiers,
    'uuid',
  )
  validMatches = {...validMatches, ...matchConfigExtensions.identifiers}
  extensionsToCreate.push(...matchConfigExtensions.toCreate)

  if (extensionsToCreate.length > 0) {
    const newIdentifiers = await createExtensions(extensionsToCreate, options.appId, options.app)
    for (const [localIdentifier, registration] of Object.entries(newIdentifiers)) {
      validMatches[localIdentifier] = registration.uuid
      validMatchesById[localIdentifier] = registration.id
    }
  }

  // For extensions we also need the match by ID, not only UUID (doesn't apply to functions)
  for (const [localIdentifier, uuid] of Object.entries(validMatches)) {
    const registration = remoteExtensions.find((registration) => registration.uuid === uuid)
    if (registration) validMatchesById[localIdentifier] = registration.id
  }

  return ok({
    extensions: validMatches,
    extensionIds: validMatchesById,
  })
}

async function createExtensions(extensions: LocalSource[], appId: string, app: AppInterface) {
  const token = await ensureAuthenticatedPartners()
  const result: {[localIdentifier: string]: RemoteSource} = {}
  for (const extension of extensions) {
    // Create one at a time to avoid API rate limiting issues.
    // eslint-disable-next-line no-await-in-loop
    const registration = await createExtension(appId, extension.graphQLType, extension.handle, token)
    if (!app.configExtensions.find((ext) => ext.localIdentifier === extension.localIdentifier)) {
      outputCompleted(`Created extension ${extension.handle}.`)
    }
    result[extension.localIdentifier] = registration
  }
  return result
}

function groupIdentifiers(
  identifiers: IdentifiersExtensions,
  app: AppInterface,
): {configIdentifiers: IdentifiersExtensions; extensionIdentifiers: IdentifiersExtensions} {
  const configIdentifiers: IdentifiersExtensions = {}
  const extensionIdentifiers: IdentifiersExtensions = {}

  for (const [localIdentifier, uuid] of Object.entries(identifiers)) {
    if (app.allExtensions.find((ext) => ext.localIdentifier === localIdentifier)) {
      extensionIdentifiers[localIdentifier] = uuid
    } else if (app.configExtensions.find((ext) => ext.localIdentifier === localIdentifier)) {
      configIdentifiers[localIdentifier] = uuid
    }
  }

  return {configIdentifiers, extensionIdentifiers}
}
