import {buildDeployReleaseInfoTableSection} from './ui/deploy-release-info-table-section.js'
import metadata from '../metadata.js'
import {
  ConfigExtensionIdentifiersBreakdown,
  ExtensionIdentifierBreakdownInfo,
  ExtensionIdentifiersBreakdown,
} from '../services/context/breakdown-extensions.js'
import {
  InfoTableSection,
  renderConfirmationPrompt,
  renderDangerousConfirmationPrompt,
  isTTY,
} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'

interface DeployOrReleaseConfirmationPromptOptions {
  extensionIdentifiersBreakdown: ExtensionIdentifiersBreakdown
  configExtensionIdentifiersBreakdown?: ConfigExtensionIdentifiersBreakdown
  appTitle?: string
  release: boolean
  force: boolean
  /** If true, allow adding and updating extensions and configuration without user confirmation */
  allowUpdates?: boolean
  /** If true, allow removing extensions and configuration without user confirmation */
  allowDeletes?: boolean
  showConfig?: boolean
}

interface DeployConfirmationPromptOptions {
  appTitle?: string
  extensionsContentPrompt: {
    extensionsInfoTable?: InfoTableSection
    hasDeletedExtensions: boolean
  }
  configContentPrompt?: {
    configInfoTable: InfoTableSection
  }
  release: boolean
}

/**
 * Determines whether the confirmation prompt can be skipped based on the allow flags and change types.
 * Returns true if the prompt should be skipped, false if the prompt should be shown.
 * Throws an error if in non-TTY mode and there are changes that require confirmation.
 */
function shouldSkipConfirmationPrompt({
  force,
  allowUpdates,
  allowDeletes,
  extensionIdentifiersBreakdown,
  configExtensionIdentifiersBreakdown,
}: {
  force: boolean
  allowUpdates?: boolean
  allowDeletes?: boolean
  extensionIdentifiersBreakdown: ExtensionIdentifiersBreakdown
  configExtensionIdentifiersBreakdown?: ConfigExtensionIdentifiersBreakdown
}): boolean {
  // --force is equivalent to --allow-updates --allow-deletes
  if (force || (allowUpdates && allowDeletes)) return true

  const hasDeletedExtensions = extensionIdentifiersBreakdown.onlyRemote.length > 0
  const hasDeletedConfig = (configExtensionIdentifiersBreakdown?.deletedFieldNames.length ?? 0) > 0
  const hasDeletes = hasDeletedExtensions || hasDeletedConfig

  const hasNewOrUpdatedExtensions =
    extensionIdentifiersBreakdown.toCreate.length > 0 || extensionIdentifiersBreakdown.toUpdate.length > 0
  const hasNewOrUpdatedConfig =
    (configExtensionIdentifiersBreakdown?.newFieldNames.length ?? 0) > 0 ||
    (configExtensionIdentifiersBreakdown?.existingUpdatedFieldNames.length ?? 0) > 0
  const hasUpdates = hasNewOrUpdatedExtensions || hasNewOrUpdatedConfig

  // If we only have updates (no deletes) and allowUpdates is true, skip prompt
  if (allowUpdates && !hasDeletes) return true

  // If we only have deletes (no updates) and allowDeletes is true, skip prompt
  if (allowDeletes && !hasUpdates) return true

  // If we're in non-TTY mode and there are changes that require confirmation, throw an error
  if (!isTTY() && (hasDeletes || hasUpdates)) {
    throw new AbortError('This deployment includes changes that require confirmation.', [
      'Run the command with',
      {command: '--force'},
      'or',
      {command: '--allow-updates'},
      'or',
      {command: '--allow-deletes'},
      'to deploy without confirmation.',
    ])
  }

  return false
}

export async function deployOrReleaseConfirmationPrompt({
  force,
  allowUpdates,
  allowDeletes,
  extensionIdentifiersBreakdown,
  configExtensionIdentifiersBreakdown,
  appTitle,
  release,
}: DeployOrReleaseConfirmationPromptOptions): Promise<boolean> {
  await metadata.addPublicMetadata(() => buildConfigurationBreakdownMetadata(configExtensionIdentifiersBreakdown))

  const shouldSkip = shouldSkipConfirmationPrompt({
    force,
    allowUpdates,
    allowDeletes,
    extensionIdentifiersBreakdown,
    configExtensionIdentifiersBreakdown,
  })
  if (shouldSkip) return true

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
  extensionsContentPrompt: {extensionsInfoTable, hasDeletedExtensions},
  configContentPrompt,
  release,
}: DeployConfirmationPromptOptions): Promise<boolean> {
  const timeBeforeConfirmationMs = new Date().valueOf()
  let confirmationResponse = true

  const infoTable = []
  if (configContentPrompt) {
    infoTable.push(
      configContentPrompt.configInfoTable.items.length === 0
        ? {...configContentPrompt.configInfoTable, emptyItemsText: 'No changes', items: []}
        : configContentPrompt.configInfoTable,
    )
  }
  const isDangerous = appTitle !== undefined && hasDeletedExtensions
  if (extensionsInfoTable) {
    infoTable.push(
      isDangerous
        ? {...extensionsInfoTable, helperText: 'Removing extensions can permanently delete app user data'}
        : extensionsInfoTable,
    )
  } else {
    infoTable.push({header: 'Extensions:', emptyItemsText: 'None', items: []})
  }

  const question = `${release ? 'Release' : 'Create'} a new version${appTitle ? ` of ${appTitle}` : ''}?`
  if (isDangerous) {
    confirmationResponse = await renderDangerousConfirmationPrompt({
      message: question,
      infoTable,
      confirmation: appTitle,
    })
  } else {
    confirmationResponse = await renderConfirmationPrompt({
      message: question,
      infoTable,
      confirmationMessage: `Yes, ${release ? 'release' : 'create'} this new version`,
      cancellationMessage: 'No, cancel',
    })
  }

  const timeToConfirmOrCancelMs = new Date().valueOf() - timeBeforeConfirmationMs

  await metadata.addPublicMetadata(() => ({
    cmd_deploy_confirm_cancelled: !confirmationResponse,
    cmd_deploy_confirm_time_to_complete_ms: timeToConfirmOrCancelMs,
  }))

  return confirmationResponse
}

