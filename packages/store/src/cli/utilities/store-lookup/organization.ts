import {fetchDestinationsContext} from './destinations.js'
import {
  fetchOrganizationsWithAccessInfo,
  selectOrg,
  selectOrganizationPrompt,
  type Organization,
} from '@shopify/organizations'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'

interface FindStoreOwningOrganizationOptions {
  store: string
  token?: string
  noPrompt?: boolean
}

export async function findStoreOwningOrganization(
  options: FindStoreOwningOrganizationOptions,
): Promise<Organization | undefined> {
  const {store} = options

  try {
    const destinationsContext = await fetchDestinationsContext(options)
    const owningOrganization = destinationsContext.owningOrg

    if (!owningOrganization?.id) {
      outputDebug(`Could not infer an owning organization ID for ${store}.`)
      return undefined
    }

    return {id: owningOrganization.id, businessName: owningOrganization.name}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`Could not infer the owning organization for ${store}: ${errorMessage(error)}`)
    return undefined
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function resolveOrganizationForStore(store: string, organizationId?: string): Promise<Organization> {
  if (organizationId) {
    return selectOrg(organizationId)
  }

  const canPrompt = terminalSupportsPrompting()
  const owningOrganization = await findStoreOwningOrganization({store, noPrompt: !canPrompt})
  if (owningOrganization) {
    return owningOrganization
  }

  // The destinations lookup only sees stores the account itself can open. A service account can open
  // only the stores it created, and a person may belong to the organization without a seat on the
  // store, so the lookup can miss a store the account is still allowed to manage. When the account
  // belongs to one organization, that's the one, the same way `store list` picks it.
  const token = await ensureAuthenticatedBusinessPlatform([], {noPrompt: !canPrompt, allowAutomationToken: true})
  const {organizations} = await fetchOrganizationsWithAccessInfo(token)
  if (organizations.length === 1) {
    outputDebug(`Using ${organizations[0]!.businessName}, the only organization the account belongs to, for ${store}.`)
    return organizations[0]!
  }
  if (organizations.length === 0) {
    throw new AbortError('No organizations found.', 'Make sure you have access to a Shopify organization.')
  }

  if (!canPrompt) {
    throw new AbortError(
      `Could not determine which organization owns ${store}.`,
      'Provide `--organization-id`, for example `--organization-id 1234567`. Run `shopify organization list` to find IDs.',
    )
  }

  // The developer only gave a store domain, so explain why they're suddenly being asked to
  // pick an organization. Echoing the domain back also makes a typo in it easy to spot.
  renderInfo({
    headline: `Could not determine which organization owns ${store}.`,
    body: ['Select one below, or specify it with', {command: '--organization-id'}, {char: '.'}],
  })

  return selectOrganizationPrompt(organizations)
}
