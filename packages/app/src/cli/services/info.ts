import {fetchOrgAndApps, fetchOrganizations} from './dev/fetch.js'
import {selectOrCreateApp} from './dev/select-app.js'
import {App} from '../models/app/app.js'
import {FunctionExtension, ThemeExtension, UIExtension} from '../models/app/extensions.js'
import {configurationFileNames, functionExtensions, themeExtensions, uiExtensions} from '../constants.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {os, output, path, session, store, dependency} from '@shopify/cli-kit'

export type Format = 'json' | 'text'
interface InfoOptions {
  format: Format
  /** When true the command outputs the env. variables necessary to deploy and run web/ */
  webEnv: boolean
}
interface Configurable {
  configuration?: {type?: string}
}

export async function info(app: App, {format, webEnv}: InfoOptions): Promise<output.Message> {
  if (webEnv) {
    return infoWeb(app, {format})
  } else {
    return infoApp(app, {format})
  }
}

export async function infoWeb(app: App, {format}: Omit<InfoOptions, 'webEnv'>): Promise<output.Message> {
  const token = await session.ensureAuthenticatedPartners()

  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  const {organization, apps} = await fetchOrgAndApps(org.id, token)

  const selectedApp = await selectOrCreateApp(app, apps, organization, token)

  if (format === 'json') {
    return output.content`${output.token.json({
      SHOPIFY_API_KEY: selectedApp.apiKey,
      SHOPIFY_API_SECRET: selectedApp.apiSecretKeys[0].secret,
      SCOPES: app.configuration.scopes,
    })}`
  } else {
    return output.content`
Use these environment variables to set up your deployment pipeline for this app:
  · ${output.token.green('SHOPIFY_API_KEY')}: ${selectedApp.apiKey}
  · ${output.token.green('SHOPIFY_API_SECRET')}: ${selectedApp.apiSecretKeys[0].secret}
  · ${output.token.green('SCOPES')}: ${app.configuration.scopes}
    `
  }
}

export async function infoApp(app: App, {format}: Omit<InfoOptions, 'webEnv'>): Promise<output.Message> {
  if (format === 'json') {
    return output.content`${JSON.stringify(app, null, 2)}`
  } else {
    const appInfo = new AppInfo(app)
    return appInfo.output()
  }
}

const UNKNOWN_TEXT = output.content`${output.token.italic('unknown')}`.value
const NOT_CONFIGURED_TEXT = output.content`${output.token.italic('Not yet configured')}`.value

class AppInfo {
  private app: App
  private cachedAppInfo: store.CachedAppInfo | undefined

  constructor(app: App) {
    this.app = app
    this.cachedAppInfo = store.cliKitStore().getAppInfo(app.directory)
  }

  async output(): Promise<string> {
    const sections: [string, string][] = [
      this.devConfigsSection(),
      this.projectSettingsSection(),
      this.appComponentsSection(),
      this.accessScopesSection(),
      await this.systemInfoSection(),
    ]
    return sections.map((sectionContents: [string, string]) => this.section(...sectionContents)).join('\n\n')
  }

  devConfigsSection(): [string, string] {
    const title = 'Configs for Dev'

    let appName = NOT_CONFIGURED_TEXT
    let storeDescription = NOT_CONFIGURED_TEXT
    let apiKey = NOT_CONFIGURED_TEXT
    let postscript = output.content`💡 These will be populated when you run ${output.token.packagejsonScript(
      this.app.dependencyManager,
      'dev',
    )}`.value
    if (this.cachedAppInfo) {
      if (this.cachedAppInfo.title) appName = this.cachedAppInfo.title
      if (this.cachedAppInfo.storeFqdn) storeDescription = this.cachedAppInfo.storeFqdn
      if (this.cachedAppInfo.appId) apiKey = this.cachedAppInfo.appId
      postscript = output.content`💡 To change these, run ${output.token.packagejsonScript(
        this.app.dependencyManager,
        'dev',
        '--reset',
      )}`.value
    }
    const lines = [
      ['App', appName],
      ['Dev store', storeDescription],
      ['API key', apiKey],
    ]
    return [title, `${this.linesToColumns(lines)}\n\n${postscript}`]
  }

  projectSettingsSection(): [string, string] {
    const title = 'Your Project'
    const lines = [
      ['Name', this.app.name],
      ['Root location', this.app.directory],
    ]
    return [title, this.linesToColumns(lines)]
  }

  appComponentsSection(): [string, string] {
    const title = 'Directory Components'

    let body = `\n${this.webComponentsSection()}`

    function augmentWithExtensions<TExtension extends Configurable>(
      extensionTypes: ReadonlyArray<string>,
      extensions: TExtension[],
      outputFormatter: (extension: TExtension) => string,
    ) {
      extensionTypes.forEach((extensionType: string) => {
        const relevantExtensions = extensions.filter((extension: TExtension) => {
          const configurationType = extension.configuration && extension.configuration.type
          return configurationType === extensionType
        })
        if (relevantExtensions[0]) {
          body += `\n\n${output.content`${output.token.subheading(extensionType)}`.value}`
          relevantExtensions.forEach((extension: TExtension) => {
            body += `${outputFormatter(extension)}`
          })
        }
      })
    }
    augmentWithExtensions(uiExtensions.types, this.app.extensions.ui, this.uiExtensionSubSection.bind(this))
    augmentWithExtensions(themeExtensions.types, this.app.extensions.theme, this.themeExtensionSubSection.bind(this))
    augmentWithExtensions(
      functionExtensions.types,
      this.app.extensions.function,
      this.functionExtensionSubSection.bind(this),
    )

    const invalidExtensions = Object.values(this.app.extensions)
      .flat()
      .filter((extension) => !extension.configuration || !extension.configuration.type)
    if (invalidExtensions[0]) {
      body += `\n\n${output.content`${output.token.subheading('Extensions with errors')}`.value}`
      invalidExtensions.forEach((extension) => {
        body += `${this.invalidExtensionSubSection(extension)}`
      })
    }

    return [title, body]
  }

