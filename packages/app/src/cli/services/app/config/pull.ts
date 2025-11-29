// packages/app/src/cli/services/app/config/pull.ts

import {LinkOptions, loadLocalAppOptions, overwriteLocalConfigFileWithRemoteAppConfiguration} from './link.js'
import {CurrentAppConfiguration, isCurrentAppSchema} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {AppConfigurationFileName, getAppConfigurationFileName} from '../../../models/app/loader.js'
import {configurationFileNames} from '../../../constants.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {RemoteAwareExtensionSpecification} from '../../../models/extensions/specification.js'
import {Flag} from '../../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {basename} from '@shopify/cli-kit/node/path'

interface PullOptions {
  directory: string
  configName?: string
  configuration: CurrentAppConfiguration
  remoteApp: OrganizationApp
}

interface PullOutput {
  configuration: CurrentAppConfiguration
  remoteApp: OrganizationApp
}

/**
 * Refresh an already-linked app configuration without prompting for org/app.
 */
export default async function pull(options: PullOptions): Promise<PullOutput> {
  const {directory, configName, configuration, remoteApp} = options

  if (!isCurrentAppSchema(configuration) || !configuration.client_id) {
    throw new AbortError(
      'The selected configuration is not linked to a remote app.',
      'Run `shopify app config link` first to link this configuration to a Shopify app.',
    )
  }

  const developerPlatformClient = remoteApp.developerPlatformClient

  // Fetch remote specs/flags for that app
  const specifications: RemoteAwareExtensionSpecification[] = await fetchSpecifications({
    developerPlatformClient,
    app: remoteApp,
  })
  const flags: Flag[] = remoteApp.flags

  // Reuse helpers from link.ts to build and write the file
  const linkOptions: LinkOptions = {
    directory,
    configName,
    developerPlatformClient,
    apiKey: configuration.client_id,
  }

  const localAppOptions = await loadLocalAppOptions(linkOptions, specifications, flags, remoteApp.apiKey)

  // Decide which config file to overwrite:
  // - if config has a path, reuse that file
  // - otherwise, fallback to --config or default app config name
  const configFileName: AppConfigurationFileName =
    (configuration.path && (basename(configuration.path) as AppConfigurationFileName)) ||
    getAppConfigurationFileName(configName ?? configurationFileNames.app)

  const mergedConfiguration = await overwriteLocalConfigFileWithRemoteAppConfiguration({
    remoteApp,
    developerPlatformClient,
    specifications,
    flags,
    configFileName,
    appDirectory: localAppOptions.appDirectory ?? directory,
    localAppOptions,
  })

  return {configuration: mergedConfiguration, remoteApp}
}
