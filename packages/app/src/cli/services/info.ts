import {outputEnv} from './app/env/show.js'
import {isServiceAccount, isUserAccount} from './context/partner-account-info.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppLinkedInterface, getAppScopes} from '../models/app/app.js'
import {configurationFileNames} from '../constants.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {Organization, OrganizationApp} from '../models/organization.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {linesToColumns} from '@shopify/cli-kit/common/string'
import {basename, relativePath} from '@shopify/cli-kit/node/path'
import {OutputMessage, outputContent, outputToken, formatSection, stringifyMessage} from '@shopify/cli-kit/node/output'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export type Format = 'json' | 'text'
export interface InfoOptions {
  format: Format
  configName?: string
  /** When true the command outputs the env. variables necessary to deploy and run web/ */
  webEnv: boolean
  developerPlatformClient: DeveloperPlatformClient
}
interface Configurable {
  type: string
  externalType: string
}

export async function info(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
  options: InfoOptions,
): Promise<OutputMessage> {
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
): Promise<OutputMessage> {
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
    return outputContent`${JSON.stringify(
      Object.fromEntries(Object.entries(appWithSupportedExtensions).filter(([key]) => key !== 'configSchema')),
      null,
      2,
    )}`
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

const UNKNOWN_TEXT = outputContent`${outputToken.italic('unknown')}`.value
const NOT_CONFIGURED_TEXT = outputContent`${outputToken.italic('Not yet configured')}`.value

class AppInfo {
  private readonly app: AppLinkedInterface
  private readonly remoteApp: OrganizationApp
  private readonly options: InfoOptions

  constructor(app: AppLinkedInterface, remoteApp: OrganizationApp, options: InfoOptions) {
    this.app = app
    this.remoteApp = remoteApp
    this.options = options
  }

  async output(): Promise<string> {
    const sections: [string, string][] = [
      await this.devConfigsSection(),
      this.projectSettingsSection(),
      await this.appComponentsSection(),
      await this.systemInfoSection(),
    ]
    return sections.map((sectionContents: [string, string]) => formatSection(...sectionContents)).join('\n\n')
  }

  async devConfigsSection(): Promise<[string, string]> {
    const title = `Current app configuration`
    const postscript = outputContent`💡 To change these, run ${outputToken.packagejsonScript(
      this.app.packageManager,
      'dev',
      '--reset',
    )}`.value

    let updateUrls = NOT_CONFIGURED_TEXT
    if (this.app.configuration.build?.automatically_update_urls_on_dev !== undefined) {
      updateUrls = this.app.configuration.build.automatically_update_urls_on_dev ? 'Yes' : 'No'
    }

    let partnersAccountInfo = ['Partners account', 'unknown']
    const retrievedAccountInfo = await this.options.developerPlatformClient.accountInfo()
    if (isServiceAccount(retrievedAccountInfo)) {
      partnersAccountInfo = ['Service account', retrievedAccountInfo.orgName]
    } else if (isUserAccount(retrievedAccountInfo)) {
      partnersAccountInfo = ['Partners account', retrievedAccountInfo.email]
    }

    const lines = [
      ['Configuration file', basename(this.app.configuration.path) || configurationFileNames.app],
      ['App name', this.remoteApp.title || NOT_CONFIGURED_TEXT],
      ['Client ID', this.remoteApp.apiKey || NOT_CONFIGURED_TEXT],
      ['Access scopes', getAppScopes(this.app.configuration)],
      ['Dev store', this.app.configuration.build?.dev_store_url || NOT_CONFIGURED_TEXT],
      ['Update URLs', updateUrls],
      partnersAccountInfo,
    ]
    return [title, `${linesToColumns(lines)}\n\n${postscript}`]
  }

  projectSettingsSection(): [string, string] {
    const title = 'Your Project'
    const lines = [['Root location', this.app.directory]]
    return [title, linesToColumns(lines)]
  }

  async appComponentsSection(): Promise<[string, string]> {
    const title = 'Directory Components'

    let body = this.webComponentsSection()

    function augmentWithExtensions<TExtension extends Configurable>(
      extensions: TExtension[],
      outputFormatter: (extension: TExtension) => string,
    ) {
      const types = new Set(extensions.map((ext) => ext.type))
      types.forEach((extensionType: string) => {
        const relevantExtensions = extensions.filter((extension: TExtension) => extension.type === extensionType)
        if (relevantExtensions[0]) {
          body += `\n\n${outputContent`${outputToken.subheading(relevantExtensions[0].externalType)}`.value}`
          relevantExtensions.forEach((extension: TExtension) => {
            body += outputFormatter(extension)
          })
        }
      })
    }

    const supportedExtensions = this.app.allExtensions.filter((ext) => ext.isReturnedAsInfo())
    augmentWithExtensions(supportedExtensions, this.extensionSubSection.bind(this))

    if (this.app.errors?.isEmpty() === false) {
      body += `\n\n${outputContent`${outputToken.subheading('Extensions with errors')}`.value}`
      supportedExtensions.forEach((extension) => {
        body += this.invalidExtensionSubSection(extension)
      })
    }
    return [title, body]
  }

  webComponentsSection(): string {
    const errors: OutputMessage[] = []
    const subtitle = outputContent`${outputToken.subheading('web')}`.value
    const toplevel = ['📂 web', '']
    const sublevels: [string, string][] = []
    this.app.webs.forEach((web) => {
      if (web.configuration) {
        if (web.configuration.name) {
          const {name, roles} = web.configuration
          sublevels.push([`    📂 ${name} (${roles.join(',')})`, relativePath(this.app.directory, web.directory)])
        } else {
          web.configuration.roles.forEach((role) => {
            sublevels.push([`    📂 ${role}`, relativePath(this.app.directory, web.directory)])
          })
        }
      } else {
        sublevels.push([`  📂 ${UNKNOWN_TEXT}`, relativePath(this.app.directory, web.directory)])
      }
      if (this.app.errors) {
        const error = this.app.errors.getError(`${web.directory}/${configurationFileNames.web}`)
        if (error) errors.push(error)
      }
    })
    let errorContent = `\n${errors.map((error) => this.formattedError(error)).join('\n')}`
    if (errorContent.trim() === '') errorContent = ''

    return `${subtitle}\n${linesToColumns([toplevel, ...sublevels])}${errorContent}`
  }

  extensionSubSection(extension: ExtensionInstance): string {
    const config = extension.configuration
    const details = [
      [`📂 ${extension.handle}`, relativePath(this.app.directory, extension.directory)],
      ['     config file', relativePath(extension.directory, extension.configurationPath)],
    ]
    if (config && config.metafields?.length) {
      details.push(['     metafields', `${config.metafields.length}`])
    }

    return `\n${linesToColumns(details)}`
  }

  invalidExtensionSubSection(extension: ExtensionInstance): string {
    const error = this.app.errors?.getError(extension.configurationPath)
    if (!error) return ''
    const details = [
      [`📂 ${extension.handle}`, relativePath(this.app.directory, extension.directory)],
      ['     config file', relativePath(extension.directory, extension.configurationPath)],
    ]
    const formattedError = this.formattedError(error)
    return `\n${linesToColumns(details)}\n${formattedError}`
  }

  formattedError(str: OutputMessage): string {
    const [errorFirstLine, ...errorRemainingLines] = stringifyMessage(str).split('\n')
    const errorLines = [`! ${errorFirstLine}`, ...errorRemainingLines.map((line) => `  ${line}`)]
    return outputContent`${outputToken.errorText(errorLines.join('\n'))}`.value
  }

  async systemInfoSection(): Promise<[string, string]> {
    const title = 'Tooling and System'
    const {platform, arch} = platformAndArch()
    const lines: string[][] = [
      ['Shopify CLI', CLI_KIT_VERSION],
      ['Package manager', this.app.packageManager],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL || 'unknown'],
      ['Node version', process.version],
    ]
    return [title, linesToColumns(lines)]
  }
}
