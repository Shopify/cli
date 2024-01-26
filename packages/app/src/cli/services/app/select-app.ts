import {GetConfig, GetConfigQuerySchema} from '../../api/graphql/get_config.js'
import {OrganizationApp} from '../../models/organization.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchPartnersSession} from '../context/partner-account-info.js'
import {fetchAppDetailsFromApiKey, fetchOrganizations, fetchOrgAndApps} from '../dev/fetch.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export async function selectApp(): Promise<OrganizationApp> {
  const partnersSession = await fetchPartnersSession()
  const orgs = await fetchOrganizations(partnersSession)
  const org = await selectOrganizationPrompt(orgs)
  const {apps} = await fetchOrgAndApps(org.id, partnersSession)
  const selectedAppApiKey = await selectAppPrompt(apps, org.id, partnersSession)
  const fullSelectedApp = await fetchAppDetailsFromApiKey(selectedAppApiKey, partnersSession.token)
  return fullSelectedApp!
}

export enum BetaFlag {
  VersionedAppConfig,
}

const FlagMap: {[key: string]: BetaFlag} = {
  versioned_app_config: BetaFlag.VersionedAppConfig,
}

export async function fetchAppRemoteBetaFlags(apiKey: string, token: string) {
  const defaultActiveBetas: BetaFlag[] = [BetaFlag.VersionedAppConfig]
  const queryResult: GetConfigQuerySchema = await partnersRequest(GetConfig, token, {apiKey})
  if (queryResult.app) {
    const {app} = queryResult
    const remoteDisabledFlags = app.disabledBetas.map((flag) => FlagMap[flag])
    return defaultActiveBetas.filter((beta) => !remoteDisabledFlags.includes(beta))
  } else {
    outputDebug("Couldn't find app for beta flags. Make sure you have a valid client ID.")
    return []
  }
}
