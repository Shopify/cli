import {MinimalOrganizationApp, OrganizationApp} from '../../models/organization.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {BetaFlag, fetchOrganizations} from '../dev/fetch.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {SpecsAppConfiguration} from '../../models/extensions/specifications/types/app_config.js'
import {
  AppModuleVersion,
  DeveloperPlatformClient,
  selectDeveloperPlatformClient,
} from '../../utilities/developer-platform-client.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'

export async function selectApp(): Promise<OrganizationApp> {
  const developerPlatformClient = selectDeveloperPlatformClient()
  const orgs = await fetchOrganizations(developerPlatformClient)
  const org = await selectOrganizationPrompt(orgs)
  const {apps, hasMorePages} = await developerPlatformClient.appsForOrg(org.id)
  const selectedAppApiKey = await selectAppPrompt(apps, hasMorePages, org.id, {developerPlatformClient})
  const selectedApp = apps.find((app) => app.apiKey === selectedAppApiKey)!
  const fullSelectedApp = await developerPlatformClient.appFromId(selectedApp)
  return fullSelectedApp!
}

export async function fetchAppRemoteConfiguration(
  remoteApp: MinimalOrganizationApp,
  developerPlatformClient: DeveloperPlatformClient,
  specifications: ExtensionSpecification[],
  betas: BetaFlag[],
) {
  const activeAppVersion = await developerPlatformClient.activeAppVersion(remoteApp)
  const appModuleVersionsConfig =
    activeAppVersion?.appModuleVersions.filter((module) => module.specification?.experience === 'configuration') || []
  return remoteAppConfigurationExtensionContent(
    appModuleVersionsConfig,
    specifications,
    betas,
  ) as unknown as SpecsAppConfiguration
}

export function remoteAppConfigurationExtensionContent(
  configRegistrations: AppModuleVersion[],
  specifications: ExtensionSpecification[],
  betas: BetaFlag[],
) {
  let remoteAppConfig: {[key: string]: unknown} = {}
  const configSpecifications = specifications.filter((spec) => spec.experience === 'configuration')
  configRegistrations.forEach((module) => {
    const configSpec = configSpecifications.find(
      (spec) => spec.identifier === module.specification?.identifier.toLowerCase(),
    )
    if (!configSpec) return
    const config = module.config
    if (!config) return

    remoteAppConfig = deepMergeObjects(remoteAppConfig, configSpec.reverseTransform?.(config, {betas}) ?? config)
  })
  return {...remoteAppConfig}
}
