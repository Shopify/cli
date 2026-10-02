import SecurityClean from './clean.js'
import {appFlags} from '../../../flags.js'
import {resolveAppSecurityRoot} from '../../../services/app-security-api.js'
import securityClean, {renderSecurityCleanResult} from '../../../services/security-clean.js'
import {securityCleanJsonOutputSchema} from '../../../services/security-clean-json.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import type {SecurityCleanResult} from '../../../services/security-clean-json.js'

vi.mock('../../../services/security-clean.js')

async function createApp(directory: string): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  return resolveAppSecurityRoot(directory)
}

function cleanedResult(appRoot: string): SecurityCleanResult {
  return {removed: [joinPath(appRoot, '.shopify', 'app-security', 'deterministic-findings.json')]}
}

describe('app security clean command', () => {
  test('is visible and does not require linked app context', () => {
    expect(SecurityClean.hidden).toBeFalsy()
    expect(SecurityClean.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityClean.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityClean.flags.path).toBe(appFlags.path)
    expect(SecurityClean.flags).toHaveProperty('json')
    expect(SecurityClean.jsonOutputSchema).toBe(securityCleanJsonOutputSchema)
  })

  test('cleans the app in the current directory by default and presents the result', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const result = cleanedResult(appRoot)
      vi.mocked(securityClean).mockResolvedValue(result)
      vi.stubEnv('INIT_CWD', directory)
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityClean.run([], import.meta.url)

        expect(securityClean).toHaveBeenCalledWith({appRoot})
        expect(renderSecurityCleanResult).toHaveBeenCalledWith(result, appRoot)
        expect(output.info()).toBe('')
      } finally {
        vi.unstubAllEnvs()
        output.clear()
      }
    })
  })

  test('forwards --path and prints exactly the encoded result with --json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const result = cleanedResult(appRoot)
      vi.mocked(securityClean).mockResolvedValue(result)
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityClean.run(['--path', directory, '--json'], import.meta.url)

        expect(securityClean).toHaveBeenCalledWith({appRoot})
        expect(output.info()).toBe(
          ['{', '  "removed": [', `    ${JSON.stringify(result.removed[0])}`, '  ]', '}'].join('\n'),
        )
        expect(renderSecurityCleanResult).not.toHaveBeenCalled()
      } finally {
        output.clear()
      }
    })
  })
})
