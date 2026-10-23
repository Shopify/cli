import {
  businessPlatformOrganizationsRequestDoc,
  type BusinessPlatformOrganizationsRequestOptions,
} from '@shopify/cli-kit/node/api/business-platform'
import {type GraphQLVariables, type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'

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
 * Sends a store command's request to the Business Platform Organizations API.
 *
 * With an automation token, the Organizations API answers 401 when the token has no store management scope. The
 * token exchange still succeeds, because the CLI requests no explicit scopes, so a 401 that persists after the
 * refresh retry means the token's service account doesn't have Dev store management. Expired, revoked and invalid
 * tokens fail earlier, at the token exchange. This turns that 401 into an explanation instead of a raw GraphQL error.
 *
 * @param options - The options for the request.
 * @returns The response of the query.
 */
export async function storeManagementRequestDoc<TResult, TVariables extends GraphQLVariables>(
  options: BusinessPlatformOrganizationsRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  try {
    return await businessPlatformOrganizationsRequestDoc(options)
  } catch (error) {
    if (isUnauthorizedResponse(error) && getAppAutomationToken()) {
      throw new AbortError(
        "This token can't manage dev stores.",
        "Use a token from a service account with Dev store management. You can create one in your organization's settings in the Shopify admin.",
      )
    }
    throw error
  }
}

// Matched structurally, like the store package's Admin API error checks, so this module doesn't import graphql-request.
function isUnauthorizedResponse(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as {response?: {status?: unknown}}).response
  return typeof response === 'object' && response !== null && response.status === 401
}
