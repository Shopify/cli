import {type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'

interface BusinessPlatformTokenRefreshHandlerOptions {
  noPrompt?: boolean
}

export function businessPlatformTokenRefreshHandler(
  options: BusinessPlatformTokenRefreshHandlerOptions = {},
): UnauthorizedHandler {
  return {
    type: 'token_refresh',
    handler: async () => ({token: await refreshBusinessPlatformToken(options)}),
  }
}

async function refreshBusinessPlatformToken(options: BusinessPlatformTokenRefreshHandlerOptions): Promise<string> {
  return ensureAuthenticatedBusinessPlatform([], {noPrompt: options.noPrompt})
}
