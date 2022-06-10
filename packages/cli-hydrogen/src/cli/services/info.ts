import {HydrogenApp} from '../models/hydrogen'
import {HydrogenConfig} from '@shopify/hydrogen/config'

import {output, string, os} from '@shopify/cli-kit'

export type Format = 'json' | 'text'

interface InfoOptions {
  format: Format
}

export function info(app: HydrogenApp, {format}: InfoOptions): output.Message {
  if (format === 'json') {
    return output.content`${JSON.stringify(app, null, 2)}`
  } else {
    const appInfo = new HydrogenAppInfo(app)

    return appInfo.output()
  }
}

const NOT_FOUND_TEXT = output.content`${output.token.italic('Not found')}`.value
const NOT_CONFIGURED_TEXT = output.content`${output.token.italic('Not yet configured')}`.value

class AppInfo {
  private app: HydrogenApp
  constructor(app: HydrogenApp) {
    this.app = app
  }

  output(): string {
    const sections: [string, string][] = [
      this.projectSettingsSection(),
      this.storefrontSettingsSection(),
      this.eslintSection(),
      this.systemInfoSection(),
    ]
    return sections.map((sectionContents: [string, string]) => this.section(...sectionContents)).join('\n\n')
  }

  projectSettingsSection(): [string, string] {
    const title = 'Your Project'

    const lines = [
      ['Name', this.app.name],
      ['Project location', this.app.directory],
    ]

    const projectInfo = this.linesToColumns(lines)
    return [title, projectInfo]
  }

  storefrontSettingsSection(): [string, string] {
    const errors: string[] = []
    const title = 'Storefront'

    if (this.app.configuration.shopify && typeof this.app.configuration.shopify === 'function') {
      return [title, 'Storefront settings defined as a function are not supported in this command.']
    }

    const storefrontInfo = this.configurationCheck(
      ['storeDomain', 'storefrontApiVersion', 'storefrontToken'] as unknown as keyof HydrogenConfig['shopify'][],
      this.app.configuration.shopify,
    )

    if (!this.app.configuration.shopify?.storeDomain.endsWith('.myshopify.com')) {
      const error = 'StoreDomain must be a valid shopify domain'

      errors.push(error)
      this.app.errors?.addError('storeDomain', error)
    }

    let errorContent = `\n${errors.map(this.formattedError).join('\n')}`

    if (errorContent.trim() === '') errorContent = ''

    return [title, `${this.linesToColumns(storefrontInfo)}${errorContent}`]
  }

  eslintSection(): [string, string] {
    const errors: string[] = []
    const title = 'ESLint'
    const dependencyResults = this.dependencyCheck(['eslint', 'eslint-plugin-hydrogen'])

    let errorContent = `\n${errors.map(this.formattedError).join('\n')}`

    if (errorContent.trim() === '') errorContent = ''

    return [title, `${this.linesToColumns(dependencyResults)}${errorContent}`]
  }

  configurationCheck(
    key: keyof HydrogenConfig | keyof HydrogenConfig[],
    configObject: HydrogenConfig | HydrogenConfig['shopify'] = this.app.configuration,
  ): string[][] {
    const keys = Array.isArray(key) ? key : [key]

    const result = (keys as [keyof HydrogenConfig]).reduce((acc: string[][], key: keyof HydrogenConfig) => {
      const found = configObject[key as keyof HydrogenConfig & keyof HydrogenConfig['shopify']]

      if (typeof found === 'string') {
        const result = [string.capitalize(key), found]
        return [...acc, result]
      }

      const result = [key, NOT_CONFIGURED_TEXT]
      return [...acc, result]
    }, [])

    return result
  }

  dependencyCheck(dependency: string | string[]): string[][] {
    const dependencies = Array.isArray(dependency) ? dependency : [dependency]

    const result = dependencies.reduce<string[][]>((acc, dependency) => {
      const found = this.app.nodeDependencies[dependency]
      if (found) {
        const result = [dependency, found]
        return [...acc, result]
      }

      const result = [dependency, NOT_FOUND_TEXT]
      return [...acc, result]
    }, [])

    return result
  }

  formattedError(str: string): string {
    const [errorFirstLine, ...errorRemainingLines] = str.split('\n')
    const errorLines = [`! ${errorFirstLine}`, ...errorRemainingLines.map((line) => `  ${line}`)]
    return output.content`${output.token.errorText(errorLines.join('\n'))}`.value
  }

  systemInfoSection(): [string, string] {
    const title = 'Tooling and System'
    const {platform, arch} = os.platformAndArch()
    const dependencyResults = this.dependencyCheck(['eslint', 'eslint-plugin-hydrogen'])

    const lines: string[][] = [
      ...this.dependencyCheck(['@shopify/hydrogen', '@shopify/cli-hydrogen', '@shopify/cli']),
      ['Package manager', this.app.dependencyManager],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL || 'unknown'],
      ['Node.js version', process.version],
    ]

    return [title, this.linesToColumns(lines)]
  }

  linesToColumns(lines: string[][]): string {
    const widths: number[] = []
    for (let i = 0; lines[0] && i < lines[0].length; i++) {
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

class HydrogenAppInfo extends AppInfo {}
