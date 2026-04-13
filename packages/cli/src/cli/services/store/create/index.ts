import {signupsRequest} from '@shopify/cli-kit/node/api/signups'
import {businessPlatformOrganizationsRequest} from '@shopify/cli-kit/node/api/business-platform'
import {
  ensureAuthenticatedSignups,
  ensureAuthenticatedAppManagementAndBusinessPlatform,
} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {networkInterfaces} from 'os'

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

// eslint-disable-next-line @shopify/cli/no-inline-graphql
const AppDevelopmentStoreCreateMutation = `
  mutation AppDevelopmentStoreCreate($shopInformation: AppDevelopmentStoreInput!) {
    appDevelopmentStoreCreate(shopInformation: $shopInformation) {
      permanentDomain
      loginUrl
      shopId
      userErrors { field message }
    }
  }
`

// eslint-disable-next-line @shopify/cli/no-inline-graphql
const CreateClientDevelopmentShopMutation = `
  mutation CreateClientDevelopmentShop($shopName: String!, $countryCode: String!) {
    createClientDevelopmentShop(shopName: $shopName, countryCode: $countryCode) {
      shopDomain
      shopAdminUrl
      userErrors { message field }
    }
  }
`

export interface StoreCreateInput {
  name?: string
  subdomain?: string
  country: string
  dev: boolean
  forClient: boolean
  org?: string
}

export interface StoreCreateResult {
  shopPermanentDomain: string
  polling: boolean
  shopLoginUrl: string | null
}

interface StoreCreateUserError {
  field: string[] | null
  message: string
}

export async function createStore(input: StoreCreateInput): Promise<StoreCreateResult> {
  if (input.forClient && input.dev) {
    throw new AbortError("The --for-client and --dev flags can't be used together.", 'Use one or the other.')
  }

  if (input.forClient && !input.org) {
    throw new AbortError(
      'The --org flag is required when creating a client transfer store.',
      'Provide your Partner organization ID with --org.',
    )
  }

  if ((input.dev || input.forClient) && input.subdomain) {
    throw new AbortError(
      `The --subdomain flag is not supported when creating a ${input.dev ? 'development' : 'client transfer'} store.`,
      `Remove --subdomain or remove --${input.dev ? 'dev' : 'for-client'}.`,
    )
  }

  if (input.forClient) {
    return createClientTransferStore(input)
  }

  const {token} = await ensureAuthenticatedSignups()

  if (input.dev) {
    return createDevStore(input, token)
  }
  return createTrialStore(input, token)
}

async function createTrialStore(input: StoreCreateInput, token: string): Promise<StoreCreateResult> {
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

async function createDevStore(input: StoreCreateInput, token: string): Promise<StoreCreateResult> {
  const variables = {
    shopInformation: {
      shopName: input.name ?? 'Dev Store',
      country: input.country,
      priceLookupKey: 'BASIC_APP_DEVELOPMENT',
      ipAddress: localIpAddress(),
      userAgent: 'Shopify CLI',
    },
  }

  outputDebug(outputContent`Calling Signups API AppDevelopmentStoreCreate with variables:
${outputToken.json(variables)}
`)

  const result = await signupsRequest<{appDevelopmentStoreCreate: AppDevStoreCreateMutationResult | null}>(
    AppDevelopmentStoreCreateMutation,
    token,
    variables,
  )

  if (!result.appDevelopmentStoreCreate) {
    throw new AbortError('Unexpected response from Signups API: appDevelopmentStoreCreate was null.')
  }

  throwOnUserErrors(result.appDevelopmentStoreCreate.userErrors)

  if (!result.appDevelopmentStoreCreate.permanentDomain) {
    throw new AbortError('Development store creation failed: no domain returned.')
  }

  outputDebug(
    outputContent`AppDevelopmentStoreCreate response: domain=${outputToken.raw(result.appDevelopmentStoreCreate.permanentDomain)}`,
  )

  return {
    shopPermanentDomain: result.appDevelopmentStoreCreate.permanentDomain,
    polling: false,
    shopLoginUrl: result.appDevelopmentStoreCreate.loginUrl,
  }
}

async function createClientTransferStore(input: StoreCreateInput): Promise<StoreCreateResult> {
  const {businessPlatformToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform()

  const variables = {
    shopName: input.name ?? 'Client Store',
    countryCode: input.country,
  }

  outputDebug(outputContent`Calling Organizations API CreateClientDevelopmentShop with variables:
${outputToken.json(variables)}
`)

  const result = await businessPlatformOrganizationsRequest<{
    createClientDevelopmentShop: ClientDevShopCreateMutationResult | null
  }>({
    query: CreateClientDevelopmentShopMutation,
    token: businessPlatformToken,
    organizationId: input.org!,
    unauthorizedHandler: {type: 'token_refresh', handler: async () => ({token: undefined})},
  })

  if (!result.createClientDevelopmentShop) {
    throw new AbortError('Unexpected response from Organizations API: createClientDevelopmentShop was null.')
  }

  throwOnUserErrors(result.createClientDevelopmentShop.userErrors ?? [])

  if (!result.createClientDevelopmentShop.shopDomain) {
    throw new AbortError('Client transfer store creation failed: no domain returned.')
  }

  outputDebug(
    outputContent`CreateClientDevelopmentShop response: domain=${outputToken.raw(result.createClientDevelopmentShop.shopDomain)}`,
  )

  return {
    shopPermanentDomain: result.createClientDevelopmentShop.shopDomain,
    polling: false,
    shopLoginUrl: result.createClientDevelopmentShop.shopAdminUrl,
  }
}

function throwOnUserErrors(userErrors: StoreCreateUserError[]): void {
  if (userErrors.length === 0) return
  const messages = userErrors
    .map((userError) => (userError.field ? `${userError.field.join('.')}: ${userError.message}` : userError.message))
    .join('\n')
  throw new AbortError(`Store creation failed:\n${messages}`)
}

function localIpAddress(): string {
  const interfaces = networkInterfaces()
  for (const addresses of Object.values(interfaces)) {
    if (!addresses) continue
    for (const addr of addresses) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address
      }
    }
  }
  return '127.0.0.1'
}

interface StoreCreateMutationResult {
  shopPermanentDomain: string | null
  polling: boolean | null
  shopLoginUrl: string | null
  userErrors: StoreCreateUserError[]
}

interface AppDevStoreCreateMutationResult {
  permanentDomain: string | null
  loginUrl: string | null
  shopId: string | null
  userErrors: StoreCreateUserError[]
}

interface ClientDevShopCreateMutationResult {
  shopDomain: string | null
  shopAdminUrl: string | null
  userErrors: StoreCreateUserError[] | null
}
