import {CLI_KIT_VERSION} from '@shopify/cli-kit/shared/common/version'
import {outputResult} from '@shopify/cli-kit/shared/node/output'

export async function versionService(): Promise<void> {
  outputResult(CLI_KIT_VERSION)
}
