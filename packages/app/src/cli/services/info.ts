import {outputEnv} from './app/env/show.js'
import {CachedAppInfo, getAppInfo} from './local-storage.js'
import {AppInterface} from '../models/app/app.js'
import {FunctionExtension, ThemeExtension, UIExtension} from '../models/app/extensions.js'
import {configurationFileNames} from '../constants.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {linesToColumns} from '@shopify/cli-kit/common/string'
import {relativePath} from '@shopify/cli-kit/node/path'
import {
  OutputMessage,
  outputContent,
  outputToken,
  formatSection,
  stringifyMessage,
  getOutputUpdateCLIReminder,
} from '@shopify/cli-kit/node/output'

export type Format = 'json' | 'text'
interface InfoOptions {
  format: Format
  /** When true the command outputs the env. variables necessary to deploy and run web/ */
  webEnv: boolean
}
interface Configurable {
  type: string
  externalType: string
}

export async function info(app: AppInterface, {format, webEnv}: InfoOptions): Promise<OutputMessage> {
  if (webEnv) {
    return infoWeb(app, {format})
  } else {
    return infoApp(app, {format})
  }
}

export async function infoWeb(app: AppInterface, {format}: Omit<InfoOptions, 'webEnv'>): Promise<OutputMessage> {
  return outputEnv(app, format)
}

export async function infoApp(app: AppInterface, {format}: Omit<InfoOptions, 'webEnv'>): Promise<OutputMessage> {
  if (format === 'json') {
    return outputContent`${JSON.stringify(app, null, 2)}`
  } else {
    const appInfo = new AppInfo(app)
    return appInfo.output()
  }
}

const UNKNOWN_TEXT = outputContent`${outputToken.italic('unknown')}`.value
const NOT_CONFIGURED_TEXT = outputContent`${outputToken.italic('Not yet configured')}`.value

class AppInfo {
  private app: AppInterface
  private cachedAppInfo: CachedAppInfo | undefined

  constructor(app: AppInterface) {
    this.app = app
  }

  async output(): Promise<string> {
    const sections: [string, string][] = [
      this.devConfigsSection(),
      this.projectSettingsSection(),
      await this.appComponentsSection(),
      this.accessScopesSection(),
      await this.systemInfoSection(),
    ]
    return sections.map((sectionContents: [string, string]) => formatSection(...sectionContents)).join('\n\n')
  }

  devConfigsSection(): [string, string] {
    const title = 'Configs for Dev'

    let appName = NOT_CONFIGURED_TEXT
    let storeDescription = NOT_CONFIGURED_TEXT
    let apiKey = NOT_CONFIGURED_TEXT
    let updateURLs = NOT_CONFIGURED_TEXT
    let postscript = outputContent`💡 These will be populated when you run ${outputToken.packagejsonScript(
      this.app.packageManager,
      'dev',
    )}`.value
    const cachedAppInfo = getAppInfo(this.app.directory)
    if (cachedAppInfo) {
      if (cachedAppInfo.title) appName = cachedAppInfo.title
      if (cachedAppInfo.storeFqdn) storeDescription = cachedAppInfo.storeFqdn
      if (cachedAppInfo.appId) apiKey = cachedAppInfo.appId
      if (cachedAppInfo.updateURLs !== undefined) updateURLs = cachedAppInfo.updateURLs ? 'Always' : 'Never'
      postscript = outputContent`💡 To change these, run ${outputToken.packagejsonScript(
        this.app.packageManager,
        'dev',
        '--reset',
      )}`.value
    }
    const lines = [
      ['App', appName],
      ['Dev store', storeDescription],
      ['API key', apiKey],
      ['Update URLs', updateURLs],
    ]
    return [title, `${linesToColumns(lines)}\n\n${postscript}`]
  }

  projectSettingsSection(): [string, string] {
    const title = 'Your Project'
    const lines = [
      ['Name', this.app.name],
      ['Root location', this.app.directory],
    ]
    return [title, linesToColumns(lines)]
  }

