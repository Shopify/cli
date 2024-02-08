import {OrganizationApp} from '../../models/organization.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchPartnersSession} from '../context/partner-account-info.js'
import {fetchAppDetailsFromApiKey, fetchOrganizations, fetchOrgAndApps, fetchActiveAppVersion} from '../dev/fetch.js'
import {FindAppQuery, FindAppQuerySchema} from '../../api/graphql/find_app.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {AppModuleVersion} from '../../api/graphql/app_active_version.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
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

export enum BetaFlag {}

const FlagMap: {[key: string]: BetaFlag} = {}

export async function fetchAppRemoteBetaFlags(apiKey: string, token: string) {
  const defaultActiveBetas: BetaFlag[] = []
  const queryResult: FindAppQuerySchema = await partnersRequest(FindAppQuery, token, {apiKey})
  if (queryResult.app) {
    const {app} = queryResult
    const remoteDisabledFlags = app.disabledBetas.map((flag) => FlagMap[flag])
    return defaultActiveBetas.filter((beta) => !remoteDisabledFlags.includes(beta))
  } else {
    outputDebug("Couldn't find app for beta flags. Make sure you have a valid client ID.")
    return []
  }
}

export async function fetchAppRemoteConfiguration(
  apiKey: string,
  token: string,
  specifications: ExtensionSpecification[],
) {
  const activeAppVersion = await fetchActiveAppVersion({token, apiKey})
  const appModuleVersionsConfig =
    activeAppVersion.app.activeAppVersion?.appModuleVersions.filter(
      (module) => module.specification?.experience === 'configuration',
    ) || []
  return remoteAppConfigurationExtensionContent(appModuleVersionsConfig, specifications)
}

export function remoteAppConfigurationExtensionContent(
  configRegistrations: AppModuleVersion[],
  specifications: ExtensionSpecification[],
) {
  let remoteAppConfig: {[key: string]: unknown} = {}
  const configSpecifications = specifications.filter((spec) => spec.experience === 'configuration')
  configRegistrations.forEach((module) => {
    const configSpec = configSpecifications.find((spec) => spec.identifier === module.type.toLowerCase())
    if (!configSpec) return
    const configString = module.config
    if (!configString) return
    const config = configString ? JSON.parse(configString) : {}

    remoteAppConfig = deepMergeObjects(remoteAppConfig, configSpec.reverseTransform?.(config) ?? config)
  })
  return {...remoteAppConfig}
}
