import {saveCurrentConfig} from './use.js'
import {AppConfiguration, AppInterface} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {load} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp} from '../../context.js'
import {fetchAppFromApiKey} from '../../dev/fetch.js'
import {Config} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {fileExists, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {slugify} from '@shopify/cli-kit/common/string'

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
    const specifications = await loadExtensionsSpecifications(options.commandConfig)
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
  const configuration = localApp.configuration || {}

  configuration.client_id = remoteApp.apiKey
  configuration.name = remoteApp.title
  configuration.application_url = remoteApp.applicationUrl
  configuration.redirect_url_allowlist = remoteApp.redirectUrlWhitelist

  return configuration
}
