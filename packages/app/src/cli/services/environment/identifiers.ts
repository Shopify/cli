import {automaticMatchmaking} from './id-matching'
import {manualMatchIds} from './id-manual-matching'
import {App, Extension, Identifiers} from '../../models/app/app'
import {fetchAppExtensionRegistrations} from '../dev/fetch'
import {createExtension} from '../dev/create-extension'
import {dependency, error, output, session, ui} from '@shopify/cli-kit'

const DeployError = (appName: string, packageManager: dependency.DependencyManager) => {
  return new error.Abort(
    `Deployment failed because this local project doesn't seem to match the app "${appName}" in Shopify Partners.`,
    `• If you didn't intend to select this app, run ${
      output.content`${output.token.packagejsonScript(packageManager, 'deploy', '--reset')}`.value
    }
• If this is the app you intended, check your local project and make sure
  it contains the same number and types of extensions as the Shopify app
  you've selected. You may need to scaffold missing extensions.`,
  )
}

export interface EnsureDeploymentIdsPresenceOptions {
  app: App
  token: string
  appId: string
  appName: string
  envIdentifiers: Partial<Identifiers>
}

interface ExtensionRegistration {
  uuid: string
  type: string
  id: string
  title: string
}

export async function ensureDeploymentIdsPresence(options: EnsureDeploymentIdsPresenceOptions): Promise<Identifiers> {
  // All initial values both remote and local
  const remoteSpecifications = await fetchAppExtensionRegistrations({token: options.token, apiKey: options.appId})
  const remoteRegistrations: ExtensionRegistration[] = remoteSpecifications.app.extensionRegistrations
  const validIdentifiers = options.envIdentifiers.extensions ?? {}
  const functionLocalIdentifiers = Object.fromEntries(
    options.app.extensions.function
      .map((extension) => extension.localIdentifier)
      .map((extensionIdentifier) => {
        return validIdentifiers[extensionIdentifier]
          ? [extensionIdentifier, validIdentifiers[extensionIdentifier]]
          : undefined
      })
      .filter((entry) => entry !== undefined) as string[][],
  )
  const localExtensions: Extension[] = [...options.app.extensions.ui, ...options.app.extensions.theme]

  const GenericError = () => DeployError(options.appName, options.app.dependencyManager)

  // We need local extensions to deploy
  if (localExtensions.length === 0) {
    return {app: options.appId, extensions: {...functionLocalIdentifiers}}
  }

  // If there are more remote extensions than local, then something is missing and we can't continue
  if (remoteRegistrations.length > localExtensions.length) {
    throw GenericError()
  }

  const match = await automaticMatchmaking(localExtensions, remoteRegistrations, validIdentifiers)

  if (match.result === 'invalid-environment') {
    throw GenericError()
  }
  let validMatches = match.identifiers ?? {}

  if (match.pendingConfirmation.length > 0) {
    for (const pending of match.pendingConfirmation) {
      // eslint-disable-next-line no-await-in-loop
      const confirmed = await matchConfirmationPrompt(pending.extension, pending.registration)
      if (!confirmed) throw new error.AbortSilent()
      validMatches[pending.extension.localIdentifier] = pending.registration.uuid
    }
  }

  const extensionsToCreate = match.toCreate ?? []

  if (match.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(match.toManualMatch.local, match.toManualMatch.remote)
    if (matchResult.result === 'pending-remote') throw GenericError()
    validMatches = {...validMatches, ...matchResult.identifiers}
    extensionsToCreate.push(...matchResult.toCreate)
  }

  if (extensionsToCreate.length > 0) {
    const newIdentifiers = await createExtensions(extensionsToCreate, options.appId)
    validMatches = {...validMatches, ...newIdentifiers}
  }

  const validMatchesById: {[key: string]: number} = {}
  for (const [localIdentifier, uuid] of Object.entries(validMatches)) {
    const registration = remoteRegistrations.find((registration) => registration.uuid === uuid)
    validMatchesById[localIdentifier] = registration.id
  }

  return {
    app: options.appId,
    extensions: {...validMatches, ...functionLocalIdentifiers},
    extensionIds: validMatchesById,
  }
}

async function createExtensions(extensions: Extension[], appId: string) {
  // PENDING: Function extensions can't be created before being deployed we'll need to handle that differently
  const token = await session.ensureAuthenticatedPartners()
  const result: {[localIdentifier: string]: string} = {}
  for (const extension of extensions) {
    // eslint-disable-next-line no-await-in-loop
    const registration = await createExtension(appId, extension.type, extension.localIdentifier, token)
    output.completed(`Created extension ${extension.localIdentifier}`)
    result[extension.localIdentifier] = registration.uuid
  }
  return result
}

async function matchConfirmationPrompt(extension: Extension, registration: ExtensionRegistration) {
  const choices = [
    {name: `Yes, that's right`, value: 'yes'},
    {name: `No, cancel deployment`, value: 'no'},
  ]
  const questions: ui.Question = {
    type: 'select',
    name: 'value',
    message: `Deploy ${extension.localIdentifier} (local name) as ${registration.title} (name on Shopify Partners, ID: ${registration.id})?`,
    choices,
  }
  const choice: {value: string} = await ui.prompt([questions])
  return choice.value === 'yes'
}