  webComponentsSection(): string {
    const errors: output.Message[] = []
    const subtitle = [output.content`${output.token.subheading('web')}`.value]
    const toplevel = ['📂 web', '']
    const sublevels: [string, string][] = []
    this.app.webs.forEach((web) => {
      if (web.configuration && web.configuration.type) {
        sublevels.push([`  📂 ${web.configuration.type}`, path.relative(this.app.directory, web.directory)])
      } else if (this.app.errors) {
        const error = this.app.errors.getError(`${web.directory}/${configurationFileNames.web}`)
        if (error) {
          sublevels.push([`  📂 ${UNKNOWN_TEXT}`, path.relative(this.app.directory, web.directory)])
          errors.push(error)
        }
      }
    })
    let errorContent = `\n${errors.map(this.formattedError).join('\n')}`
    if (errorContent.trim() === '') errorContent = ''

    return `${subtitle}\n${this.linesToColumns([toplevel, ...sublevels])}${errorContent}`
  }

  uiExtensionSubSection(extension: UIExtension): string {
    const config = extension.configuration
    const details = [
      [`📂 ${config.name}`, path.relative(this.app.directory, extension.directory)],
      ['     config file', path.relative(extension.directory, extension.configurationPath)],
    ]
    if (config && config.metafields.length) {
      details.push(['     metafields', `${config.metafields.length}`])
    }

    return `\n${this.linesToColumns(details)}`
  }

  functionExtensionSubSection(extension: FunctionExtension): string {
    const config = extension.configuration
    const details = [
      [`📂 ${config.name}`, path.relative(this.app.directory, extension.directory)],
      ['     config file', path.relative(extension.directory, extension.configurationPath)],
    ]

    return `\n${this.linesToColumns(details)}`
  }

  themeExtensionSubSection(extension: ThemeExtension): string {
    const config = extension.configuration
    const details = [
      [`📂 ${config.name}`, path.relative(this.app.directory, extension.directory)],
      ['     config file', path.relative(extension.directory, extension.configurationPath)],
    ]

    return `\n${this.linesToColumns(details)}`
  }

  invalidExtensionSubSection(extension: UIExtension | FunctionExtension | ThemeExtension) {
    const details = [
      [`📂 ${UNKNOWN_TEXT}`, path.relative(this.app.directory, extension.directory)],
      ['     config file', path.relative(extension.directory, extension.configurationPath)],
    ]
    const error = this.formattedError(this.app.errors!.getError(extension.configurationPath))
    return `\n${this.linesToColumns(details)}\n${error}`
  }

  formattedError(str: output.Message): string {
    const [errorFirstLine, ...errorRemainingLines] = output.stringifyMessage(str).split('\n')
    const errorLines = [`! ${errorFirstLine}`, ...errorRemainingLines.map((line) => `  ${line}`)]
    return output.content`${output.token.errorText(errorLines.join('\n'))}`.value
  }

  accessScopesSection(): [string, string] {
    const title = 'Access Scopes in Root TOML File'
    const lines = this.app.configuration.scopes.split(',').map((scope) => [scope])
    return [title, this.linesToColumns(lines)]
  }

  async systemInfoSection(): Promise<[string, string]> {
    const title = 'Tooling and System'
    const {platform, arch} = os.platformAndArch()
    const versionUpgradeMessage = await this.versionUpgradeMessage()
    const cliVersionInfo = [this.currentCliVersion(), versionUpgradeMessage].join(' ').trim()
    const lines: string[][] = [
      ['Shopify CLI', cliVersionInfo],
      ['Package manager', this.app.dependencyManager],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL || 'unknown'],
      ['Node version', process.version],
    ]
    return [title, `${this.linesToColumns(lines)}`]
  }

  linesToColumns(lines: string[][]): string {
    const widths: number[] = []
    for (let i = 0; i < lines[0].length; i++) {
      const columnRows = lines.map((line) => line[i])
      widths.push(Math.max(...columnRows.map((row) => output.unstyled(row).length)))
    }
    const paddedLines = lines
      .map((line) => {
        return line
          .map((col, index) => {
            return `${col}${' '.repeat(widths[index] - output.unstyled(col).length)}`
          })
          .join('   ')
          .trimEnd()
      })
      .join('\n')
    return paddedLines
  }

  section(title: string, body: string): string {
    const formattedTitle = `${title.toUpperCase()}${' '.repeat(35 - title.length)}`
    return output.content`${output.token.heading(formattedTitle)}\n${body}`.value
  }

  currentCliVersion(): string {
    return this.app.nodeDependencies['@shopify/cli']
  }

  async versionUpgradeMessage(): Promise<string> {
    const cliDependency = '@shopify/cli'
    const newestVersion = await dependency.checkForNewVersion(cliDependency, this.currentCliVersion())
    if (newestVersion) {
      return output.content`${dependency.getOutputUpdateCLIReminder(this.app.dependencyManager, newestVersion)}`.value
    }
    return ''
  }
}
