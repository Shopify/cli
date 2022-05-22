import {App, FunctionExtension, ThemeExtension, UIExtension} from '../models/app/app'
import {functionExtensions, themeExtensions, uiExtensions} from '../constants'
import {os, output, path, store} from '@shopify/cli-kit'

export type Format = 'json' | 'text'
interface InfoOptions {
  format: Format
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
      const storeFqdn = store.getAppInfo(this.app.configuration.id).storeFqdn
      if (storeFqdn) storeDescription = storeFqdn
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

    uiExtensions.types.forEach((extensionType: string) => {
      const extensions = this.app.extensions.ui.filter(
        (extension: UIExtension) => extension.configuration.type === extensionType,
      )
      if (extensions[0]) {
        body += `\n\n${output.content`${output.token.subheading(extensionType)}`.value}`
        extensions.forEach((extension: UIExtension) => {
          body += `${this.uiExtensionSubSection(extension)}`
        })
      }
    })
    themeExtensions.types.forEach((extensionType: string) => {
      const extensions = this.app.extensions.theme.filter(
        (extension: ThemeExtension) => extension.configuration.type === extensionType,
      )
      if (extensions[0]) {
        body += `\n\n${output.content`${output.token.subheading(extensionType)}`.value}`
        extensions.forEach((extension: ThemeExtension) => {
          body += `${this.themeExtensionSubSection(extension)}`
        })
      }
    })
    functionExtensions.types.forEach((extensionType: string) => {
      const extensions = this.app.extensions.theme.filter(
        (extension: ThemeExtension) => extension.configuration.type === extensionType,
      )
      if (extensions[0]) {
        body += `\n\n${output.content`${output.token.subheading(extensionType)}`.value}`
        extensions.forEach((extension: ThemeExtension) => {
          body += `${this.themeExtensionSubSection(extension)}`
        })
      }
    })

    return [title, body]
  }

  webComponentsSection(): string {
    const subtitle = [output.content`${output.token.subheading('web app')}`.value]
    const toplevel = ['📂 webs', '']
    const sublevels = this.app.webs.map((web) => {
      return [`  📂 ${web.configuration.type}`, path.relative(this.app.directory, web.directory)]
    })

    return `${subtitle}\n${this.linesToColumns([toplevel, ...sublevels])}`
  }

  uiExtensionSubSection(extension: UIExtension): string {
    const config = extension.configuration
    const details = [
      [`📂 ${config.name}`, path.relative(this.app.directory, extension.directory)],
      ['     config file', path.relative(extension.directory, extension.configurationPath)],
      ['     metafields', `${config.metafields.length}`],
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
