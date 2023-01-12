import {OrganizationApp} from '../../models/organization.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchAppFromApiKey, fetchOrganizations, fetchOrgAndApps} from '../dev/fetch.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

export async function selectApp(): Promise<OrganizationApp> {
  const token = await ensureAuthenticatedPartners()
  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  const {apps} = await fetchOrgAndApps(org.id, token)
  const selectedAppApiKey = await selectAppPrompt(apps, org.id, token)
  const fullSelectedApp = await fetchAppFromApiKey(selectedAppApiKey, token)
  return fullSelectedApp!
}
