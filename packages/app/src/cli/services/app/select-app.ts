import {OrganizationApp} from '../../models/organization.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchPartnersSession} from '../context/partner-account-info.js'
import {
  fetchAppDetailsFromApiKey,
  fetchOrganizations,
  fetchOrgAndApps,
  fetchActiveAppVersion,
  BetaFlag,
} from '../dev/fetch.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {AppModuleVersion} from '../../api/graphql/app_active_version.js'
import {buildSpecsAppConfiguration} from '../../models/app/app.js'
import {SpecsAppConfiguration} from '../../models/extensions/specifications/types/app_config.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'

export async function selectApp(): Promise<OrganizationApp> {
  const partnersSession = await fetchPartnersSession()
  const orgs = await fetchOrganizations(partnersSession)
  const org = await selectOrganizationPrompt(orgs)
  const {apps} = await fetchOrgAndApps(org.id, partnersSession)
  const selectedAppApiKey = await selectAppPrompt(apps, org.id, partnersSession)
  const fullSelectedApp = await fetchAppDetailsFromApiKey(selectedAppApiKey, partnersSession.token)
  return fullSelectedApp!
}

export async function fetchAppRemoteConfiguration(
  apiKey: string,
  token: string,
  specifications: ExtensionSpecification[],
  betas: BetaFlag[],
) {
  const activeAppVersion = await fetchActiveAppVersion({token, apiKey})
  const appModuleVersionsConfig =
    activeAppVersion.app.activeAppVersion?.appModuleVersions.filter(
      (module) => module.specification?.experience === 'configuration',
    ) || []
  const remoteAppConfiguration = remoteAppConfigurationExtensionContent(appModuleVersionsConfig, specifications, betas)
  return buildSpecsAppConfiguration(remoteAppConfiguration) as SpecsAppConfiguration
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
    const configString = module.config
    if (!configString) return
    const config = configString ? JSON.parse(configString) : {}

    remoteAppConfig = deepMergeObjects(remoteAppConfig, configSpec.reverseTransform?.(config, {betas}) ?? config)
  })
  return {...remoteAppConfig}
}
