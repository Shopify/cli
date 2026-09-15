import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import type {VersionResult} from './types.js'

export async function versionService(): Promise<VersionResult> {
  return {version: CLI_KIT_VERSION}
}