async function buildExtensionsContentPrompt(extensionsContentBreakdown: ExtensionIdentifiersBreakdown) {
  const {onlyRemote, toCreate: toCreateBreakdown, toUpdate, unchanged} = extensionsContentBreakdown

  const mapExtensionToInfoTableItem = (extension: ExtensionIdentifierBreakdownInfo, preffix: string) => {
    switch (extension.experience) {
      case 'dashboard':
        return [extension.title, {subdued: `(${preffix}from Partner Dashboard)`}]
      case 'extension':
        if (extension.uid && extension.uid.length > 0) {
          return `${extension.title} (uid: ${extension.uid})`
        } else {
          return extension.title
        }
    }
  }
  let extensionsInfoTable
  const section = {
    new: toCreateBreakdown.map((extension) => mapExtensionToInfoTableItem(extension, 'new, ')),
    unchanged: unchanged.map((extension) => mapExtensionToInfoTableItem(extension, '')),
    updated: toUpdate.map((extension) => mapExtensionToInfoTableItem(extension, 'updated, ')),
    removed: onlyRemote.map((extension) => mapExtensionToInfoTableItem(extension, 'removed, ')),
  }
  const extensionsInfo = buildDeployReleaseInfoTableSection(section)

  const hasDeletedExtensions = onlyRemote.length > 0
  if (extensionsInfo.length > 0) {
    extensionsInfoTable = {
      header: 'Extensions:',
      items: extensionsInfo,
    }
  }

  await metadata.addPublicMetadata(() => ({
    cmd_deploy_confirm_new_registrations: toCreateBreakdown.length,
    cmd_deploy_confirm_updated_registrations: toUpdate.length,
    cmd_deploy_confirm_removed_registrations: onlyRemote.length,
  }))

  return {extensionsInfoTable, hasDeletedExtensions}
}

async function buildConfigContentPrompt(
  release: boolean,
  configContentBreakdown?: ConfigExtensionIdentifiersBreakdown,
) {
  if (!configContentBreakdown) return

  const {existingFieldNames, existingUpdatedFieldNames, newFieldNames, deletedFieldNames} = configContentBreakdown

  const section = {
    new: newFieldNames,
    updated: existingUpdatedFieldNames,
    unchanged: existingFieldNames,
    removed: deletedFieldNames,
  }
  const configurationInfo = buildDeployReleaseInfoTableSection(section)

  const hasModifiedFields = newFieldNames.length > 0 || existingUpdatedFieldNames.length > 0
  const configInfoTable = {
    header: 'Configuration:',
    items: hasModifiedFields || deletedFieldNames.length > 0 || !release ? configurationInfo : [],
  }

  return {configInfoTable}
}

export function buildConfigurationBreakdownMetadata(
  configExtensionIdentifiersBreakdown?: ConfigExtensionIdentifiersBreakdown,
) {
  if (!configExtensionIdentifiersBreakdown) return {cmd_deploy_include_config_used: false}

  const {existingFieldNames, existingUpdatedFieldNames, newFieldNames, deletedFieldNames} =
    configExtensionIdentifiersBreakdown
  const currentConfiguration = [...existingUpdatedFieldNames, ...newFieldNames, ...existingFieldNames]
  return {
    cmd_deploy_include_config_used: true,
    ...(currentConfiguration.length > 0
      ? {cmd_deploy_config_modules_breakdown: JSON.stringify(currentConfiguration.sort())}
      : {}),
    ...(existingUpdatedFieldNames.length > 0
      ? {cmd_deploy_config_modules_updated: JSON.stringify(existingUpdatedFieldNames.sort())}
      : {}),
    ...(newFieldNames.length > 0 ? {cmd_deploy_config_modules_added: JSON.stringify(newFieldNames.sort())} : {}),
    ...(deletedFieldNames.length > 0
      ? {cmd_deploy_config_modules_deleted: JSON.stringify(deletedFieldNames.sort())}
      : {}),
  }
}
