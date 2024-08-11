import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {outputInfo, outputContent, outputToken} from '@shopify/cli-kit/node/output'

export async function versionService(): Promise<void> {
  outputInfo(outputContent`Current Shopify CLI version: ${outputToken.yellow(CLI_KIT_VERSION)}`.value)
}
