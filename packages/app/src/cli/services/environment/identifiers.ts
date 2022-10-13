import {automaticMatchmaking, LocalExtension} from './id-matching.js'
import {manualMatchIds} from './id-manual-matching.js'
import {AppInterface} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {Extension, ThemeExtension, UIExtension} from '../../models/app/extensions.js'
import {fetchAppExtensionRegistrations} from '../dev/fetch.js'
import {createExtension} from '../dev/create-extension.js'
import {error, output, session, ui} from '@shopify/cli-kit'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

const DeployError = (appName: string, packageManager: PackageManager) => {
  return new error.Abort(
    `Deployment failed because this local project doesn't seem to match the app "${appName}" in Shopify Partners.`,
    `• If you didn't intend to select this app, run ${
      output.content`${output.token.packagejsonScript(packageManager, 'deploy', '--reset')}`.value
    }
• If this is the app you intended, check your local project and make sure
  it contains the same number and types of extensions as the Shopify app
  you've selected. You may need to generate missing extensions.`,
  )
}

export interface EnsureDeploymentIdsPresenceOptions {
  app: AppInterface
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
  const remoteExtensionRegistrations: ExtensionRegistration[] = remoteSpecifications.app.extensionRegistrations
  const remoteFunctions: ExtensionRegistration[] = remoteSpecifications.app.functions

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
  const localExtensions: (ThemeExtension | UIExtension)[] = [
    ...options.app.extensions.ui,
    ...options.app.extensions.theme,
  ]

  const GenericError = () => DeployError(options.appName, options.app.packageManager)

  // We need local extensions to deploy
  // if (localExtensions.length === 0) {
  //   return {
  //     app: options.appId,
  //     extensions: {...functionLocalIdentifiers},
  //     // Numeric extension IDs aren't relevant for functions
  //     extensionIds: {},
  //   }
  // }

  const matchExtensions = (
    await automaticMatchmaking(localExtensions, remoteExtensionRegistrations, validIdentifiers, 'uuid')
  )
    .mapError(GenericError)
    .valueOrThrow()

  const matchFunctions = (
    await automaticMatchmaking(options.app.extensions.function, remoteFunctions, validIdentifiers, 'id')
  )
    .mapError(GenericError)
    .valueOrThrow()

  console.log(JSON.stringify(matchFunctions, null, 2))

  let validMatches = matchExtensions.identifiers ?? {}
  const validMatchesById: {[key: string]: string} = {}

  const pendingConfirmation = {...matchExtensions.pendingConfirmation, ...matchFunctions.pendingConfirmation}

  if (pendingConfirmation.length > 0) {
    for (const pending of pendingConfirmation) {
      // eslint-disable-next-line no-await-in-loop
      const confirmed = await matchConfirmationPrompt(pending.extension, pending.registration)
      if (!confirmed) throw new error.CancelExecution()
      validMatches[pending.extension.localIdentifier] = pending.registration.uuid
    }
  }

  const extensionsToCreate = matchExtensions.toCreate ?? []
  const functionsToCreate = matchFunctions.toCreate ?? []

  if (matchExtensions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchExtensions.toManualMatch)
    if (matchResult.result === 'pending-remote') throw GenericError()
    validMatches = {...validMatches, ...matchResult.identifiers}
    functionsToCreate.push(...matchResult.toCreate)
  }

  if (matchFunctions.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(matchFunctions.toManualMatch)
    if (matchResult.result === 'pending-remote') throw GenericError()
    validMatches = {...validMatches, ...matchResult.identifiers}
    functionsToCreate.push(...matchResult.toCreate)
  }

  if (extensionsToCreate.length > 0) {
    const newIdentifiers = await createExtensions(extensionsToCreate, options.appId)
    for (const [localIdentifier, registration] of Object.entries(newIdentifiers)) {
      validMatches[localIdentifier] = registration.uuid
      validMatchesById[localIdentifier] = registration.id
    }
  }

  for (const [localIdentifier, uuid] of Object.entries(validMatches)) {
    const registration = remoteExtensionRegistrations.find((registration) => registration.uuid === uuid)
    if (registration) validMatchesById[localIdentifier] = registration.id
  }

  return {
    app: options.appId,
    extensions: {...functionLocalIdentifiers},
    extensionIds: {},
  }
}

async function createExtensions(extensions: LocalExtension[], appId: string) {
  // PENDING: Function extensions can't be created before being deployed we'll need to handle that differently
  const token = await session.ensureAuthenticatedPartners()
  const result: {[localIdentifier: string]: ExtensionRegistration} = {}
  for (const extension of extensions) {
    // eslint-disable-next-line no-await-in-loop
    const registration = await createExtension(appId, extension.type, extension.configuration.name, token)
    output.completed(`Created extension ${extension.configuration.name}.`)
    result[extension.localIdentifier] = registration
  }
  return result
}

async function matchConfirmationPrompt(extension: LocalExtension, registration: ExtensionRegistration) {
  const choices = [
    {name: `Yes, that's right`, value: 'yes'},
    {name: `No, cancel deployment`, value: 'no'},
  ]
  const choice: {value: string} = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: `Deploy ${extension.localIdentifier} (local name) as ${registration.title} (name on Shopify Partners, ID: ${registration.id})?`,
      choices,
    },
  ])
  return choice.value === 'yes'
}
