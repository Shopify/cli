import {renderSecurityCleanResult} from './result.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'
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

      renderSecurityCleanResult({removed: [resultsDirectory]}, {all: true, appDirectory}, 'text')

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

      renderSecurityCleanResult({removed: []}, {all: true, appDirectory}, 'text')

      const rendered = output.info()
      expect(rendered).toContain('No app security check results to remove.')
      expect(rendered).toContain('app-security')
      output.clear()
    })
  })

  test('writes one JSON result with the selected app and the removed results directory', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = {...(await createApp(directory)), configClientId: 'test'}
      const resultsDirectory = await writeResults(selection.appDirectory, 'shopify.app')

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityCleanResult({removed: [resultsDirectory]}, {all: false, selection}, 'json')

        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          changed: true,
          app: {
            directory: resolve(selection.appDirectory),
            configurationPath: resolve(selection.appDirectory, 'shopify.app.toml'),
            clientId: 'test',
          },
          resultsDirectories: [resolve(selection.appDirectory, '.shopify', 'app-security', 'shopify.app')],
        })
        expect(stderr()).toBe('')
      })
    })
  })

  test('writes one JSON result with only the app directory and no change with --all and nothing to remove', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {appDirectory} = await createApp(directory)

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityCleanResult({removed: []}, {all: true, appDirectory}, 'json')

        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          changed: false,
          app: {directory: resolve(appDirectory)},
          resultsDirectories: [],
        })
        expect(stderr()).toBe('')
      })
    })
  })
})
