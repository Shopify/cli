import {SourceSummary} from '../services/context/prompts.js'
import metadata from '../metadata.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {
  ExtensionIdentifiersBreakdown,
  PartnersAppForIdentifierMatching,
  loadLocalConfigExtensionIdentifiersBreakdown,
  resolveRemoteConfigExtensionIdentifiersBreakdown,
} from '../services/context/identifiers.js'
import {AppInterface} from '../models/app/app.js'
import {InfoTableSection, renderConfirmationPrompt, renderDangerousConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function deployConfirmationPrompt({
  appTitle,
  extensionsContentPrompt: {extensionsInfoTable, deletedInfoTable},
  configContentPrompt: {configInfoTable, deletedInfoTable: configDeletedInfoTable},
  release,
}: SourceSummary): Promise<boolean> {
  const timeBeforeConfirmationMs = new Date().valueOf()
  let confirmationResponse = true

  let question = `Create a new version of ${appTitle}?`
  if (release) {
    question = `Release a new version of ${appTitle}?`
  }

  const appExists = Boolean(appTitle)

  let finalDeletedInfoTable = deletedInfoTable ?? {header: '', items: []}
  if (configDeletedInfoTable) {
    finalDeletedInfoTable = {
      ...finalDeletedInfoTable,
      header: configDeletedInfoTable.header,
      items: [...finalDeletedInfoTable.items, ...configDeletedInfoTable.items],
    }
  }

  const infoTable = []
  if (extensionsInfoTable || finalDeletedInfoTable.header !== '' || configInfoTable.items.length > 0) {
    infoTable.push(
      configInfoTable.items.length === 0 ? {...configInfoTable, items: [{subdued: 'No changes'}]} : configInfoTable,
    )
  }
  if (extensionsInfoTable) infoTable.push(extensionsInfoTable)
  if (finalDeletedInfoTable.header !== '') infoTable.push(finalDeletedInfoTable)

  const isDangerous = appExists && deletedInfoTable

  if (isDangerous) {
    confirmationResponse = await renderDangerousConfirmationPrompt({
      message: question,
      infoTable,
      confirmation: appTitle!,
    })
  } else {
    let confirmationMessage

    if (release) {
      confirmationMessage = 'Yes, release this new version'
    } else {
      confirmationMessage = 'Yes, create this new version'
    }

    confirmationResponse = await renderConfirmationPrompt({
      message: question,
      infoTable,
      confirmationMessage,
      cancellationMessage: 'No, cancel',
    })
  }

  const timeToConfirmOrCancelMs = new Date().valueOf() - timeBeforeConfirmationMs

  await metadata.addPublicMetadata(() => ({
    cmd_deploy_confirm_cancelled: !confirmationResponse,
    cmd_deploy_confirm_time_to_complete_ms: timeBeforeConfirmationMs,
  }))

  return confirmationResponse
}

export interface DeployOrReleaseConfirmationPromptOptions {
  extensionIdentifiersBreakdown: ExtensionIdentifiersBreakdown
  configExtensionRegistrations?: ExtensionRegistration[]
  remoteApp: PartnersAppForIdentifierMatching
  localApp: AppInterface
  release: boolean
  force: boolean
}

export async function deployOrReleaseConfirmationPrompt({
  force,
  extensionIdentifiersBreakdown,
  configExtensionRegistrations,
  remoteApp,
  localApp,
  release,
}: DeployOrReleaseConfirmationPromptOptions) {
  if (force) return true
  const extensionsContentPrompt = await buildExtensionsContentPrompt(extensionIdentifiersBreakdown)
  let configContentPrompt: ConfigContentPrompt = {
    configInfoTable: {header: 'Extensions: ', items: []},
    deletedInfoTable: undefined,
  }
  if (configExtensionRegistrations) {
    configContentPrompt = await buildConfigContentPrompt(configExtensionRegistrations, localApp, remoteApp, release)
  }
  return deployConfirmationPrompt({
    appTitle: remoteApp.title,
    extensionsContentPrompt,
    configContentPrompt,
    release,
  })
}

interface ConfigContentPrompt {
  configInfoTable: InfoTableSection
  deletedInfoTable?: InfoTableSection
}

async function buildExtensionsContentPrompt(extensionsContentBreakdown: ExtensionIdentifiersBreakdown) {
  if (extensionsContentBreakdown === null) return {extensionsInfoTable: undefined, deletedInfoTable: undefined}

  const {fromDashboard, onlyRemote, toCreate: toCreateBreakdown, toUpdate} = extensionsContentBreakdown

  await metadata.addPublicMetadata(() => ({
    cmd_deploy_confirm_new_registrations: toCreateBreakdown.length,
    cmd_deploy_confirm_updated_registrations: toUpdate.length,
    cmd_deploy_confirm_removed_registrations: onlyRemote.length,
  }))

  let extensionsInfoTable
  const extensionsInfo = [
    ...toCreateBreakdown.map((identifier) => [identifier, {subdued: '(new)'}]),
    ...toUpdate.map((identifier) => [identifier, {subdued: ''}]),
    ...fromDashboard.map((identifier) => [identifier, {subdued: '(from Partner Dashboard)'}]),
  ]
  if (extensionsInfo.length > 0) {
    extensionsInfoTable = {header: 'Extensions:', items: extensionsInfo}
  }

  let deletedInfoTable
  const deleted = onlyRemote.map((field) => [{subdued: 'Extension:'}, field])
  if (deleted.length > 0) {
    deletedInfoTable = {
      header: 'Removes:',
      items: deleted,
      bullet: '-',
    }
  }

  return {extensionsInfoTable, deletedInfoTable}
}

async function buildConfigContentPrompt(
  configExtensionRegistrations: ExtensionRegistration[],
  app: AppInterface,
  remoteApp: PartnersAppForIdentifierMatching,
  release: boolean,
) {
  let configContentBreakdown = loadLocalConfigExtensionIdentifiersBreakdown(app)
  if (release) {
    configContentBreakdown = resolveRemoteConfigExtensionIdentifiersBreakdown(
      configExtensionRegistrations,
      app,
      remoteApp,
    )
  }
  const {existingFieldNames, existingUpdatedFieldNames, newFieldNames, deletedFieldNames} = configContentBreakdown

  const modifiedFieldNames = [
    ...existingUpdatedFieldNames.map((field) => [field, {subdued: '(updated)'}]),
    ...newFieldNames.map((field) => [field, {subdued: '(new)'}]),
  ]
  const configurationInfo = [...existingFieldNames.map((field) => [field, {subdued: ''}]), ...modifiedFieldNames]
  const configInfoTable = {
    header: 'Configuration:',
    items: modifiedFieldNames.length > 0 || !release ? configurationInfo : [],
  }

  let deletedInfoTable
  const deleted = deletedFieldNames.map((field) => [{subdued: 'Configuration:'}, field])
  if (deleted.length > 0) {
    deletedInfoTable = {
      header: 'Removes:',
      items: deleted,
      bullet: '-',
    }
  }

  return {
    configInfoTable,
    deletedInfoTable,
  }
}
