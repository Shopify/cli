import {automaticMatchmaking} from './id-matching'
import {manualMatchIds} from './id-manual-matching'
import {App, Extension, Identifiers} from '../../models/app/app'
import {fetchAppExtensionRegistrations} from '../dev/fetch'
import {createExtension} from '../dev/create-extension'
import {error, output, session} from '@shopify/cli-kit'

const WrongExtensionNumberError = (remote: number, local: number) => {
  return new error.Abort(
    `This app has ${remote} registered extensions, but only ${local} are locally available.`,
    `Please check your local project or select a different app to deploy to`,
  )
}

const NoLocalExtensionsError = () => {
  return new error.Abort('There are no extensions to deploy')
}

const ManualMatchRequired = () => {
  return new error.Abort(
    'All remote extensions must be connected to a local extension in your project',
    'Please check that your local project includes all extensions and execute deploy again',
  )
}

const InvalidEnvironment = () => {
  return new error.Abort(
    "We couldn't automatically match your local and remote extensions",
    'Please check your local project or select a different app to deploy to',
  )
}

export interface EnsureDeploymentIdsPresenceOptions {
  app: App
  token: string
  appId: string
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
  const localExtensions: Extension[] = [
    ...options.app.extensions.ui,
    ...options.app.extensions.function,
    ...options.app.extensions.theme,
  ]

  // We need local extensions to deploy
  if (localExtensions.length === 0) {
    throw NoLocalExtensionsError()
  }

  // If there are more remote extensions than local, then something is missing and we can't continue
  if (remoteRegistrations.length > localExtensions.length) {
    throw WrongExtensionNumberError(remoteRegistrations.length, localExtensions.length)
  }

  const match = await automaticMatchmaking(localExtensions, remoteRegistrations, validIdentifiers)

  if (match.result === 'invalid-environment') {
    throw InvalidEnvironment()
  }

  let validMatches = match.identifiers ?? {}
  const extensionsToCreate = match.toCreate ?? []

  if (match.toManualMatch.local.length > 0) {
    const matchResult = await manualMatchIds(match.toManualMatch.local, match.toManualMatch.remote)
    if (matchResult.result === 'pending-remote') throw ManualMatchRequired()
    validMatches = {...validMatches, ...matchResult.identifiers}
    extensionsToCreate.push(...matchResult.toCreate)
  }

  if (extensionsToCreate.length > 0) {
    const newIdentifiers = await createExtensions(extensionsToCreate, options.appId)
    validMatches = {...validMatches, ...newIdentifiers}
  }

  return {app: options.appId, extensions: validMatches}
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
