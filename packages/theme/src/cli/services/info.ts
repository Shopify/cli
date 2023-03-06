import {getDevelopmentTheme, getThemeStore} from './local-storage.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {version as rubyVersion} from '@shopify/cli-kit/node/ruby'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {linesToColumns} from '@shopify/cli-kit/common/string'
import {OutputMessage, formatSection, getOutputUpdateCLIReminder} from '@shopify/cli-kit/node/output'

export async function themeInfo(config: {cliVersion: string}): Promise<OutputMessage> {
  const sections: [string, string][] = [themeConfigSection(), await systemInfoSection(config)]
  const message = sections.map((sectionContents) => formatSection(...sectionContents)).join('\n\n')
  return message
}

function themeConfigSection(): [string, string] {
  const title = 'Theme Configuration'
  const store = getThemeStore() || 'Not configured'
  let developmentTheme = getDevelopmentTheme()
  developmentTheme = developmentTheme ? `#${developmentTheme}` : 'Not set'
  const lines: string[][] = [
    ['Store', store],
    ['Development Theme ID', developmentTheme],
  ]
  return [title, `${linesToColumns(lines)}`]
}

async function systemInfoSection(config: {cliVersion: string}): Promise<[string, string]> {
  const title = 'Tooling and System'
  const {platform, arch} = platformAndArch()
  const ruby = (await rubyVersion()) || 'Not installed'
  const lines: string[][] = [
    ['Shopify CLI', await cliVersionInfo(config)],
    ['OS', `${platform}-${arch}`],
    ['Shell', process.env.SHELL || 'unknown'],
    ['Node version', process.version],
    ['Ruby version', ruby],
  ]
  return [title, `${linesToColumns(lines)}`]
}

async function cliVersionInfo(config: {cliVersion: string}): Promise<string> {
  const dependency = '@shopify/cli'
  const newestVersion = await checkForNewVersion(dependency, config.cliVersion)
  if (!newestVersion) return config.cliVersion
  const upgradeMessage = getOutputUpdateCLIReminder(undefined, newestVersion)
  return [config.cliVersion, upgradeMessage].join(' ').trim()
}
