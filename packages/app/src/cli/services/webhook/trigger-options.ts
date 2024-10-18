import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {
  DELIVERY_METHOD,
  deliveryMethodForAddress,
  parseApiVersionFlag,
  parseTopicFlag,
  validateAddressMethod,
} from './trigger-flags.js'
import {addressPrompt, apiVersionPrompt, deliveryMethodPrompt, topicPrompt} from '../../prompts/webhook/trigger.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {fetchAppFromConfigOrSelect} from '../app/fetch-app-from-config-or-select.js'
import {AppInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {renderCurrentlyUsedConfigInfo} from '../context.js'
import {basename} from '@shopify/cli-kit/node/path'

interface AppCredentials {
  clientSecret: string
  apiKey?: string
  developerPlatformClient?: DeveloperPlatformClient
}

/**
 * Collects a secret/api-key pair using a fallback mechanism:
 *  - Use secret if passed as flag
 *  - If manual: prompt and use. Return only secret
 *  - If automatic:
 *    - Get from .env
 *    - Get from Partners (possible prompts for organization and app)
 *    - prompt and use
 *
 * @param developerPlatformClient - The client to access the platform API
 * @param secret - secret flag
 * @returns a pair with client-secret, api-key (possibly empty)
 */
export async function collectCredentials(
  clientId: string | undefined,
  secret: string | undefined,
  app: AppInterface,
  deliveryMethod: string,
): Promise<AppCredentials> {
  if (secret && (clientId || deliveryMethod !== DELIVERY_METHOD.EVENTBRIDGE)) {
    const credentials: AppCredentials = {clientSecret: secret, apiKey: clientId}
    return credentials
  }

  const orgApp = await fetchAppFromConfigOrSelect(app)
  if (isCurrentAppSchema(app.configuration)) {
    renderCurrentlyUsedConfigInfo({
      appName: orgApp.title,
      configFile: basename(app.configuration.path),
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const clientSecret = orgApp.apiSecretKeys.find((elm) => elm.secret)!.secret
  return {
    clientSecret,
    apiKey: orgApp.apiKey,
    developerPlatformClient: orgApp.developerPlatformClient,
  }
}

/**
 * Returns passed apiVersion or prompts for an existing one
 *
 * @param developerPlatformClient - The client to access the platform API
 * @param apiVersion - VALID or undefined api-version
 * @returns api-version
 */
export async function collectApiVersion(
  developerPlatformClient: DeveloperPlatformClient,
  apiVersion: string | undefined,
): Promise<string> {
  const apiVersions = await requestApiVersions(developerPlatformClient)
  if (apiVersion) return parseApiVersionFlag(apiVersion, apiVersions)
  return apiVersionPrompt(apiVersions)
}

/**
 * Returns passed topic if valid or prompts for an existing one
 *
 * @param developerPlatformClient - The client to access the platform API
 * @param apiVersion - VALID api-version
 * @param topic - topic or undefined
 * @returns topic
 */
export async function collectTopic(
  developerPlatformClient: DeveloperPlatformClient,
  apiVersion: string,
  topic: string | undefined,
): Promise<string> {
  if (topic) {
    return parseTopicFlag(topic, apiVersion, await requestTopics(developerPlatformClient, apiVersion))
  }

  const topics = await requestTopics(developerPlatformClient, apiVersion)
  return topicPrompt(topics)
}

/**
 * Expects either undefined deliveryMethod - address pairs, undefined address or a valid pair
 *
 * @param deliveryMethod - Valid delivery method
 * @param address - Valid address
 * @returns [address, deliveryMethod]
 */
export async function collectAddressAndMethod(
  deliveryMethod: string | undefined,
  address: string | undefined,
): Promise<[string, string]> {
  const actualMethod = deliveryMethod || deliveryMethodForAddress(address) || (await deliveryMethodPrompt())
  const actualAddress = address || (await addressPrompt(actualMethod))

  return validateAddressMethod(actualAddress, actualMethod)
}
