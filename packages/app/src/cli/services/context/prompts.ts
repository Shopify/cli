import {EnsureDeploymentIdsPresenceOptions, LocalSource, RemoteSource} from './identifiers.js'
import {LocalRemoteSource} from './id-matching.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {DeploymentMode} from '../deploy/mode.js'
import {fetchActiveAppVersion} from '../dev/fetch.js'
import metadata from '../../metadata.js'
import {AppInterface} from '../../models/app/app.js'
import {isAppConfigSpecification} from '../../models/extensions/app-config.js'
import {
  InfoTableSection,
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderDangerousConfirmationPrompt,
  renderInfo,
} from '@shopify/cli-kit/node/ui'

export async function matchConfirmationPrompt(
  local: LocalSource,
  remote: RemoteSource,
  type: 'extension' | 'function' = 'extension',
) {
  return renderConfirmationPrompt({
    message: `Match ${local.handle} (local name) with ${remote.title} (name on Shopify Partners, ID: ${remote.id})?`,
    confirmationMessage: `Yes, match to existing ${type}`,
    cancellationMessage: `No, create as a new ${type}`,
  })
}

export async function selectRemoteSourcePrompt(
  localSource: LocalSource,
  remoteSourcesOfSameType: RemoteSource[],
  remoteIdField: 'id' | 'uuid',
): Promise<RemoteSource> {
  const remoteOptions = remoteSourcesOfSameType.map((remote) => ({
    label: `Match it to ${remote.title} (ID: ${remote.id} on Shopify Partners)`,
    value: remote[remoteIdField],
  }))
  remoteOptions.push({label: 'Create new extension', value: 'create'})
  const uuid = await renderAutocompletePrompt({
    message: `How would you like to deploy your "${localSource.handle}"?`,
    choices: remoteOptions,
  })
  return remoteSourcesOfSameType.find((remote) => remote[remoteIdField] === uuid)!
}

export interface SourceSummary {
  appTitle: string | undefined
  question: string
  identifiers: IdentifiersExtensions
  toCreate: LocalSource[]
  onlyRemote: RemoteSource[]
  dashboardOnly: RemoteSource[]
}

export async function deployConfirmationPrompt(
  {appTitle, question, identifiers, toCreate, onlyRemote, dashboardOnly}: SourceSummary,
  {
    deploymentMode,
    appId: apiKey,
    token,
    app,
  }: Pick<EnsureDeploymentIdsPresenceOptions, 'app' | 'appId' | 'deploymentMode' | 'token'>,
): Promise<boolean> {
  let {infoTable, removesExtension}: {infoTable: InfoTableSection[]; removesExtension: boolean} =
    await buildUnifiedDeploymentInfoPrompt(
      apiKey,
      token,
      identifiers,
      // Filter out app config extensions in the prompt
      toCreate.filter((extension) => !extension.isConfigExtension),
      dashboardOnly,
      deploymentMode,
      app,
    )
  if (infoTable.length === 0 && deploymentMode === 'legacy') {
    ;({infoTable, removesExtension} = buildLegacyDeploymentInfoPrompt({
      identifiers,
      toCreate,
      onlyRemote,
      dashboardOnly,
    }))
  }

  const canSkipConfirmation = infoTable.length === 0 && deploymentMode === 'legacy'
  const timeBeforeConfirmationMs = new Date().valueOf()
  let confirmationResponse = true

  if (!canSkipConfirmation) {
    const appExists = Boolean(appTitle)
    const isDangerous = appExists && removesExtension && deploymentMode === 'unified'

    if (isDangerous) {
      confirmationResponse = await renderDangerousConfirmationPrompt({
        message: question,
        infoTable,
        confirmation: appTitle!,
      })
    } else {
      const confirmationMessage = (() => {
        switch (deploymentMode) {
          case 'legacy':
            return 'Yes, deploy to push changes'
          case 'unified':
            return 'Yes, release this new version'
          case 'unified-skip-release':
            return 'Yes, create this new version'
        }
      })()

      confirmationResponse = await renderConfirmationPrompt({
        message: question,
        infoTable,
        confirmationMessage,
        cancellationMessage: 'No, cancel',
      })
    }
  }

  const timeToConfirmOrCancelMs = new Date().valueOf() - timeBeforeConfirmationMs

  await metadata.addPublicMetadata(() => ({
    cmd_deploy_confirm_cancelled: !confirmationResponse,
    cmd_deploy_confirm_time_to_complete_ms: timeBeforeConfirmationMs,
  }))

  return confirmationResponse
}

function buildLegacyDeploymentInfoPrompt({
  identifiers,
  toCreate,
  onlyRemote,
  dashboardOnly,
}: Omit<SourceSummary, 'appTitle' | 'question'>) {
  const infoTable: InfoTableSection[] = []

  const included = [
    ...toCreate.map((source) => [source.localIdentifier, {subdued: '(new)'}]),
    ...Object.keys(identifiers),
    ...dashboardOnly.map((source) => [source.title, {subdued: '(from Partner Dashboard)'}]),
  ]

  if (included.length > 0) {
    infoTable.push({header: 'Includes:', items: included, bullet: '+'})
  }

  const removesExtension = onlyRemote.length > 0
  if (removesExtension) {
    infoTable.push({
      header: 'Removes:',
      items: onlyRemote.map((source) => source.title),
      bullet: '-',
      helperText: 'This can permanently delete app user data.',
    })
  }

  return {infoTable, removesExtension}
}

