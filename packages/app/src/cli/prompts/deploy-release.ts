import metadata from '../metadata.js'
import {
  ConfigExtensionIdentifiersBreakdown,
  ExtensionIdentifiersBreakdown,
} from '../services/context/breakdown-extensions.js'
import {useVersionedAppConfig} from '@shopify/cli-kit/node/context/local'
import {InfoTableSection, renderConfirmationPrompt, renderDangerousConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export interface DeployOrReleaseConfirmationPromptOptions {
  extensionIdentifiersBreakdown: ExtensionIdentifiersBreakdown
  configExtensionIdentifiersBreakdown?: ConfigExtensionIdentifiersBreakdown
  appTitle?: string
  release: boolean
  force: boolean
}

export interface DeployConfirmationPromptOptions {
  appTitle?: string
  extensionsContentPrompt: {
    extensionsInfoTable?: InfoTableSection
    deletedInfoTable?: InfoTableSection
  }
  configContentPrompt: {
    configInfoTable: InfoTableSection
    deletedInfoTable?: InfoTableSection
  }
  release: boolean
}

export async function deployOrReleaseConfirmationPrompt({
  force,
  extensionIdentifiersBreakdown,
  configExtensionIdentifiersBreakdown,
  appTitle,
  release,
}: DeployOrReleaseConfirmationPromptOptions) {
  if (force) return true
  const extensionsContentPrompt = await buildExtensionsContentPrompt(extensionIdentifiersBreakdown)
  const configContentPrompt = await buildConfigContentPrompt(release, configExtensionIdentifiersBreakdown)

  return deployConfirmationPrompt({
    appTitle,
    extensionsContentPrompt,
    configContentPrompt,
    release,
  })
}

async function deployConfirmationPrompt({
  appTitle,
  extensionsContentPrompt: {extensionsInfoTable, deletedInfoTable},
  configContentPrompt: {configInfoTable, deletedInfoTable: configDeletedInfoTable},
  release,
}: DeployConfirmationPromptOptions): Promise<boolean> {
  const timeBeforeConfirmationMs = new Date().valueOf()
  let confirmationResponse = true

  let question = `Create a new version${appTitle ? ` of ${appTitle}` : ''}?`
  if (release) {
    question = `Release a new version${appTitle ? ` of ${appTitle}` : ''}?`
  }

  let finalDeletedInfoTable = deletedInfoTable ?? {header: '', items: [], bullet: '-'}
  if (configDeletedInfoTable && useVersionedAppConfig()) {
    finalDeletedInfoTable = {
      ...finalDeletedInfoTable,
      header: configDeletedInfoTable.header,
      items: [...finalDeletedInfoTable.items, ...configDeletedInfoTable.items],
    }
  }

  const infoTable = []
  if (
    useVersionedAppConfig() &&
    (extensionsInfoTable || finalDeletedInfoTable.header !== '' || configInfoTable.items.length > 0)
  ) {
    infoTable.push(
      configInfoTable.items.length === 0 ? {...configInfoTable, items: [{subdued: 'No changes'}]} : configInfoTable,
    )
  }
  if (extensionsInfoTable) infoTable.push(extensionsInfoTable)
  if (finalDeletedInfoTable.header !== '') infoTable.push(finalDeletedInfoTable)

  const isDangerous = appTitle !== undefined && deletedInfoTable

  if (isDangerous) {
    confirmationResponse = await renderDangerousConfirmationPrompt({
      message: question,
      infoTable,
      confirmation: appTitle,
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

async function buildExtensionsContentPrompt(extensionsContentBreakdown: ExtensionIdentifiersBreakdown) {
  const {fromDashboard, onlyRemote, toCreate: toCreateBreakdown, toUpdate} = extensionsContentBreakdown

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

  await metadata.addPublicMetadata(() => ({
    cmd_deploy_confirm_new_registrations: toCreateBreakdown.length,
    cmd_deploy_confirm_updated_registrations: toUpdate.length,
    cmd_deploy_confirm_removed_registrations: onlyRemote.length,
  }))

  return {extensionsInfoTable, deletedInfoTable}
}

async function buildConfigContentPrompt(
  release: boolean,
  configContentBreakdown?: ConfigExtensionIdentifiersBreakdown,
) {
  if (!configContentBreakdown)
    return {
      configInfoTable: {header: 'Configuration: ', items: []},
      deletedInfoTable: undefined,
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

  return {configInfoTable, deletedInfoTable}
}
