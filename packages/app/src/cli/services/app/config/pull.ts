// packages/app/src/cli/services/app/config/pull.ts

import {LinkOptions, loadLocalAppOptions, overwriteLocalConfigFileWithRemoteAppConfiguration} from './link.js'
import {CurrentAppConfiguration, isCurrentAppSchema} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {loadApp, AppConfigurationFileName, getAppConfigurationFileName} from '../../../models/app/loader.js'
import {configurationFileNames} from '../../../constants.js'
import {appFromIdentifiers} from '../../context.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {RemoteAwareExtensionSpecification} from '../../../models/extensions/specification.js'
import {Flag} from '../../../utilities/developer-platform-client.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {basename} from '@shopify/cli-kit/node/path'

export interface PullOptions {
  directory: string
  configName?: string
}

export interface PullOutput {
  configuration: CurrentAppConfiguration
  remoteApp: OrganizationApp
}

/**
 * Refresh an already-linked app configuration without prompting for org/app.
 */
export default async function pull(options: PullOptions): Promise<PullOutput> {
  const {directory, configName} = options

  // 1) Load the current config (default, or the one passed with --config)
  const app = await loadApp({
    specifications: await loadLocalExtensionsSpecifications(),
    directory,
    mode: 'report',
    userProvidedConfigName: configName,
    remoteFlags: undefined,
  })

  const configuration = app.configuration

  if (!isCurrentAppSchema(configuration) || !configuration.client_id) {
    throw new AbortError(
      'The selected configuration is not linked to a remote app.',
      'Run `shopify app config link` first to link this configuration to a Shopify app.',
    )
  }

  // 2) Resolve remote app from the client_id in the config
  const remoteApp = await appFromIdentifiers({apiKey: configuration.client_id})
  if (!remoteApp) {
    throw new AbortError(
      'Could not find the remote app linked in this configuration.',
      'Try linking the configuration again with `shopify app config link`.',
    )
  }

  const developerPlatformClient = remoteApp.developerPlatformClient

  // 3) Fetch remote specs/flags for that app
  const specifications: RemoteAwareExtensionSpecification[] = await fetchSpecifications({
    developerPlatformClient,
    app: remoteApp,
  })
  const flags: Flag[] = remoteApp.flags

  // 4) Reuse helpers from link.ts to build and write the file
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
