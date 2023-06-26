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

const MAGIC_URL = 'https://shopify.dev/magic-url'
const MAGIC_REDIRECT_URL = `${MAGIC_URL}/api/auth`
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

export function mergeAppConfiguration(localApp: AppInterface, remoteApp: OrganizationApp): AppConfiguration {
  const configuration = localApp.configuration || {}

  configuration.client_id = remoteApp.apiKey
  configuration.name = remoteApp.title

  if (localApp?.configuration?.application_url === MAGIC_URL) {
    configuration.application_url = MAGIC_URL
    configuration.redirect_url_allowlist = [MAGIC_REDIRECT_URL]
  } else {
    configuration.application_url = remoteApp.applicationUrl
    configuration.redirect_url_allowlist = remoteApp.redirectUrlWhitelist
  }

  if (remoteApp.requestedAccessScopes) {
    configuration.requested_access_scopes = remoteApp.requestedAccessScopes
    // once scopes are optional
    // delete configuration.scopes
  } else if (localApp?.configuration?.scopes?.length >= 0) {
    configuration.requested_access_scopes = stringToList(localApp?.configuration?.scopes)
  } else {
    // once scopes are optional
    // delete configuration.scopes
  }

  return configuration
}

function stringToList(str: string): string[] {
  if (str === '') {
    return []
  } else {
    return str.split(',')
  }
}
