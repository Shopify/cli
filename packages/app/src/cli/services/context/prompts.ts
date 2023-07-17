import {LocalSource, RemoteSource} from './identifiers.js'
import {LocalRemoteSource} from './id-matching.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {DeploymentMode} from '../deploy/mode.js'
import {fetchActiveAppVersion} from '../dev/fetch.js'
import {
  InfoTableSection,
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderInfo,
} from '@shopify/cli-kit/node/ui'

export async function matchConfirmationPrompt(
  local: LocalSource,
  remote: RemoteSource,
  type: 'extension' | 'function' = 'extension',
) {
  return renderConfirmationPrompt({
    message: `Match ${local.configuration.name} (local name) with ${remote.title} (name on Shopify Partners, ID: ${remote.id})?`,
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
    message: `How would you like to deploy your "${localSource.configuration.name}"?`,
    choices: remoteOptions,
  })
  return remoteSourcesOfSameType.find((remote) => remote[remoteIdField] === uuid)!
}

interface SourceSummary {
  question: string
  identifiers: IdentifiersExtensions
  toCreate: LocalSource[]
  onlyRemote: RemoteSource[]
  dashboardOnly: RemoteSource[]
}

export async function deployConfirmationPrompt(
  {question, identifiers, toCreate, onlyRemote, dashboardOnly}: SourceSummary,
  deploymentMode: DeploymentMode,
  apiKey: string,
  token: string,
): Promise<boolean> {
  let infoTable: InfoTableSection[] = await buildUnifiedDeploymentInfoPrompt(
    apiKey,
    token,
    identifiers,
    toCreate,
    dashboardOnly,
    deploymentMode,
  )
  if (infoTable.length === 0) {
    infoTable = buildLegacyDeploymentInfoPrompt({identifiers, toCreate, onlyRemote, dashboardOnly})
  }

  if (infoTable.length === 0) {
    return true
  }

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

  return renderConfirmationPrompt({
    message: question,
    infoTable,
    confirmationMessage,
    cancellationMessage: 'No, cancel',
  })
}

function buildLegacyDeploymentInfoPrompt({
  identifiers,
  toCreate,
  onlyRemote,
  dashboardOnly,
}: Omit<SourceSummary, 'question'>) {
  const infoTable: InfoTableSection[] = []

  const included = [
    ...toCreate.map((source) => [source.localIdentifier, {subdued: '(new)'}]),
    ...Object.keys(identifiers),
    ...dashboardOnly.map((source) => [source.title, {subdued: '(from Partner Dashboard)'}]),
  ]

  if (included.length > 0) {
    infoTable.push({header: 'Includes:', items: included, bullet: '+'})
  }

  if (onlyRemote.length > 0) {
    infoTable.push({
      header: 'Removes:',
      items: onlyRemote.map((source) => source.title),
      bullet: '-',
      helperText: 'This can permanently delete app user data.',
    })
  }

  return infoTable
}

async function buildUnifiedDeploymentInfoPrompt(
  apiKey: string,
  token: string,
  localRegistration: IdentifiersExtensions,
  toCreate: LocalSource[],
  dashboardOnly: RemoteSource[],
  deploymentMode: DeploymentMode,
) {
  if (deploymentMode === 'legacy') return []

  const activeAppVersion = await fetchActiveAppVersion({token, apiKey})

  if (!activeAppVersion.app.activeAppVersion) return []

  const infoTable: InfoTableSection[] = []

  const nonDashboardRemoteRegistrations = activeAppVersion.app.activeAppVersion.appModuleVersions
    .filter((module) => !module.specification || module.specification.options.managementExperience !== 'dashboard')
    .map((remoteRegistration) => remoteRegistration.registrationUuid)

  let toCreateFinal: string[] = []
  const toUpdate: string[] = []
  let dashboardOnlyFinal = dashboardOnly
  for (const [identifier, uuid] of Object.entries(localRegistration)) {
    if (nonDashboardRemoteRegistrations.includes(uuid)) {
      toUpdate.push(identifier)
    } else {
      toCreateFinal.push(identifier)
    }

    dashboardOnlyFinal = dashboardOnlyFinal.filter((dashboardOnly) => dashboardOnly.uuid !== uuid)
  }

  toCreateFinal = Array.from(new Set(toCreateFinal.concat(toCreate.map((source) => source.localIdentifier))))
  const included = [
    ...toCreateFinal.map((identifier) => [identifier, {subdued: '(new)'}]),
    ...toUpdate,
    ...dashboardOnlyFinal.map((source) => [source.title, {subdued: '(from Partner Dashboard)'}]),
  ]
  if (included.length > 0) {
    infoTable.push({header: 'Includes:', items: included, bullet: '+'})
  }

  const localRegistrationAndDashboard = [
    ...Object.values(localRegistration),
    ...dashboardOnly.map((source) => source.uuid),
  ]
  const onlyRemote = activeAppVersion.app.activeAppVersion.appModuleVersions
    .filter((module) => !localRegistrationAndDashboard.includes(module.registrationUuid))
    .map((module) => module.registrationTitle)
  if (onlyRemote.length > 0) {
    const missingLocallySection: InfoTableSection = {
      header: 'Removes:',
      helperText: 'This can permanently delete app user data.',
      items: onlyRemote,
      bullet: '-',
    }

    infoTable.push(missingLocallySection)
  }

  return infoTable
}

export async function extensionMigrationPrompt(
  toMigrate: LocalRemoteSource[],
  includeRemoteType = true,
): Promise<boolean> {
  const migrationNames = toMigrate.map(({local}) => `"${local.configuration.name}"`).join(', ')
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
