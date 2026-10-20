import {renderSecurityCleanResult} from './result.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'
import type {AppSecuritySelection} from '../app-security-selection.js'

async function createApp(directory: string): Promise<AppSecuritySelection> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  const appDirectory = await fileRealPath(directory)
  return {kind: 'config', appDirectory, appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml')}
}

async function writeResults(appDirectory: string, resultsKey: string): Promise<string> {
  const paths = appSecurityArtifactPaths(appDirectory, resultsKey)
  await mkdir(paths.resultsDirectory)
  await writeFile(paths.deterministicFindingsPath, '{}\n')
  return paths.resultsDirectory
}

describe('renderSecurityCleanResult', () => {
  test('lists every removed path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {appDirectory} = await createApp(directory)
      const resultsDirectory = await writeResults(appDirectory, 'shopify.app.production')
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityCleanResult({removed: [resultsDirectory]}, appDirectory)

      const rendered = output.info()
      expect(rendered).toContain('App security check results removed.')
      expect(rendered).toContain('shopify.app.production')
      output.clear()
    })
  })

  test('notes that there was nothing to remove', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {appDirectory} = await createApp(directory)
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityCleanResult({removed: []}, appDirectory)

      const rendered = output.info()
      expect(rendered).toContain('No app security check results to remove.')
      expect(rendered).toContain('app-security')
      output.clear()
    })
  })
})
