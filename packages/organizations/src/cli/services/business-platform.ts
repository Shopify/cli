import {type Organization} from '../models/organization.js'
import {type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
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
 * Names the credential that was refused: the service account, a legacy automation token, or the logged-in user.
 */
export class OrganizationStoreAccessError extends AbortError {
  constructor(organization: Organization) {
    const where = ['in the Shopify admin under', {subdued: 'Settings > Users > Security'}]

    if (isServiceAccountTokenSet()) {
      super(`This service account can't manage dev stores in ${organization.businessName}.`, [
        'Give it',
        {bold: 'Dev store management'},
        'access',
        ...where,
        {char: ','},
        'or use a token from a service account that has it.',
      ])
    } else if (getAppAutomationToken()) {
      super(`This automation token can't manage dev stores in ${organization.businessName}.`, [
        'Store commands need a service account token with',
        {bold: 'Dev store management'},
        'access. Create one',
        ...where,
        'and set it in',
        {command: 'SHOPIFY_SERVICE_ACCOUNT_TOKEN'},
        {char: '.'},
      ])
    } else {
      super(
        `You don't have permission to manage dev stores in ${organization.businessName}.`,
        "Check that you're logged in to the right account, or ask an organization admin for access.",
      )
    }
  }
}

/**
 * Runs an Organizations API request for the organization, turning a refused request into an
 * `OrganizationStoreAccessError` so the user learns which access is missing rather than seeing the HTTP status.
 *
 * @param organization - The organization the request addresses.
 * @param request - The request to run.
 * @returns The request's result.
 */
export async function withOrganizationStoreAccess<T>(
  organization: Organization,
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (isOrganizationAccessError(error)) throw new OrganizationStoreAccessError(organization)
    throw error
  }
}
