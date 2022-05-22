import {App} from '../models/app/app'
import {os, output} from '@shopify/cli-kit'

interface InfoOptions {
  format: 'json' | 'text'
}

export default function info(app: App, {format}: InfoOptions) {
  if (format === 'json') {
    return output.content`${JSON.stringify(app, null, 2)}`
  } else {
    const appInfo = new AppInfo(app)
    return appInfo.output()
  }
}

class AppInfo {
  private app: App

  constructor(app) {
    this.app = app
  }

  output(): string {
    return [
      this.devConfigsSection(),
      this.projectSettingsSection(),
      this.accessScopesSection(),
      this.systemInfoSection(),
    ]
      .map((sectionContents) => this.section(...sectionContents))
      .join('\n\n')
  }

  devConfigsSection(): string {
    const title = 'Configs for Dev'
    const lines = [
      ['App', this.app.configuration.name],
      ['Dev store', 'not configured'],
    ]
    const postscript = output.content`💡 To change these, run ${output.token.command(
      `${this.app.dependencyManager} shopify dev --reset`,
    )}`.value
    return [title, `${this.linesToColumns(lines)}\n\n${postscript}`]
  }

  projectSettingsSection(): string {
    const title = 'Your Project'
    const lines = [
      ['Name', this.app.configuration.name],
      ['API key', 'not configured'],
      ['Root location', this.app.directory],
    ]
    return [title, this.linesToColumns(lines)]
  }

  accessScopesSection(): string {
    const title = 'Access Scopes in Root TOML File'
    const lines = this.app.configuration.scopes.split(',').map((scope) => [scope])
    return [title, this.linesToColumns(lines)]
  }

  systemInfoSection(): string {
    const title = 'Tooling and System'
    const {platform, arch} = os.platformAndArch()
    const lines = [
      ['Shopify CLI', this.app.nodeDependencies['@shopify/cli']],
      ['Package manager', this.app.dependencyManager],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL],
      ['Node version', process.version],
    ]
    const postscript = output.content`💡 To update to the latest version of the Shopify CLI, run ${output.token.command(
      `${this.app.dependencyManager} upgrade`,
    )}`.value
    return [title, `${this.linesToColumns(lines)}\n\n${postscript}`]
  }

  linesToColumns(lines: string[][]): string[] {
    const widths: number[] = []
    for (let i = 0; i < lines[0].length; i++) {
      const columnRows = lines.map((line) => line[i])
      widths.push(Math.max(...columnRows.map((row) => row.length)))
    }
    const paddedLines = lines
      .map((line) => {
        return line
          .map((col, index) => {
            return `${col}${' '.repeat(widths[index] - col.length)}`
          })
          .join('   ')
          .trim()
      })
      .join('\n')
    return paddedLines
  }

  section(title: string, body: string): string {
    return output.content`${output.token.heading(title.toUpperCase())}\n${body}`.value
  }
}
