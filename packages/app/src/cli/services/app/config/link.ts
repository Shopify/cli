import {saveCurrentConfig} from './use.js'
import {AppConfiguration, AppInterface, isLegacyAppSchema} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {getAppConfigurationFileName, loadApp} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp} from '../../context.js'
import {fetchAppFromApiKey} from '../../dev/fetch.js'
import {configurationFileNames} from '../../../constants.js'
import {Config} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {fileExists, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface LinkOptions {
  commandConfig: Config
  directory: string
  apiKey?: string
  configName?: string
}

export default async function link(options: LinkOptions): Promise<void> {
  const localApp = await loadAppConfigFromDefaultToml(options)
  const remoteApp = await loadRemoteApp(localApp, options.apiKey)
  const configFileName = await loadConfigurationFileName(remoteApp, options, localApp)
  const configFilePath = joinPath(options.directory, configFileName)
  const fileAlreadyExists = await fileExists(configFilePath)

  const configuration = mergeAppConfiguration(localApp, remoteApp)

  writeFileSync(configFilePath, encodeToml(configuration))

  await saveCurrentConfig({configFileName, directory: options.directory})

  renderSuccess({
    headline: `App "${remoteApp.title}" connected to this codebase, file ${configFileName} ${
      fileAlreadyExists ? 'updated' : 'created'
    }`,
  })
}

async function loadAppConfigFromDefaultToml(options: LinkOptions): Promise<AppInterface> {
  try {
    const specifications = await loadLocalExtensionsSpecifications(options.commandConfig)
    const app = await loadApp({
      specifications,
      directory: options.directory,
      mode: 'report',
      configName: configurationFileNames.app,
    })
    return app
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {name: ''} as AppInterface
  }
}

async function loadRemoteApp(localApp: AppInterface, apiKey: string | undefined): Promise<OrganizationApp> {
  const token = await ensureAuthenticatedPartners()
  if (!apiKey) {
    return fetchOrCreateOrganizationApp(localApp, token)
  }
  const app = await fetchAppFromApiKey(apiKey, token)
  if (!app) {
    const errorMessage = InvalidApiKeyErrorMessage(apiKey)
    throw new AbortError(errorMessage.message, errorMessage.tryMessage)
  }
  return app
}

async function loadConfigurationFileName(
  remoteApp: OrganizationApp,
  options: LinkOptions,
  localApp?: AppInterface,
): Promise<string> {
  if (options.configName) {
    return getAppConfigurationFileName(options.configName)
  }

  if (!localApp?.configuration || (localApp && isLegacyAppSchema(localApp.configuration))) {
    return configurationFileNames.app
  }

  const configName = await selectConfigName(options.directory, remoteApp.title)
  return `shopify.app.${configName}.toml`
}

function mergeAppConfiguration(localApp: AppInterface, remoteApp: OrganizationApp): AppConfiguration {
  const configuration: AppConfiguration = {
    client_id: remoteApp.apiKey,
    name: remoteApp.title,
    application_url: remoteApp.applicationUrl,
    webhook_api_version: '2023-04',
    api_contact_email: 'example@example.com',
  }

  if (remoteApp.requestedAccessScopes) {
    configuration.scopes = remoteApp.requestedAccessScopes.join(',')
  } else if (typeof localApp.configuration?.scopes === 'string') {
    configuration.legacy_scopes_behavior = true
    configuration.scopes = localApp.configuration.scopes
  } else {
    configuration.legacy_scopes_behavior = true
  }

  if (localApp.configuration?.extension_directories) {
    configuration.extension_directories = localApp.configuration.extension_directories
  }

  if (localApp.configuration?.web_directories) {
    configuration.web_directories = localApp.configuration.web_directories
  }

  return configuration
}
