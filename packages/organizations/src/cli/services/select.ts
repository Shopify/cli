import {fetchOrganizations} from './fetch.js'
import {selectOrganizationPrompt} from '../prompts/organization.js'
import {Organization} from '../models/organization.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function selectOrg(orgIdFromFlag?: string): Promise<Organization> {
  const organizations = await fetchOrganizations()
  return selectOrganizationFromList(organizations, orgIdFromFlag)
}

export async function selectOrganizationFromList<T extends Organization>(
  organizations: T[],
  orgIdFromFlag?: string,
): Promise<T> {
  if (organizations.length === 0) {
    throw new AbortError('No organizations found.', 'Make sure you have access to a Shopify organization.')
  }

  if (orgIdFromFlag) {
    const org = organizations.find((org) => org.id === orgIdFromFlag)
    if (!org) {
      throw new AbortError(
        `Organization with ID ${orgIdFromFlag} not found.`,
        `Available organizations: ${organizations
          .map((organization) => `${organization.businessName} (${organization.id})`)
          .join(', ')}`,
      )
    }
    return org
  }

  return selectOrganizationPrompt(organizations)
}
