import ThemeCommand from '../../utilities/theme-command.js'
import {getTheme} from '../../utilities/theme-store.js'
import {cli, os, output, string} from '@shopify/cli-kit'
import {version as rubyVersion} from '@shopify/cli-kit/node/ruby'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'

export default class ThemeInfo extends ThemeCommand {
  static description = 'Print basic information about your theme environment'

  static flags = {
    ...cli.globalFlags,
  }

  public async run(): Promise<void> {
    const sections: [string, string][] = [await this.themeConfigSection(), await this.systemInfoSection()]
    const message = sections.map((sectionContents) => output.section(...sectionContents)).join('\n\n')
    output.info(message)
  }

  async themeConfigSection(): Promise<[string, string]> {
    const title = 'Theme Configuration'
    const store = getTheme({store: undefined})
    const lines: string[][] = [['Store', store]]
    return [title, `${string.linesToColumns(lines)}`]
  }

  async systemInfoSection(): Promise<[string, string]> {
    const title = 'Tooling and System'
    const {platform, arch} = os.platformAndArch()
    const ruby = (await rubyVersion()) || 'Not installed'
    const lines: string[][] = [
      ['Shopify CLI', await this.cliVersionInfo()],
      ['OS', `${platform}-${arch}`],
      ['Shell', process.env.SHELL || 'unknown'],
      ['Node version', process.version],
      ['Ruby version', ruby],
    ]
    return [title, `${string.linesToColumns(lines)}`]
  }

  async cliVersionInfo(): Promise<string> {
    const dependency = '@shopify/cli'
    const newestVersion = await checkForNewVersion(dependency, this.config.version)
    if (!newestVersion) return this.config.version
    const upgradeMessage = output.getOutputUpdateCLIReminder(undefined, newestVersion)
    return [this.config.version, upgradeMessage].join(' ').trim()
  }
}
