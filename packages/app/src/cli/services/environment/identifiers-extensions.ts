import {manualMatchIds} from './id-manual-matching.js'
import {automaticMatchmaking} from './id-matching.js'
import {EnsureDeploymentIdsPresenceOptions, LocalSource, MatchingError, RemoteSource} from './identifiers.js'
import {deployConfirmationPrompt, matchConfirmationPrompt} from './prompts.js'
import {createExtension} from '../dev/create-extension.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {outputCompleted} from '@shopify/cli-kit/node/output'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function ensureExtensionsIds(
  options: EnsureDeploymentIdsPresenceOptions,
  remoteExtensions: RemoteSource[],
): Promise<Result<{extensions: IdentifiersExtensions; extensionIds: IdentifiersExtensions}, MatchingError>> {
  const validIdentifiers = options.envIdentifiers.extensions ?? {}
  const localExtensions = [...options.app.extensions.ui, ...options.app.extensions.theme]
  const matchExtensions = await automaticMatchmaking(localExtensions, remoteExtensions, validIdentifiers, 'uuid')

  let validMatches = matchExtensions.identifiers
  const validMatchesById: {[key: string]: string} = {}

  for (const pending of matchExtensions.toConfirm) {
    // eslint-disable-next-line no-await-in-loop
    const confirmed = await matchConfirmationPrompt(pending.local, pending.remote)
    if (!confirmed) return err('user-cancelled')
    validMatches[pending.local.localIdentifier] = pending.remote.uuid
  }

  const extensionsToCreate = matchExtensions.toCreate ?? []
  let onlyRemoteExtensions = matchExtensions.toManualMatch.remote ?? []

  if (matchExtensions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchExtensions.toManualMatch, 'uuid')
    validMatches = {...validMatches, ...matchResult.identifiers}
    extensionsToCreate.push(...matchResult.toCreate)
    onlyRemoteExtensions = matchResult.onlyRemote
  }

  for (const extension of matchExtensions.toMigrate) {
    const remoteType = extension.remote.type.toLowerCase()
    const localType = extension.local.type
    // eslint-disable-next-line no-await-in-loop
    const confirmed = await renderConfirmationPrompt({
      message: `You've changed ${extension.local.configuration.name} from ${remoteType} to ${localType}. Would you like to migrate it in Shopify Partners?`,
      infoTable: {
        'Old type': [extension.remote.type.toLowerCase()],
        'New type': [extension.local.type],
      },
      confirmationMessage: `Yes, update to ${localType}`,
      cancellationMessage: 'No, cancel the deploy',
    })

    if (confirmed) {
      // TODO: Run GraphQL Migration
      console.log("We'll migrate the extension in Shopify Partners.")

      return err('user-cancelled')
    } else {
      return err('user-cancelled')
    }
  }

  if (!options.force) {
    const confirmed = await deployConfirmationPrompt({
      question: 'Make the following changes to your extensions in Shopify Partners?',
      identifiers: validMatches,
      toCreate: extensionsToCreate,
      onlyRemote: onlyRemoteExtensions,
    })
    if (!confirmed) return err('user-cancelled')
  }

  if (extensionsToCreate.length > 0) {
    const newIdentifiers = await createExtensions(extensionsToCreate, options.appId)
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

async function createExtensions(extensions: LocalSource[], appId: string) {
  const token = await ensureAuthenticatedPartners()
  const result: {[localIdentifier: string]: RemoteSource} = {}
  for (const extension of extensions) {
    // Create one at a time to avoid API rate limiting issues.
    // eslint-disable-next-line no-await-in-loop
    const registration = await createExtension(appId, extension.graphQLType, extension.configuration.name, token)
    outputCompleted(`Created extension ${extension.configuration.name}.`)
    result[extension.localIdentifier] = registration
  }
  return result
}