async function getUnifiedDeploymentInfoBreakdown(
  apiKey: string,
  token: string,
  localRegistration: IdentifiersExtensions,
  toCreate: LocalSource[],
  dashboardOnly: RemoteSource[],
  deploymentMode: DeploymentMode,
  app: AppInterface,
): Promise<{
  toCreate: string[]
  toUpdate: string[]
  fromDashboard: string[]
  onlyRemote: string[]
} | null> {
  if (deploymentMode === 'legacy') return null

  const activeAppVersion = await fetchActiveAppVersion({token, apiKey})

  const nonDashboardRemoteRegistrations =
    activeAppVersion.app.activeAppVersion?.appModuleVersions
      .filter((module) => !module.specification || module.specification.options.managementExperience !== 'dashboard')
      .map((remoteRegistration) => remoteRegistration.registrationUuid) ?? []

  let toCreateFinal: string[] = []
  const toUpdate: string[] = []
  let dashboardOnlyFinal = dashboardOnly

  for (const [identifier, uuid] of Object.entries(localRegistration)) {
    // Filter out app config extensions in the prompt
    const localExtension = app.allExtensions.find((extension) => {
      return extension.localIdentifier === identifier
    })
    const shouldExclude =
      localExtension?.specification.identifier &&
      isAppConfigSpecification(app, localExtension?.specification.identifier)

    if (!shouldExclude) {
      if (nonDashboardRemoteRegistrations.includes(uuid)) {
        toUpdate.push(identifier)
      } else {
        toCreateFinal.push(identifier)
      }
    }

    dashboardOnlyFinal = dashboardOnlyFinal.filter((dashboardOnly) => dashboardOnly.uuid !== uuid)
  }

  toCreateFinal = Array.from(new Set(toCreateFinal.concat(toCreate.map((source) => source.localIdentifier))))

  const localRegistrationAndDashboard = [
    ...Object.values(localRegistration),
    ...dashboardOnly.map((source) => source.uuid),
  ]
  const onlyRemote =
    activeAppVersion.app.activeAppVersion?.appModuleVersions
      .filter((module) => !localRegistrationAndDashboard.includes(module.registrationUuid))
      // Filter out app config extensions in the prompts
      .filter((module) => !isAppConfigSpecification(app, module.specification.identifier))
      .map((module) => module.registrationTitle) ?? []

  return {
    onlyRemote,
    toCreate: toCreateFinal.map((identifier) => identifier),
    toUpdate,
    fromDashboard: dashboardOnlyFinal.map((source) => source.title),
  }
}

async function buildUnifiedDeploymentInfoPrompt(
  apiKey: string,
  token: string,
  localRegistration: IdentifiersExtensions,
  toCreate: LocalSource[],
  dashboardOnly: RemoteSource[],
  deploymentMode: DeploymentMode,
  app: AppInterface,
) {
  const breakdown = await getUnifiedDeploymentInfoBreakdown(
    apiKey,
    token,
    localRegistration,
    toCreate,
    dashboardOnly,
    deploymentMode,
    app,
  )
  if (breakdown === null) return {infoTable: [], removesExtension: false}

  const {fromDashboard, onlyRemote, toCreate: toCreateBreakdown, toUpdate} = breakdown

  await metadata.addPublicMetadata(() => ({
    cmd_deploy_confirm_new_registrations: toCreateBreakdown.length,
    cmd_deploy_confirm_updated_registrations: toUpdate.length,
    cmd_deploy_confirm_removed_registrations: onlyRemote.length,
  }))

  const infoTable: InfoTableSection[] = []

  const included = [
    ...toCreateBreakdown.map((identifier) => [identifier, {subdued: '(new)'}]),
    ...toUpdate,
    ...fromDashboard.map((sourceTitle) => [sourceTitle, {subdued: '(from Partner Dashboard)'}]),
  ]

  if (included.length > 0) {
    infoTable.push({header: 'Includes:', items: included, bullet: '+'})
  }

  const removesExtension = onlyRemote.length > 0
  if (removesExtension) {
    const missingLocallySection: InfoTableSection = {
      header: 'Removes:',
      helperText: 'This can permanently delete app user data.',
      items: onlyRemote,
      bullet: '-',
    }

    infoTable.push(missingLocallySection)
  }

  return {infoTable, removesExtension}
}

export async function extensionMigrationPrompt(
  toMigrate: LocalRemoteSource[],
  includeRemoteType = true,
): Promise<boolean> {
  const migrationNames = toMigrate.map(({local}) => `"${local.handle}"`).join(', ')
  const allMigrationTypes = toMigrate.map(({remote}) => remote.type.toLocaleLowerCase())
  const uniqueMigrationTypes = allMigrationTypes
    .filter((type, i) => allMigrationTypes.indexOf(type) === i)
    .map((name) => `"${name}"`)
    .join(', ')

  renderInfo({
    headline: "Extension migrations can't be undone.",
    body: `Your ${migrationNames} configuration has been updated. Migrating gives you access to new features and won't impact the end user experience. All previous extension versions will reflect this change.`,
  })

  const confirmMessage = includeRemoteType
    ? `Yes, confirm migration from ${uniqueMigrationTypes}`
    : 'Yes, confirm migration'

  return renderConfirmationPrompt({
    message: `Migrate ${migrationNames}?`,
    confirmationMessage: confirmMessage,
    cancellationMessage: 'No, cancel',
  })
}
