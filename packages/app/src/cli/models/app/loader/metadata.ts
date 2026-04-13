import {Web, WebType, AppInterface, getAppScopesArray} from '../app.js'
import {isWebType} from '../loader.js'
import {ExtensionInstance} from '../../extensions/extension-instance.js'
import appMetadata from '../../../metadata.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

export type LinkedConfigurationSource =
  // Config file was passed via a flag to a command
  | 'flag'
  // Config file came from the cache (i.e. app use)
  | 'cached'
  // No flag or cache — fell through to the default (shopify.app.toml)
  | 'default'

export type ConfigurationLoadResultMetadata = {
  allClientIdsByConfigName: {[key: string]: string}
} & (
  | {
      usesLinkedConfig: false
    }
  | {
      usesLinkedConfig: true
      name: string
      gitTracked: boolean
      source: LinkedConfigurationSource
      usesCliManagedUrls?: boolean
    }
)

export async function logMetadataForLoadedApp(
  app: AppInterface,
  usesWorkspaces: boolean,
  loadingStrategy: {
    usedCustomLayoutForWeb: boolean
    usedCustomLayoutForExtensions: boolean
  },
) {
  const webs = app.webs
  const extensionsToAddToMetrics = app.allExtensions.filter((ext) => ext.isSentToMetrics())

  const appName = app.name
  const appDirectory = app.directory
  const sortedAppScopes = getAppScopesArray(app.configuration).sort()

  await logMetadataForLoadedAppUsingRawValues(
    webs,
    extensionsToAddToMetrics,
    loadingStrategy,
    appName,
    appDirectory,
    sortedAppScopes,
    usesWorkspaces,
  )
}

async function logMetadataForLoadedAppUsingRawValues(
  webs: Web[],
  extensionsToAddToMetrics: ExtensionInstance[],
  loadingStrategy: {usedCustomLayoutForWeb: boolean; usedCustomLayoutForExtensions: boolean},
  appName: string,
  appDirectory: string,
  sortedAppScopes: string[],
  appUsesWorkspaces: boolean,
) {
  await appMetadata.addPublicMetadata(async () => {
    const projectType = await getProjectType(webs)

    const extensionFunctionCount = extensionsToAddToMetrics.filter((extension) => extension.isFunctionExtension).length
    const extensionUICount = extensionsToAddToMetrics.filter((extension) => extension.isESBuildExtension).length
    const extensionThemeCount = extensionsToAddToMetrics.filter((extension) => extension.isThemeExtension).length

    const extensionTotalCount = extensionsToAddToMetrics.length

    const webBackendCount = webs.filter((web) => isWebType(web, WebType.Backend)).length
    const webBackendFramework =
      webBackendCount === 1 ? webs.filter((web) => isWebType(web, WebType.Backend))[0]?.framework : undefined
    const webFrontendCount = webs.filter((web) => isWebType(web, WebType.Frontend)).length

    const extensionsBreakdownMapping: {[key: string]: number} = {}
    for (const extension of extensionsToAddToMetrics) {
      if (extensionsBreakdownMapping[extension.type] === undefined) {
        extensionsBreakdownMapping[extension.type] = 1
      } else {
        extensionsBreakdownMapping[extension.type]!++
      }
    }

    return {
      project_type: projectType,
      app_extensions_any: extensionTotalCount > 0,
      app_extensions_breakdown: JSON.stringify(extensionsBreakdownMapping),
      app_extensions_count: extensionTotalCount,
      app_extensions_custom_layout: loadingStrategy.usedCustomLayoutForExtensions,
      app_extensions_function_any: extensionFunctionCount > 0,
      app_extensions_function_count: extensionFunctionCount,
      app_extensions_theme_any: extensionThemeCount > 0,
      app_extensions_theme_count: extensionThemeCount,
      app_extensions_ui_any: extensionUICount > 0,
      app_extensions_ui_count: extensionUICount,
      app_name_hash: hashString(appName),
      app_path_hash: hashString(appDirectory),
      app_scopes: JSON.stringify(sortedAppScopes),
      app_web_backend_any: webBackendCount > 0,
      app_web_backend_count: webBackendCount,
      app_web_custom_layout: loadingStrategy.usedCustomLayoutForWeb,
      app_web_framework: webBackendFramework,
      app_web_frontend_any: webFrontendCount > 0,
      app_web_frontend_count: webFrontendCount,
      env_package_manager_workspaces: appUsesWorkspaces,
    }
  })

  await appMetadata.addSensitiveMetadata(async () => {
    return {
      app_name: appName,
    }
  })
}

export async function logMetadataFromAppLoadingProcess(loadMetadata: ConfigurationLoadResultMetadata) {
  await appMetadata.addPublicMetadata(async () => {
    return {
      // Generic config as code instrumentation
      cmd_app_all_configs_any: Object.keys(loadMetadata.allClientIdsByConfigName).length > 0,
      cmd_app_all_configs_clients: JSON.stringify(loadMetadata.allClientIdsByConfigName),
      cmd_app_linked_config_used: loadMetadata.usesLinkedConfig,
      ...(loadMetadata.usesLinkedConfig
        ? {
            cmd_app_linked_config_name: loadMetadata.name,
            cmd_app_linked_config_git_tracked: loadMetadata.gitTracked,
            cmd_app_linked_config_source: loadMetadata.source,
            cmd_app_linked_config_uses_cli_managed_urls: loadMetadata.usesCliManagedUrls,
          }
        : {}),
    }
  })
}

async function getProjectType(webs: Web[]): Promise<'node' | 'php' | 'ruby' | 'frontend' | undefined> {
  const backendWebs = webs.filter((web) => isWebType(web, WebType.Backend))
  const frontendWebs = webs.filter((web) => isWebType(web, WebType.Frontend))
  if (backendWebs.length > 1) {
    outputDebug('Unable to decide project type as multiple web backends')
    return
  } else if (backendWebs.length === 0 && frontendWebs.length > 0) {
    return 'frontend'
  } else if (!backendWebs[0]) {
    outputDebug('Unable to decide project type as no web backend')
    return
  }

  const {directory} = backendWebs[0]

  const nodeConfigFile = joinPath(directory, 'package.json')
  const rubyConfigFile = joinPath(directory, 'Gemfile')
  const phpConfigFile = joinPath(directory, 'composer.json')

  if (await fileExists(nodeConfigFile)) {
    return 'node'
  } else if (await fileExists(rubyConfigFile)) {
    return 'ruby'
  } else if (await fileExists(phpConfigFile)) {
    return 'php'
  }
  return undefined
}
