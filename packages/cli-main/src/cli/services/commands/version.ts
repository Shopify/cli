import {output, error} from '@shopify/cli-kit'
import {checkForNewVersion, packageManagerUsedForCreating} from '@shopify/cli-kit/node/node-package-manager'

interface VersionServiceOptions {
  currentVersion: string
}

export async function versionService(options: VersionServiceOptions): Promise<void> {
  const cliDependency = '@shopify/cli'
  const currentVersion = options.currentVersion
  output.info(output.content`Current Shopify CLI version: ${output.token.yellow(currentVersion)}`.value)
  const lastVersion = await checkForNewVersion(cliDependency, currentVersion)
  if (lastVersion) {
    const packageManager = packageManagerUsedForCreating()
    output.info(output.getOutputUpdateCLIReminder(packageManager === 'unknown' ? 'npm' : packageManager, lastVersion))
  }
  throw new error.CancelExecution()
}
