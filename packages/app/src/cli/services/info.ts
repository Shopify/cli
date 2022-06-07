import {App, FunctionExtension, ThemeExtension, UIExtension} from '../models/app/app'
import {configurationFileNames, functionExtensions, themeExtensions, uiExtensions} from '../constants'
import {os, output, path, store} from '@shopify/cli-kit'

export type Format = 'json' | 'text'
interface InfoOptions {
  format: Format
}
interface Configurable {
  configuration?: {type?: string}
}

export function info(app: App, {format}: InfoOptions): output.Message {
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
    this.cachedAppInfo = store.getAppInfo(app.directory)
  }

  output(): string {
    const sections: [string, string][] = [
      this.devConfigsSection(),
      this.projectSettingsSection(),
      this.appComponentsSection(),
      this.accessScopesSection(),
      this.systemInfoSection(),
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
    const errors: string[] = []
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

  formattedError(str: string): string {
    const [errorFirstLine, ...errorRemainingLines] = str.split('\n')
    const errorLines = [`! ${errorFirstLine}`, ...errorRemainingLines.map((line) => `  ${line}`)]
    return output.content`${output.token.errorText(errorLines.join('\n'))}`.value
  }

  accessScopesSection(): [string, string] {
    const title = 'Access Scopes in Root TOML File'
    const lines = this.app.configuration.scopes.split(',').map((scope) => [scope])
    return [title, this.linesToColumns(lines)]
  }

  systemInfoSection(): [string, string] {
    const title = 'Tooling and System'
    const {platform, arch} = os.platformAndArch()
    const lines: string[][] = [
      ['Shopify CLI', this.app.nodeDependencies['@shopify/cli']],
      ['Package manager', this.app.dependencyManager],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL || 'unknown'],
      ['Node version', process.version],
    ]
    const updateCommand = this.app.dependencyManager === 'yarn' ? 'upgrade' : 'update'
    const postscript =
      output.content`💡 To update to the latest version of the Shopify CLI, run ${output.token.genericShellCommand(
        `${this.app.dependencyManager} ${updateCommand}`,
      )}`.value
    return [title, `${this.linesToColumns(lines)}\n\n${postscript}`]
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
}
