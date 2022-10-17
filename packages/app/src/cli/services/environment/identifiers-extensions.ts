import {manualMatchIds} from './id-manual-matching.js'
import {automaticMatchmaking} from './id-matching.js'
import {EnsureDeploymentIdsPresenceOptions, LocalExtension, MatchingError, RemoteRegistration} from './identifiers.js'
import {matchConfirmationPrompt} from './prompts.js'
import {createExtension, ExtensionRegistration} from '../dev/create-extension.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {err, ok, Result} from '@shopify/cli-kit/common/result'
import {output, session} from '@shopify/cli-kit'

export async function ensureExtensionsIds(
  options: EnsureDeploymentIdsPresenceOptions,
  remoteExtensions: RemoteRegistration[],
): Promise<Result<{extensions: IdentifiersExtensions; extensionIds: IdentifiersExtensions}, MatchingError>> {
  const validIdentifiers = options.envIdentifiers.extensions ?? {}
  const localExtensions = [...options.app.extensions.ui, ...options.app.extensions.theme]

  const matchExtensionsResult = await automaticMatchmaking(localExtensions, remoteExtensions, validIdentifiers, 'uuid')
  if (matchExtensionsResult.isErr()) return err(matchExtensionsResult.error)
  const matchExtensions = matchExtensionsResult.value

  let validMatches = matchExtensions.identifiers
  const validMatchesById: {[key: string]: string} = {}

  for (const pending of matchExtensions.pendingConfirmation) {
    // eslint-disable-next-line no-await-in-loop
    const confirmed = await matchConfirmationPrompt(pending.extension, pending.registration)
    if (!confirmed) return err('user-cancelled')
    validMatches[pending.extension.localIdentifier] = pending.registration.uuid
  }

  const extensionsToCreate = matchExtensions.toCreate ?? []

  if (matchExtensions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchExtensions.toManualMatch, 'uuid')
    if (matchResult.result === 'pending-remote') return err('pending-remote')
    validMatches = {...validMatches, ...matchResult.identifiers}
    extensionsToCreate.push(...matchResult.toCreate)
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

async function createExtensions(extensions: LocalExtension[], appId: string) {
  const token = await session.ensureAuthenticatedPartners()
  const result: {[localIdentifier: string]: ExtensionRegistration} = {}
  for (const extension of extensions) {
    // Create one at a time to aboid API rate limiting issues.
    // eslint-disable-next-line no-await-in-loop
    const registration = await createExtension(appId, extension.type, extension.configuration.name, token)
    output.completed(`Created extension ${extension.configuration.name}.`)
    result[extension.localIdentifier] = registration
  }
  return result
}
