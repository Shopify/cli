import {renderSecurityRecordResult} from './result.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {fileRealPath, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'
import type {AppSecuritySelection} from '../app-security-selection.js'

async function createApp(directory: string): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  return fileRealPath(directory)
}

/** The selection that `createApp`'s `shopify.app.toml` gives. Its results key is `shopify.app`. */
function selectionFor(appRoot: string): AppSecuritySelection {
  return {kind: 'config', appDirectory: appRoot, appConfigFilePath: joinPath(appRoot, 'shopify.app.toml')}
}

function artifactPaths(appRoot: string) {
  return appSecurityArtifactPaths(appRoot, 'shopify.app')
}

describe('renderSecurityRecordResult', () => {
  test('shows the counts, the recorded path, and how to review the results', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const path = artifactPaths(appRoot).agentFindingsPath
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityRecordResult(
        {path, checks: 1, findings: 2},
        {selection: selectionFor(appRoot), path: appRoot},
        'text',
      )

      const rendered = output.info()
      expect(rendered).toContain('Agent findings recorded.')
      expect(rendered).toContain('Recorded 1 check and 2 findings in')
      expect(rendered).toContain('agent-findings.json')
      expect(rendered).toContain('shopify app security review --path')
      output.clear()
    })
  })

  test('writes one JSON result with the selected app, the results directory and the recorded file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const selection = {...selectionFor(appRoot), configClientId: 'test'}
      const path = artifactPaths(appRoot).agentFindingsPath

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityRecordResult({path, checks: 1, findings: 2}, {selection, path: appRoot}, 'json')

        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          app: {
            directory: resolve(appRoot),
            configurationPath: resolve(appRoot, 'shopify.app.toml'),
            clientId: 'test',
          },
          resultsDirectory: resolve(appRoot, '.shopify', 'app-security', 'shopify.app'),
          path: resolve(appRoot, '.shopify', 'app-security', 'shopify.app', 'agent-findings.json'),
          checkCount: 1,
          findingCount: 2,
        })
        expect(stderr()).toBe('')
      })
    })
  })

  test('writes a JSON result under the --client-id results key without app configuration', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await fileRealPath(directory)
      const selection: AppSecuritySelection = {
        kind: 'no-config',
        appDirectory: appRoot,
        clientId: 'flag-client-id',
        clientIdSource: 'flag',
      }
      const path = appSecurityArtifactPaths(appRoot, 'flag-client-id').agentFindingsPath

      await withCapturedStandardStreams(({stdout}) => {
        renderSecurityRecordResult({path, checks: 0, findings: 0}, {selection, path: appRoot}, 'json')

        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          app: {directory: resolve(appRoot), configurationPath: null, clientId: 'flag-client-id'},
          resultsDirectory: resolve(appRoot, '.shopify', 'app-security', 'flag-client-id'),
          path: resolve(appRoot, '.shopify', 'app-security', 'flag-client-id', 'agent-findings.json'),
          checkCount: 0,
          findingCount: 0,
        })
      })
    })
  })
})
