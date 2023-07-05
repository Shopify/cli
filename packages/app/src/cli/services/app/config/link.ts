import {saveCurrentConfig} from './use.js'
import {AppConfiguration, AppInterface} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {load} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp} from '../../context.js'
import {fetchAppFromApiKey} from '../../dev/fetch.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {fileExists, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {slugify} from '@shopify/cli-kit/common/string'
import {Config} from '@oclif/core'

export interface LinkOptions {
  commandConfig: Config
  directory: string
  apiKey?: string
  configName?: string
}

export default async function link(options: LinkOptions): Promise<void> {
  const localApp = await loadAppConfigFromLegacyToml(options)
  const remoteApp = await loadRemoteApp(localApp, options.apiKey)
  const configName =
    (options.configName && slugify(options.configName)) || (await selectConfigName(options.directory, remoteApp.title))
  const configFileName = `shopify.app.${configName}.toml`
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

async function loadAppConfigFromLegacyToml(options: LinkOptions): Promise<AppInterface> {
  try {
    const specifications = await loadLocalExtensionsSpecifications(options.commandConfig)
    const app = await load({specifications, directory: options.directory, mode: 'report'})
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
