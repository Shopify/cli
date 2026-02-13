import {cliVersion} from '@shopify/cli-kit/node/version'
import {outputResult} from '@shopify/cli-kit/node/output'

export async function versionService(): Promise<void> {
  outputResult(cliVersion())
}
