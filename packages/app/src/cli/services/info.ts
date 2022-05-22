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

export function info(app: App, {format}: InfoOptions) {
  if (format === 'json') {
    return output.content`${JSON.stringify(app, null, 2)}`
  } else {
    const appInfo = new AppInfo(app)
    return appInfo.output()
  }
}

class AppInfo {
  private app: App

  constructor(app: App) {
    this.app = app
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

    let storeDescription = 'not configured'
    if (this.app.configuration.id) {
      const storeInfo = store.getAppInfo(this.app.configuration.id)
      if (storeInfo && storeInfo.storeFqdn) storeDescription = storeInfo.storeFqdn
    }
    const lines = [
      ['App', this.app.configuration.name],
      ['Dev store', storeDescription],
    ]
    const postscript = output.content`💡 To change these, run ${output.token.command(
      `${this.app.dependencyManager} shopify dev --reset`,
    )}`.value
    return [title, `${this.linesToColumns(lines)}\n\n${postscript}`]
  }

  projectSettingsSection(): [string, string] {
    const title = 'Your Project'
    const lines = [
      ['Name', this.app.configuration.name],
      ['API key', this.app.configuration.id || 'not configured'],
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
      body += `\n\n${output.content`${output.token.subheading('Invalid Extensions')}`.value}`
      invalidExtensions.forEach((extension) => {
        body += `${this.invalidExtensionSubSection(extension)}`
      })
    }

    return [title, body]
  }

  webComponentsSection(): string {
    const errors: string[] = []
    const subtitle = [output.content`${output.token.subheading('web app')}`.value]
    const toplevel = ['📂 webs', '']
    const sublevels: [string, string][] = []
    this.app.webs.forEach((web) => {
      if (web.configuration && web.configuration.type) {
        sublevels.push([`  📂 ${web.configuration.type}`, path.relative(this.app.directory, web.directory)])
      } else if (this.app.errors) {
        const error = this.app.errors.getError(`${web.directory}/${configurationFileNames.web}`)
        if (error) errors.push(error)
      }
    })
    if (errors[0]) {
      const errorHeadline = errors.length === 1 ? 'validation error' : 'validation errors'
      const firstError: string = errors.shift()!
      const [errorFirstLine, ...errorRemainingLines] = firstError.split('\n')
      errors.forEach((error) => error.split('\n').forEach((line) => errorRemainingLines.push(line)))

      sublevels.push([this.errorText(errorHeadline), this.errorText(errorFirstLine)])
      errorRemainingLines.forEach((line) => sublevels.push(['', this.errorText(line)]))
    }

    return `${subtitle}\n${this.linesToColumns([toplevel, ...sublevels])}`
  }

  uiExtensionSubSection(extension: UIExtension): string {
    const config = extension.configuration
    const details = [
      [`📂 ${config.name}`, path.relative(this.app.directory, extension.directory)],
      ['     config file', path.relative(extension.directory, extension.configurationPath)],
      ['     metafields', config ? `${config.metafields.length}` : 'configuration invalid'],
    ]

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
    const [errorFirstLine, ...errorRemainingLines] = this.app.errors!.getError(extension.configurationPath).split('\n')
    const details = [
      [`📂 extension root directory`, path.relative(this.app.directory, extension.directory)],
      ['     config file', path.relative(extension.directory, extension.configurationPath)],
      ['     validation error', errorFirstLine].map(this.errorText),
      ...errorRemainingLines.map((line) => ['', line].map(this.errorText)),
    ]

    return `\n${this.linesToColumns(details)}`
  }

  errorText(str: string): string {
    return output.content`${output.token.errorText(str)}`.value
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
    const postscript = output.content`💡 To update to the latest version of the Shopify CLI, run ${output.token.command(
      `${this.app.dependencyManager} upgrade`,
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
