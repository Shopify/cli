import {automaticMatchmaking} from './id-matching'
import {App, Extension, Identifiers} from '../../models/app/app'
import {fetchAppExtensionRegistrations} from '../dev/fetch'
import {createExtension} from '../dev/create-extension'
import {error, session, ui} from '@shopify/cli-kit'

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
    'Manual matching is required',
    'We are working on a a manual solution for this case, coming soon!',
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
  if (match.toManualMatch.local.length > 0) {
    const {identifiers, toCreate} = await manualMatch(match.toManualMatch.local, match.toManualMatch.remote)
    console.log(identifiers, toCreate)
  }
  throw new error.Abort('Manual matching is required')

  if (match.toCreate.length > 0) {
    const newIdentifiers = await createExtensions(match.toCreate, options.appId)
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
    result[extension.localIdentifier] = registration.uuid
  }
  return result
}

async function manualMatch(localExtensions: Extension[], remoteExtensions: ExtensionRegistration[]) {
  const identifiers: {[key: string]: string} = {}
  let pendingRemote = remoteExtensions
  let pendingLocal = localExtensions
  for (const extension of localExtensions) {
    const registrationsForType = pendingRemote.filter((reg) => reg.type === extension.type)
    if (registrationsForType.length === 0) continue
    // eslint-disable-next-line no-await-in-loop
    const selected = await selectRegistrationPrompt(extension, registrationsForType)
    identifiers[extension.localIdentifier] = selected.uuid
    pendingRemote = pendingRemote.filter((reg) => reg.uuid !== selected.uuid)
    pendingLocal = pendingLocal.filter((reg) => reg.localIdentifier !== extension.localIdentifier)
  }
  if (pendingRemote.length > 0) {
    throw new error.Abort('There are still remote extensions to match')
  }
  return {identifiers, toCreate: pendingLocal}
}

export async function selectRegistrationPrompt(
  extension: Extension,
  registrations: ExtensionRegistration[],
): Promise<ExtensionRegistration> {
  const orgList = registrations.map((reg) => ({name: reg.title, value: reg.uuid}))
  const questions: ui.Question = {
    type: 'autocomplete',
    name: 'uuid',
    message: `To which extension would you like to connect "${extension.localIdentifier}"?`,
    choices: orgList,
  }
  const choice: {uuid: string} = await ui.prompt([questions])
  return registrations.find((reg) => reg.uuid === choice.uuid)!
}
