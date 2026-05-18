import {signupsRequest} from '@shopify/cli-kit/node/api/signups'
import {ensureAuthenticatedSignups} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
const StoreCreateMutation = `
  mutation StoreCreate($signup: ShopInput!) {
    storeCreate(signup: $signup) {
      shopPermanentDomain
      polling
      shopLoginUrl
      userErrors { field message }
    }
  }
`

interface StoreCreateInput {
  name?: string
  subdomain?: string
  country: string
}

interface StoreCreateResult {
  shopPermanentDomain: string
  polling: boolean
  shopLoginUrl: string | null
}

interface StoreCreateUserError {
  field: string[] | null
  message: string
}

export async function createStore(input: StoreCreateInput): Promise<StoreCreateResult> {
  const {token} = await ensureAuthenticatedSignups()

  const variables = {
    signup: {
      country: input.country,
      ...(input.name ? {shopName: input.name} : {}),
      ...(input.subdomain ? {subdomain: input.subdomain} : {}),
    },
  }

  outputDebug(outputContent`Calling Signups API StoreCreate with variables:
${outputToken.json(variables)}
`)

  const result = await signupsRequest<{storeCreate: StoreCreateMutationResult | null}>(
    StoreCreateMutation,
    token,
    variables,
  )

  if (!result.storeCreate) {
    throw new AbortError('Unexpected response from Signups API: storeCreate was null.')
  }

  throwOnUserErrors(result.storeCreate.userErrors)

  if (!result.storeCreate.shopPermanentDomain) {
    throw new AbortError('Store creation failed: no domain returned.')
  }

  outputDebug(
    outputContent`StoreCreate response: domain=${outputToken.raw(result.storeCreate.shopPermanentDomain)} polling=${outputToken.raw(String(result.storeCreate.polling))}`,
  )

  return {
    shopPermanentDomain: result.storeCreate.shopPermanentDomain,
    polling: result.storeCreate.polling ?? false,
    shopLoginUrl: result.storeCreate.shopLoginUrl,
  }
}

function throwOnUserErrors(userErrors: StoreCreateUserError[]): void {
  if (userErrors.length === 0) return
  const messages = userErrors
    .map((userError) => (userError.field ? `${userError.field.join('.')}: ${userError.message}` : userError.message))
    .join('\n')
  throw new AbortError(`Store creation failed:\n${messages}`)
}

interface StoreCreateMutationResult {
  shopPermanentDomain: string | null
  polling: boolean | null
  shopLoginUrl: string | null
  userErrors: StoreCreateUserError[]
}
