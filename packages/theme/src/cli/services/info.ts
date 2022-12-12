import {os, output, string, store as conf} from '@shopify/cli-kit'
import {version as rubyVersion} from '@shopify/cli-kit/node/ruby'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {getEnvironmentVariables} from '@shopify/cli-kit/node/environment'

export async function themeInfo(config: {cliVersion: string}): Promise<output.Message> {
  const sections: [string, string][] = [await themeConfigSection(), await systemInfoSection(config)]
  const message = sections.map((sectionContents) => output.section(...sectionContents)).join('\n\n')
  return message
}

async function themeConfigSection(): Promise<[string, string]> {
  const title = 'Theme Configuration'
  const store = (await conf.getThemeStore()) || 'Not configured'
  const lines: string[][] = [['Store', store]]
  return [title, `${string.linesToColumns(lines)}`]
}

async function systemInfoSection(config: {cliVersion: string}): Promise<[string, string]> {
  const title = 'Tooling and System'
  const {platform, arch} = os.platformAndArch()
  const ruby = (await rubyVersion()) || 'Not installed'
  const lines: string[][] = [
    ['Shopify CLI', await cliVersionInfo(config)],
    ['OS', `${platform}-${arch}`],
    ['Shell', getEnvironmentVariables().SHELL || 'unknown'],
    ['Node version', process.version],
    ['Ruby version', ruby],
  ]
  return [title, `${string.linesToColumns(lines)}`]
}

async function cliVersionInfo(config: {cliVersion: string}): Promise<string> {
  const dependency = '@shopify/cli'
  const newestVersion = await checkForNewVersion(dependency, config.cliVersion)
  if (!newestVersion) return config.cliVersion
  const upgradeMessage = output.getOutputUpdateCLIReminder(undefined, newestVersion)
  return [config.cliVersion, upgradeMessage].join(' ').trim()
}
