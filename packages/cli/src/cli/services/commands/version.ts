import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {checkForNewVersion, packageManagerFromUserAgent} from '@shopify/cli-kit/node/node-package-manager'
import {outputInfo, outputContent, outputToken, getOutputUpdateCLIReminder} from '@shopify/cli-kit/node/output'

export async function versionService(): Promise<void> {
  const cliDependency = '@shopify/cli'
  const currentVersion = CLI_KIT_VERSION
  outputInfo(outputContent`Current Shopify CLI version: ${outputToken.yellow(currentVersion)}`.value)
  const lastVersion = await checkForNewVersion(cliDependency, currentVersion)
  if (lastVersion) {
    const packageManager = packageManagerFromUserAgent()
    outputInfo(getOutputUpdateCLIReminder(packageManager, lastVersion))
  }
}