  async appComponentsSection(): Promise<[string, string]> {
    const title = 'Directory Components'

    let body = `\n${this.webComponentsSection()}`

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
            body += `${outputFormatter(extension)}`
          })
        }
      })
    }

    augmentWithExtensions(this.app.extensions.ui, this.uiExtensionSubSection.bind(this))
    augmentWithExtensions(this.app.extensions.theme, this.themeExtensionSubSection.bind(this))
    augmentWithExtensions(this.app.extensions.function, this.functionExtensionSubSection.bind(this))

    const allExtensions = [...this.app.extensions.ui, ...this.app.extensions.theme, ...this.app.extensions.function]

    if (this.app.errors?.isEmpty() === false) {
      body += `\n\n${outputContent`${outputToken.subheading('Extensions with errors')}`.value}`
      allExtensions.forEach((extension) => {
        body += `${this.invalidExtensionSubSection(extension)}`
      })
    }
    return [title, body]
  }

  webComponentsSection(): string {
    const errors: OutputMessage[] = []
    const subtitle = [outputContent`${outputToken.subheading('web')}`.value]
    const toplevel = ['📂 web', '']
    const sublevels: [string, string][] = []
    this.app.webs.forEach((web) => {
      if (web.configuration && web.configuration.type) {
        sublevels.push([`  📂 ${web.configuration.type}`, relativePath(this.app.directory, web.directory)])
      } else if (this.app.errors) {
        const error = this.app.errors.getError(`${web.directory}/${configurationFileNames.web}`)
        if (error) {
          sublevels.push([`  📂 ${UNKNOWN_TEXT}`, relativePath(this.app.directory, web.directory)])
          errors.push(error)
        }
      }
    })
    let errorContent = `\n${errors.map(this.formattedError).join('\n')}`
    if (errorContent.trim() === '') errorContent = ''

    return `${subtitle}\n${linesToColumns([toplevel, ...sublevels])}${errorContent}`
  }

  uiExtensionSubSection(extension: UIExtension): string {
    const config = extension.configuration
    const details = [
      [`📂 ${config.name}`, relativePath(this.app.directory, extension.directory)],
      ['     config file', relativePath(extension.directory, extension.configurationPath)],
    ]
    if (config && config.metafields?.length) {
      details.push(['     metafields', `${config.metafields.length}`])
    }

    return `\n${linesToColumns(details)}`
  }

  functionExtensionSubSection(extension: FunctionExtension): string {
    const config = extension.configuration
    const details = [
      [`📂 ${config.name}`, relativePath(this.app.directory, extension.directory)],
      ['     config file', relativePath(extension.directory, extension.configurationPath)],
    ]

    return `\n${linesToColumns(details)}`
  }

  themeExtensionSubSection(extension: ThemeExtension): string {
    const config = extension.configuration
    const details = [
      [`📂 ${config.name}`, relativePath(this.app.directory, extension.directory)],
      ['     config file', relativePath(extension.directory, extension.configurationPath)],
    ]

    return `\n${linesToColumns(details)}`
  }

  invalidExtensionSubSection(extension: UIExtension | FunctionExtension | ThemeExtension): string {
    const error = this.app.errors?.getError(extension.configurationPath)
    if (!error) return ''
    const details = [
      [`📂 ${extension.configuration?.type}`, relativePath(this.app.directory, extension.directory)],
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

  accessScopesSection(): [string, string] {
    const title = 'Access Scopes in Root TOML File'
    const lines = this.app.configuration.scopes.split(',').map((scope) => [scope])
    return [title, linesToColumns(lines)]
  }

  async systemInfoSection(): Promise<[string, string]> {
    const title = 'Tooling and System'
    const {platform, arch} = platformAndArch()
    const versionUpgradeMessage = await this.versionUpgradeMessage()
    const cliVersionInfo = [this.currentCliVersion(), versionUpgradeMessage].join(' ').trim()
    const lines: string[][] = [
      ['Shopify CLI', cliVersionInfo],
      ['Package manager', this.app.packageManager],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL || 'unknown'],
      ['Node version', process.version],
    ]
    return [title, `${linesToColumns(lines)}`]
  }

  currentCliVersion(): string {
    return this.app.nodeDependencies['@shopify/cli']!
  }

  async versionUpgradeMessage(): Promise<string> {
    const cliDependency = '@shopify/cli'
    const newestVersion = await checkForNewVersion(cliDependency, this.currentCliVersion())
    if (newestVersion) {
      return getOutputUpdateCLIReminder(this.app.packageManager, newestVersion)
    }
    return ''
  }
}
