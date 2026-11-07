import {businessPlatformTokenRefreshHandler} from '../../services/store/business-platform.js'
import {StoreInfoDestinations} from '../../api/graphql/business-platform-destinations/generated/store-info-destinations.js'
import {StoreInfoOwningOrg} from '../../api/graphql/business-platform-destinations/generated/store-info-owning-org.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform, isServiceAccountTokenSet} from '@shopify/cli-kit/node/session'
import {numericIdFromEncodedGid} from '@shopify/cli-kit/common/gid'
import {extractHost} from '@shopify/cli-kit/common/url'
import {outputDebug} from '@shopify/cli-kit/node/output'
import type {
  StoreInfoDestinationsQuery,
  StoreInfoDestinationsQueryVariables,
} from '../../api/graphql/business-platform-destinations/generated/store-info-destinations.js'
import type {
  StoreInfoOwningOrgQuery,
  StoreInfoOwningOrgQueryVariables,
} from '../../api/graphql/business-platform-destinations/generated/store-info-owning-org.js'
import type {DestinationsContext, StoreLookupOrganization} from './types.js'
import type {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'

type DestinationNodeFromQuery = NonNullable<
  StoreInfoDestinationsQuery['currentUserAccount']
>['destinations']['nodes'][number]

interface FetchDestinationsContextOptions {
  store: string
  token?: string
  noPrompt?: boolean
}

export class StoreLookupStoreNotFoundError extends AbortError {}

export async function fetchDestinationsContext(options: FetchDestinationsContextOptions): Promise<DestinationsContext> {
  const token =
    options.token ??
    (await ensureAuthenticatedBusinessPlatform([], {noPrompt: options.noPrompt, allowAutomationToken: true}))
  const unauthorizedHandler = businessPlatformTokenRefreshHandler({noPrompt: options.noPrompt})

  // `options.store` is already a normalized FQDN; extractHost canonicalizes it (lowercased,
  // scheme/path stripped) so it lines up with the hosts BP returns.
  const targetHost = extractHost(options.store) ?? options.store.toLowerCase()

  // BP's destinations.search matches against handle/name, so search by the store's subdomain
  // handle (the first DNS label) rather than the full FQDN to widen the hit rate. Taking the
  // first label works across environments (myshopify.com, shopify.io, *.shop.dev); a fixed
  // `.myshopify.com` strip would leave local-dev FQDNs untouched.
  const subdomain = targetHost.split('.')[0] ?? targetHost

  const response = await businessPlatformRequestDoc<StoreInfoDestinationsQuery, StoreInfoDestinationsQueryVariables>({
    query: StoreInfoDestinations,
    token,
    variables: {search: subdomain},
    unauthorizedHandler,
  })

  const nodes = response.currentUserAccount?.destinations.nodes ?? []
  const matchedNode = nodes.find((node) => matchesStore(node, targetHost))

  if (!matchedNode) {
    throw new StoreLookupStoreNotFoundError(
      `Couldn't find a store with domain ${options.store} for the current account.`,
      storeNotFoundAdvice(),
    )
  }

  const owningOrg = await fetchOwningOrg(String(matchedNode.publicId), token, unauthorizedHandler)

  return {...(owningOrg ? {owningOrg} : {})}
}

// A token isn't "signed in", and the account behind it is a service account whose store access is set in the
// Shopify admin, so the advice names that instead of a login.
function storeNotFoundAdvice(): string {
  const domain = 'Check the domain (it must be the permanent `myshopify.com` domain)'
  if (isServiceAccountTokenSet()) {
    return `${domain} and that the service account has access to the store: it can open the stores it created, or any store in an organization where it has Dev store management access. Inactive stores aren't searchable.`
  }
  return `${domain} and that you're logged in to an account with access to the store. Inactive stores aren't searchable.`
}

async function fetchOwningOrg(
  destinationPublicId: string,
  token: string,
  unauthorizedHandler: UnauthorizedHandler,
): Promise<StoreLookupOrganization | undefined> {
  try {
    const orgResponse = await businessPlatformRequestDoc<StoreInfoOwningOrgQuery, StoreInfoOwningOrgQueryVariables>({
      query: StoreInfoOwningOrg,
      token,
      variables: {destinationPublicId},
      unauthorizedHandler,
    })
    const org = orgResponse.currentUserAccount?.organizationForDestination
    if (!org) {
      outputDebug(`No owning organization returned for destination ${destinationPublicId}.`)
      return undefined
    }
    const decodedId = org.id ? numericIdFromEncodedGid(org.id) : undefined
    return {name: org.name, ...(decodedId ? {id: decodedId} : {})}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`Failed to resolve owning organization: ${errorMessage(error)}`)
    return undefined
  }
}

function matchesStore(node: DestinationNodeFromQuery, targetHost: string): boolean {
  // BP returns URL strings (sometimes with scheme, sometimes bare) in primaryDomain/webUrl;
  // extract the hostname and compare against the already-canonicalized target host, so both
  // sides are in the same form regardless of suffix. We match on these rather than handle/name
  // because those are unreliable (often null or an abbreviation rather than the subdomain).
  return [node.primaryDomain, node.webUrl].some((value) => extractHost(value) === targetHost)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
