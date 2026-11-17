import {
  OrganizationApp,
  appClientSecret,
  fetchAppClientSecret,
  missingClientSecretTryMessage,
} from '../../models/organization.js'
import {outputWarn} from '@shopify/cli-kit/node/output'

/**
 * Gets the client secret that dev needs, if any. Only the web processes and GraphiQL authenticate as the app.
 *
 * Web processes can't run without it, so dev fails. GraphiQL is optional, so dev warns and runs without it.
 * Resolve it before dev changes anything remotely, such as the app URLs.
 *
 * @returns The client secret, or undefined when nothing needs it or it's unavailable for an app without webs.
 */
export async function devClientSecret({
  remoteApp,
  hasWebs,
  graphiqlEnabled,
}: {
  remoteApp: OrganizationApp
  hasWebs: boolean
  graphiqlEnabled: boolean
}): Promise<string | undefined> {
  if (hasWebs) return appClientSecret(remoteApp)
  if (!graphiqlEnabled) return undefined

  const secret = await fetchAppClientSecret(remoteApp)
  if (!secret) {
    outputWarn(
      `GraphiQL isn't available because the App Management API didn't return the app's client secret for your credentials. ${missingClientSecretTryMessage()}`,
    )
  }
  return secret
}
