import {
  businessPlatformOrganizationsRequestDoc,
  type BusinessPlatformOrganizationsRequestOptions,
} from '@shopify/cli-kit/node/api/business-platform'
import {type GraphQLVariables, type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedBusinessPlatform, isServiceAccountTokenSet} from '@shopify/cli-kit/node/session'

interface BusinessPlatformTokenRefreshHandlerOptions {
  noPrompt?: boolean
}

export function businessPlatformTokenRefreshHandler(
  options: BusinessPlatformTokenRefreshHandlerOptions = {},
): UnauthorizedHandler {
  return {
    type: 'token_refresh',
    handler: async () => ({
      token: await ensureAuthenticatedBusinessPlatform([], {noPrompt: options.noPrompt, allowAutomationToken: true}),
    }),
  }
}

/**
 * The organization a request addresses. The name is optional because some callers only know the ID.
 */
export interface OrganizationReference {
  id: string
  businessName?: string
}

/**
 * Whether the Organizations API refused a request because the account can't act in the organization.
 *
 * Business Platform answers 401 when the token holds no organization scope at all (a service account without dev
 * store access, or an app automation token) and 403 when the account lacks the permission. By the time the error
 * reaches a command, cli-kit has wrapped it with a `statusCode`; a raw graphql-request error, which carries the
 * status on its response, is recognised too.
 *
 * @param error - The error a Business Platform Organizations API request rejected with.
 * @returns True when the account was refused access to the organization.
 */
export function isOrganizationAccessError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const {statusCode, response} = error as {statusCode?: unknown; response?: {status?: unknown}}
  const status = statusCode ?? response?.status
  return status === 401 || status === 403
}

/**
 * The error to show when the Organizations API refused access to an organization's stores.
 *
 * Names the credential that was refused (the service account, a legacy automation token, or the logged-in user) and
 * puts the way to fix it in `nextSteps`, which both the terminal banner and the store commands' `--json` output show.
 */
export class OrganizationStoreAccessError extends AbortError {
  constructor(organization: OrganizationReference) {
    const name = organization.businessName ?? `organization ${organization.id}`
    const where = 'in the Shopify admin under Settings > Users > Security'

    if (isServiceAccountTokenSet()) {
      super(`This service account can't manage dev stores in ${name}.`, null, [
        `Give the service account Dev store management access ${where}.`,
        'Or use a token from a service account that has that access.',
      ])
    } else if (getAppAutomationToken()) {
      super(`This automation token can't manage dev stores in ${name}.`, null, [
        `Create a service account with Dev store management access ${where}.`,
        'Set its token in the SHOPIFY_SERVICE_ACCOUNT_TOKEN environment variable.',
      ])
    } else {
      super(`You don't have permission to manage dev stores in ${name}.`, null, [
        "Check that you're logged in to the right account.",
        'Or ask an organization admin for access.',
      ])
    }
  }
}

/**
 * Runs a Business Platform Organizations API request against an organization's stores.
 *
 * Every Organizations API request the store commands make goes through here, so a token that can't act in the
 * organization gets the same `OrganizationStoreAccessError` from every command, instead of each call site having to
 * remember to translate the HTTP status.
 *
 * @param organization - The organization the request addresses.
 * @param options - The request, without the organization ID, which comes from `organization`.
 * @returns The response of the query.
 */
export async function organizationStoresRequestDoc<TResult, TVariables extends GraphQLVariables>(
  organization: OrganizationReference,
  options: Omit<BusinessPlatformOrganizationsRequestOptions<TResult, TVariables>, 'organizationId'>,
): Promise<TResult> {
  try {
    return await businessPlatformOrganizationsRequestDoc({...options, organizationId: organization.id})
  } catch (error) {
    if (isOrganizationAccessError(error)) throw new OrganizationStoreAccessError(organization)
    throw error
  }
}
