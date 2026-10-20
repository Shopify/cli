import {renderSecurityRecordResult} from './result.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {fileRealPath, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'
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

      renderSecurityRecordResult({path, checks: 1, findings: 2}, selectionFor(appRoot), appRoot)

      const rendered = output.info()
      expect(rendered).toContain('Agent findings recorded.')
      expect(rendered).toContain('Recorded 1 check and 2 findings in')
      expect(rendered).toContain('agent-findings.json')
      expect(rendered).toContain('shopify app security review --path')
      output.clear()
    })
  })
})
