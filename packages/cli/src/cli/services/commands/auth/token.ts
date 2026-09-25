import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {AbortError} from '@shopify/cli-kit/node/error'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'

export const authTokenJsonOutputSchema = defineJsonOutputSchema({
  name: 'AuthTokenResult',
  schema: zod.object({accessToken: zod.string()}),
})

export type AuthTokenResult = InferJsonOutputSchema<typeof authTokenJsonOutputSchema>

export async function getAuthToken({noPrompt}: {noPrompt: boolean}): Promise<AuthTokenResult> {
  if (getAppAutomationToken()) {
    throw new AbortError(
      'This prototype requires a signed-in Shopify account.',
      'Unset SHOPIFY_APP_AUTOMATION_TOKEN and SHOPIFY_CLI_PARTNERS_TOKEN, then run `shopify auth login`.',
    )
  }

  const {appManagementToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt})
  return {accessToken: appManagementToken}
}
