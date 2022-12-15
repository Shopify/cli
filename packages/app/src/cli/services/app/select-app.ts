import {OrganizationApp} from '../../models/organization.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchAppFromApiKey, fetchOrganizations, fetchOrgAndApps} from '../dev/fetch.js'
import {session} from '@shopify/cli-kit'

export async function selectApp(): Promise<OrganizationApp> {
  const token = await session.ensureAuthenticatedPartners()
  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  const {apps} = await fetchOrgAndApps(org.id, token)
  const selectedApp = await selectAppPrompt(apps, org.id, token)
  const fullSelectedApp = await fetchAppFromApiKey(selectedApp.apiKey, token)
  return fullSelectedApp!
}
