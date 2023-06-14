import {AppConfiguration, AppInterface} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {selectApp} from '../select-app.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {load} from '../../../models/app/loader.js'
import {Config} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {fileExists, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {encodeToml} from '@shopify/cli-kit/node/toml'

export interface LinkOptions {
  commandConfig: Config
  directory: string
}

export default async function link(options: LinkOptions): Promise<void> {
  const localApp = await loadLocalApp(options)
  const remoteApp = await selectApp()
  const configName = await selectConfigName(options.directory)
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

async function loadLocalApp(options: LinkOptions): Promise<AppInterface> {
  const specifications = await loadExtensionsSpecifications(options.commandConfig)
  return load({specifications, directory: options.directory, mode: 'report'})
}

function mergeAppConfiguration(localApp: AppInterface, remoteApp: OrganizationApp): AppConfiguration {
  const mergedApp = localApp

  mergedApp.configuration.credentials = {clientId: remoteApp.apiKey}
  mergedApp.configuration.appInfo = {name: remoteApp.title}
  mergedApp.configuration.web = {appUrl: remoteApp.applicationUrl}

  return mergedApp.configuration
}
