import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {outputInfo} from '@shopify/cli-kit/node/output'

export async function versionService(): Promise<void> {
  outputInfo(CLI_KIT_VERSION)
}
