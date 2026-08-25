import {getAppConfigurationContext} from '../../models/app/loader.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface ResolveSubscriptionMigrationClientIdOptions {
  clientId: string | undefined
  directory: string
  configName: string | undefined
}

interface ResolveSubscriptionMigrationClientIdDependencies {
  getAppConfigurationContext?: typeof getAppConfigurationContext
}

export async function resolveSubscriptionMigrationClientId(
  {clientId, directory, configName}: ResolveSubscriptionMigrationClientIdOptions,
  dependencies: ResolveSubscriptionMigrationClientIdDependencies = {},
): Promise<string> {
  if (clientId) return clientId

  const loadAppConfigurationContext = dependencies.getAppConfigurationContext ?? getAppConfigurationContext
  const {activeConfig} = await loadAppConfigurationContext(directory, configName)

  if (activeConfig.file.errors.length > 0) {
    throw new AbortError(activeConfig.file.errors.map((error) => error.message).join('\n'))
  }

  const configuredClientId = activeConfig.file.content.client_id
  if (typeof configuredClientId !== 'string' || configuredClientId.trim().length === 0) {
    throw new AbortError(
      outputContent`No Client ID found in the active app configuration. Run ${outputToken.genericShellCommand(
        'shopify app config link',
      )} or pass ${outputToken.yellow('--client-id')}.`,
    )
  }

  return configuredClientId
}
