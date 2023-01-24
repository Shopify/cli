import * as output from '@shopify/cli-kit/node/output'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {checkForNewVersion, packageManagerUsedForCreating} from '@shopify/cli-kit/node/node-package-manager'

export async function versionService(): Promise<void> {
  const cliDependency = '@shopify/cli'
  const currentVersion = CLI_KIT_VERSION
  output.outputInfo(
    output.outputContent`Current Shopify CLI version: ${output.outputToken.yellow(currentVersion)}`.value,
  )
  const lastVersion = await checkForNewVersion(cliDependency, currentVersion)
  if (lastVersion) {
    const packageManager = packageManagerUsedForCreating()
    output.outputInfo(output.getOutputUpdateCLIReminder(packageManager, lastVersion))
  }
}
