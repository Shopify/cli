import {appSecuritySuppressionsPath} from './app-security-artifacts.js'
import {writeFile} from '@shopify/cli-kit/node/fs'

export async function writeAppSecuritySuppressionsFixture(appDirectory: string, entries: unknown[]): Promise<void> {
  await writeFile(appSecuritySuppressionsPath(appDirectory), JSON.stringify({schema_version: 1, suppressions: entries}))
}
