import {outputEnv} from './app/env/show.js'
import {isServiceAccount, isUserAccount} from './context/partner-account-info.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppLinkedInterface, getAppScopes} from '../models/app/app.js'
import {configurationFileNames} from '../constants.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {Organization, OrganizationApp} from '../models/organization.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {basename, relativePath} from '@shopify/cli-kit/node/path'
import {
  OutputMessage,
  TokenizedString,
  formatPackageManagerCommand,
  shouldDisplayColors,
  stringifyMessage,
} from '@shopify/cli-kit/node/output'
import {AlertCustomSection, InlineToken} from '@shopify/cli-kit/node/ui'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export type Format = 'json' | 'text'
export interface InfoOptions {
  format: Format
  configName?: string
  /** When true the command outputs the env. variables necessary to deploy and run web/ */
  webEnv: boolean
  developerPlatformClient: DeveloperPlatformClient
}

export async function info(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
  options: InfoOptions,
): Promise<OutputMessage | AlertCustomSection[]> {
  if (options.webEnv) {
    return infoWeb(app, remoteApp, organization, options)
  } else {
    return infoApp(app, remoteApp, options)
  }
}

async function infoWeb(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
  {format}: InfoOptions,
): Promise<OutputMessage> {
  return outputEnv(app, remoteApp, organization, format)
}

async function infoApp(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  options: InfoOptions,
): Promise<OutputMessage | AlertCustomSection[]> {
  if (options.format === 'json') {
    const extensionsInfo = withPurgedSchemas(app.allExtensions.filter((ext) => ext.isReturnedAsInfo()))
    let appWithSupportedExtensions = {
      ...app,
      allExtensions: extensionsInfo,
    }
    if ('realExtensions' in appWithSupportedExtensions) {
      appWithSupportedExtensions.realExtensions = withPurgedSchemas(
        appWithSupportedExtensions.realExtensions,
      ) as ExtensionInstance[]
    }
    if ('specifications' in appWithSupportedExtensions) {
      appWithSupportedExtensions = {
        ...appWithSupportedExtensions,
        specifications: appWithSupportedExtensions.specifications?.map((spec) => {
          // We are choosing to leave appWithSupportedExtensions as close to the original as possible,
          // instead allowing this one change in the type specifically.
          //
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return objectWithoutSchema(spec) as any
        }),
      }
    }
    const filteredApp = Object.fromEntries(
      Object.entries(appWithSupportedExtensions).filter(([key]) => key !== 'configSchema'),
    )
    return new TokenizedString(JSON.stringify(filteredApp, null, 2))
  } else {
    const appInfo = new AppInfo(app, remoteApp, options)
    return appInfo.output()
  }
}

function objectWithoutSchema(obj: object): object {
  if ('schema' in obj) {
    const {schema, ...rest} = obj
    return rest
  }
  return obj
}

function withPurgedSchemas(extensions: object[]): object[] {
  return extensions.map((ext) => {
    if ('specification' in ext && ext.specification) {
      const specification = ext.specification
      const specificationWithoutSchema = objectWithoutSchema(specification)
      return {...ext, specification: specificationWithoutSchema}
    } else {
      return ext
    }
  })
}

const UNKNOWN_TEXT = 'unknown'
const NOT_CONFIGURED_TOKEN: InlineToken = {subdued: 'Not yet configured'}
const NOT_LOADED_TEXT = 'NOT LOADED'

class AppInfo {
  private readonly app: AppLinkedInterface
  private readonly remoteApp: OrganizationApp
  private readonly options: InfoOptions

  constructor(app: AppLinkedInterface, remoteApp: OrganizationApp, options: InfoOptions) {
    this.app = app
    this.remoteApp = remoteApp
    this.options = options
  }

  async output(): Promise<AlertCustomSection[]> {
    return [
      ...(await this.devConfigsSection()),
      this.projectSettingsSection(),
      ...(await this.appComponentsSection()),
      await this.systemInfoSection(),
    ]
  }

  async devConfigsSection(): Promise<AlertCustomSection[]> {
    let updateUrls = NOT_CONFIGURED_TOKEN
    if (this.app.configuration.build?.automatically_update_urls_on_dev !== undefined) {
      updateUrls = this.app.configuration.build.automatically_update_urls_on_dev ? 'Yes' : 'No'
    }

    let userAccountInfo: [string, string] = ['User', 'unknown']
    const retrievedAccountInfo = await this.options.developerPlatformClient.accountInfo()
    if (isServiceAccount(retrievedAccountInfo)) {
      userAccountInfo = ['Service account', retrievedAccountInfo.orgName]
    } else if (isUserAccount(retrievedAccountInfo)) {
      userAccountInfo[1] = retrievedAccountInfo.email
    }

    return [
      this.tableSection(
        'Current app configuration',
        [
          ['Configuration file', {filePath: basename(this.app.configuration.path) || configurationFileNames.app}],
          ['App name', this.remoteApp.title ? {userInput: this.remoteApp.title} : NOT_CONFIGURED_TOKEN],
          ['Client ID', this.remoteApp.apiKey || NOT_CONFIGURED_TOKEN],
          ['Access scopes', getAppScopes(this.app.configuration)],
          [
            'Dev store',
            this.app.configuration.build?.dev_store_url ?? this.app.hiddenConfig.dev_store_url ?? NOT_CONFIGURED_TOKEN,
          ],
          ['Update URLs', updateUrls],
          userAccountInfo,
        ],
        {isFirstItem: true},
      ),
      {
        body: [
          '💡 To change these, run',
          {command: formatPackageManagerCommand(this.app.packageManager, 'shopify app config link')},
        ],
      },
    ]
  }

