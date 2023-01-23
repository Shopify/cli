import * as output from '@shopify/cli-kit/node/output'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {CancelExecution} from '@shopify/cli-kit/node/error'
import {checkForNewVersion, packageManagerUsedForCreating} from '@shopify/cli-kit/node/node-package-manager'

export async function versionService(): Promise<void> {
  const cliDependency = '@shopify/cli'
  const currentVersion = CLI_KIT_VERSION
  output.info(output.content`Current Shopify CLI version: ${output.token.yellow(currentVersion)}`.value)
  const lastVersion = await checkForNewVersion(cliDependency, currentVersion)
  if (lastVersion) {
    const packageManager = packageManagerUsedForCreating()
    output.info(output.getOutputUpdateCLIReminder(packageManager, lastVersion))
  }
  throw new CancelExecution()
}
