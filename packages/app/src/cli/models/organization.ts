import {AppConfigurationUsedByCli} from './extensions/specifications/types/app_config.js'
import {Flag, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {
  Organization as BaseOrganization,
  type OrganizationWithDetails as BaseOrganizationWithDetails,
} from '@shopify/organizations'
import {getEnvironmentVariables} from '@shopify/cli-kit/node/environment'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'

export enum OrganizationSource {
  Partners = 'Partners',
  BusinessPlatform = 'BusinessPlatform',
}

export interface Organization extends BaseOrganization {
  source: OrganizationSource
}

/**
 * Organization returned by the destinations fetch, including the public fields the API returns
 * without an extra request.
 */
export interface OrganizationWithDetails extends Organization, BaseOrganizationWithDetails {}

export interface MinimalAppIdentifiers {
  apiKey: string
  organizationId: string
  id: string
}

export type MinimalOrganizationApp = MinimalAppIdentifiers & {
  title: string
}

export type OrganizationApp = MinimalOrganizationApp & {
  apiSecretKeys: {
    secret: string
  }[]
  appType?: string
  newApp?: boolean
  grantedScopes: string[]
  developmentStorePreviewEnabled?: boolean
  applicationUrl?: string
  redirectUrlWhitelist?: string[]
  requestedAccessScopes?: string[]
  webhookApiVersion?: string
  embedded?: boolean
  posEmbedded?: boolean
  preferencesUrl?: string
  gdprWebhooks?: {
    customerDeletionUrl?: string
    customerDataRequestUrl?: string
    shopDeletionUrl?: string
  }
  appProxy?: {
    subPath: string
    subPathPrefix: string
    url: string
  }
  configuration?: AppConfigurationUsedByCli
  flags: Flag[]
  developerPlatformClient: DeveloperPlatformClient
}

type AppWithClientSecrets = Pick<OrganizationApp, 'apiKey' | 'apiSecretKeys' | 'developerPlatformClient'>

const developerDashboardUrl = 'https://dev.shopify.com'

const automationTokenVariables = [
  'SHOPIFY_SERVICE_ACCOUNT_TOKEN',
  'SHOPIFY_APP_AUTOMATION_TOKEN',
  'SHOPIFY_CLI_PARTNERS_TOKEN',
]

/**
 * Fetches the app's client secret for commands that authenticate as the app.
 *
 * App lookups don't include the secret, so this asks the App Management API for it, which decides whether the current
 * credentials may read it.
 *
 * @param remoteApp - The app whose secret to fetch.
 * @returns The first client secret, or undefined when the App Management API returns none.
 */
export async function fetchAppClientSecret(remoteApp: AppWithClientSecrets): Promise<string | undefined> {
  const loadedSecret = firstClientSecret(remoteApp.apiSecretKeys)
  if (loadedSecret) return loadedSecret

  return firstClientSecret(await remoteApp.developerPlatformClient.appClientSecrets(remoteApp))
}

/**
 * Fetches the app's client secret, and fails with an actionable error when the App Management API returns none.
 *
 * @param remoteApp - The app whose secret to fetch.
 * @param tryMessage - What the user can do instead, when there's a way to provide the secret directly.
 * @returns The first client secret of the app.
 */
export async function appClientSecret(remoteApp: AppWithClientSecrets, tryMessage?: string): Promise<string> {
  const secret = await fetchAppClientSecret(remoteApp)
  if (secret) return secret

  throw new AbortError(
    "This command needs the app's client secret, and the App Management API didn't return one for your credentials.",
    tryMessage ?? missingClientSecretTryMessage(),
  )
}

/**
 * Explains why the client secret may be missing and what to do, for errors and warnings.
 *
 * The CLI keeps using an automation token while its variable is set, even after `shopify auth login`, so the message
 * names the variables to unset. It never reads or shows their values.
 *
 * @returns The explanation.
 */
export function missingClientSecretTryMessage(): string {
  const environment = getEnvironmentVariables()
  const setTokenVariables = automationTokenVariables.filter((name) => environment[name] !== undefined)
  if (setTokenVariables.length > 0) {
    return `The token in ${setTokenVariables[0]} might not have access to the app's client secret. To use your own account, unset ${setTokenVariables.join(' and ')}, log in with \`shopify auth login\`, and run the command again.`
  }

  return `Check that your account can view the app's client credentials in the Developer Dashboard: ${developerDashboardUrl}`
}

/**
 * Warns that a command's output leaves out SHOPIFY_API_SECRET. In JSON mode the warning is a diagnostic event.
 */
export function warnClientSecretOmitted(): void {
  outputWarn(
    `SHOPIFY_API_SECRET isn't included because the App Management API didn't return the app's client secret for your credentials. ${missingClientSecretTryMessage()}`,
  )
}

function firstClientSecret(apiSecretKeys: OrganizationApp['apiSecretKeys']): string | undefined {
  return apiSecretKeys.find((key) => key.secret)?.secret
}

export interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
  provisionable: boolean
  storeType?: string
}