  projectSettingsSection(): AlertCustomSection {
    return this.tableSection('Your Project', [['Root location', {filePath: this.app.directory}]])
  }

  async appComponentsSection(): Promise<AlertCustomSection[]> {
    const webComponentsSection = this.webComponentsSection()
    return [
      {
        title: '\nDirectory components'.toUpperCase(),
        body: '',
      },
      ...(webComponentsSection ? [webComponentsSection] : []),
      ...this.extensionsSections(),
    ]
  }

  webComponentsSection(): AlertCustomSection | undefined {
    const errors: OutputMessage[] = []
    const sublevels: InlineToken[][] = []
    if (!this.app.webs[0]) return
    this.app.webs.forEach((web) => {
      if (web.configuration) {
        if (web.configuration.name) {
          const {name, roles} = web.configuration
          const pathToWeb = relativePath(this.app.directory, web.directory)
          sublevels.push([`    📂 ${name}`, {filePath: pathToWeb || '/'}])
          if (roles.length > 0) {
            sublevels.push(['         roles', roles.join(', ')])
          }
        } else {
          web.configuration.roles.forEach((role) => {
            sublevels.push([`    📂 ${role}`, {filePath: relativePath(this.app.directory, web.directory)}])
          })
        }
      } else {
        sublevels.push([{subdued: `  📂 ${UNKNOWN_TEXT}`}, {filePath: relativePath(this.app.directory, web.directory)}])
      }
      if (this.app.errors) {
        const error = this.app.errors.getError(`${web.directory}/${configurationFileNames.web}`)
        if (error) errors.push(error)
      }
    })

    return this.subtableSection('web', [
      ['📂 web', ''],
      ...sublevels,
      ...errors.map((error): InlineToken[] => [{error: 'error'}, {error: this.formattedError(error)}]),
    ])
  }

  extensionsSections(): AlertCustomSection[] {
    const extensions = this.app.allExtensions.filter((ext) => ext.isReturnedAsInfo())
    const types = Array.from(new Set(extensions.map((ext) => ext.type)))
    return types
      .map((extensionType: string): AlertCustomSection | undefined => {
        const relevantExtensions = extensions.filter((extension: ExtensionInstance) => extension.type === extensionType)
        if (relevantExtensions[0]) {
          return this.subtableSection(
            relevantExtensions[0].externalType,
            relevantExtensions.map((ext) => this.extensionSubSection(ext)).flat(),
          )
        }
      })
      .filter((section: AlertCustomSection | undefined) => section !== undefined)
  }

  extensionSubSection(extension: ExtensionInstance): InlineToken[][] {
    const config = extension.configuration
    const details: InlineToken[][] = [
      [`📂 ${extension.handle || NOT_LOADED_TEXT}`, {filePath: relativePath(this.app.directory, extension.directory)}],
      ['     config file', {filePath: relativePath(extension.directory, extension.configurationPath)}],
    ]
    if (config && 'metafields' in config && Array.isArray(config.metafields) && config.metafields.length > 0) {
      details.push(['     metafields', `${config.metafields.length}`])
    }
    const error = this.app.errors?.getError(extension.configurationPath)
    if (error) {
      details.push([{error: '     error'}, {error: this.formattedError(error)}])
    }

    return details
  }

  formattedError(str: OutputMessage): string {
    // Some errors have newlines at the beginning for no apparent reason
    const rawErrorMessage = stringifyMessage(str).trim()
    if (shouldDisplayColors()) return rawErrorMessage
    const [errorFirstLine, ...errorRemainingLines] = stringifyMessage(str).trim().split('\n')
    return [`! ${errorFirstLine}`, ...errorRemainingLines.map((line) => `  ${line}`)].join('\n')
  }

  async systemInfoSection(): Promise<AlertCustomSection> {
    const {platform, arch} = platformAndArch()
    return this.tableSection('Tooling and System', [
      ['Shopify CLI', CLI_KIT_VERSION],
      ['Package manager', this.app.packageManager],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL ?? 'unknown'],
      ['Node version', process.version],
    ])
  }

  tableSection(title: string, rows: InlineToken[][], {isFirstItem = false} = {}): AlertCustomSection {
    return {
      title: `${isFirstItem ? '' : '\n'}${title.toUpperCase()}\n`,
      body: {tabularData: rows, firstColumnSubdued: true},
    }
  }

  subtableSection(title: string, rows: InlineToken[][]): AlertCustomSection {
    return {
      title,
      body: {tabularData: rows, firstColumnSubdued: true},
    }
  }
}
