import SecurityRecord from './record.js'
import {appFlags} from '../../../flags.js'
import {resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import securityRecord, {renderSecurityRecordResult} from '../../../services/security-record.js'
import {securityRecordJsonOutputSchema} from '../../../services/security-record-json.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {fileRealPath, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-record.js')
vi.mock('../../../services/app-security-selection.js')

/** Creates an app directory and makes the selection resolver find it, as the real resolver would. */
async function createApp(directory: string): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  const appDirectory = await fileRealPath(directory)
  vi.mocked(resolveAppSecuritySelection).mockResolvedValue({
    kind: 'config',
    appDirectory,
    appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml'),
  })
  return appDirectory
}

function recordedResult(appRoot: string) {
  return {path: joinPath(appRoot, '.shopify', 'app-security', 'agent-findings.json'), checks: 2, findings: 3}
}

describe('app security record command', () => {
  test('is hidden, does not require linked app context, and takes no --config', () => {
    expect(SecurityRecord.hidden).toBe(true)
    expect(SecurityRecord.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityRecord.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityRecord.flags.path).toBe(appFlags.path)
    expect(SecurityRecord.flags).toHaveProperty('json')
    expect(SecurityRecord.flags).not.toHaveProperty('config')
    expect(SecurityRecord.jsonOutputSchema).toBe(securityRecordJsonOutputSchema)
  })

  test('records for the app in the current directory by default and presents the result', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const result = recordedResult(appRoot)
      vi.mocked(securityRecord).mockResolvedValue(result)
      vi.stubEnv('INIT_CWD', directory)
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityRecord.run([], import.meta.url)

        expect(resolveAppSecuritySelection).toHaveBeenCalledWith({path: cwd(), allowPrompts: false})
        expect(securityRecord).toHaveBeenCalledWith({appRoot})
        expect(renderSecurityRecordResult).toHaveBeenCalledWith(result, appRoot)
        expect(output.info()).toBe('')
      } finally {
        vi.unstubAllEnvs()
        output.clear()
      }
    })
  })

  test('prints exactly the encoded result with --json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      vi.mocked(securityRecord).mockResolvedValue(recordedResult(appRoot))
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityRecord.run(['--path', directory, '--json'], import.meta.url)

        expect(resolveAppSecuritySelection).toHaveBeenCalledWith({path: directory, allowPrompts: false})
        expect(securityRecord).toHaveBeenCalledWith({appRoot})
        expect(output.info()).toBe(
          [
            '{',
            `  "path": ${JSON.stringify(recordedResult(appRoot).path)},`,
            '  "checks": 2,',
            '  "findings": 3',
            '}',
          ].join('\n'),
        )
        expect(renderSecurityRecordResult).not.toHaveBeenCalled()
      } finally {
        output.clear()
      }
    })
  })
})
