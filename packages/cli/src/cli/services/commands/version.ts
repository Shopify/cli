import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {outputResult} from '@shopify/cli-kit/node/output'

export async function versionService(): Promise<void> {
  outputResult(CLI_KIT_VERSION)
}
