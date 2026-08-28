import {runAppDoctor} from './app-doctor-api.js'
import {loadChecks} from './app-doctor-engine/index.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

async function createApp(directory: string, source = 'export const loader = () => ({ok: true})'): Promise<string> {
  const sourceDirectory = joinPath(directory, 'app', 'routes')
  const sourcePath = joinPath(sourceDirectory, 'index.ts')
  await mkdir(sourceDirectory)
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test app"\nclient_id = "test"\n')
  await writeFile(joinPath(directory, 'package.json'), '{"name":"test-app"}\n')
  await writeFile(sourcePath, source)
  return sourcePath
}

describe('App Doctor CLI integration', () => {
  test('runs the in-tree engine and writes the review pack and trace', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      const result = await runAppDoctor({directory, format: 'human', verbose: true, blocking: 'none'})
      const review = JSON.parse(await readFile(joinPath(directory, 'app-doctor-review.json')))
      const trace = JSON.parse(await readFile(joinPath(directory, 'app-doctor-trace.json')))

      expect(review.checks).toHaveLength(16)
      expect(review.checks.every((check: {prompt: string}) => check.prompt.length > 0)).toBe(true)
      expect(trace.schema_version).toBe(1)
      expect(trace.engine.name).toBe('shopify-app-doctor')
      expect(result.engine).toEqual(trace.engine)
      expect(result.output).toContain('shopify app doctor scan --findings <findings.json>')
      expect(result.exitCode).toBe(0)
    })
  })

  test('preserves JSON output and applies the requested blocking severity', async () => {
    await inTemporaryDirectory(async (directory) => {
      const testToken = ['shpat', '0123456789abcdef0123456789abcdef'].join('_')
      await createApp(directory, `const access_token = "${testToken}"`)

      const result = await runAppDoctor({directory, format: 'json', verbose: false, blocking: 'high'})

      expect(() => JSON.parse(result.output)).not.toThrow()
      expect(result.output).not.toContain(testToken)
      expect(result.exitCode).toBe(1)
    })
  })

  test('validates agent findings and compiles them into the trace', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const check = loadChecks().get('MISSING_TENANT_ISOLATION')!
      const findingsPath = joinPath(directory, 'findings.json')
      await writeFile(
        findingsPath,
        `${JSON.stringify({
          checks_executed: [{check_id: check.id, check_version: check.version, prompt_hash: check.prompt_hash}],
          findings: [
            {
              check_id: check.id,
              check_version: check.version,
              prompt_hash: check.prompt_hash,
              file: 'app/routes/index.ts',
              line: 1,
              message: 'The query is not scoped to the current shop.',
              evidence: [{file: 'app/routes/index.ts', line: 1, quote: 'loader'}],
            },
          ],
        })}\n`,
      )

      const result = await runAppDoctor({
        directory,
        findingsPath,
        format: 'json',
        verbose: false,
        blocking: 'none',
      })
      const trace = JSON.parse(result.output)

      expect(trace.findings).toEqual(
        expect.arrayContaining([expect.objectContaining({source: 'agent', check_id: 'MISSING_TENANT_ISOLATION'})]),
      )
      expect(trace.checks_executed).toEqual(
        expect.arrayContaining([expect.objectContaining({id: 'MISSING_TENANT_ISOLATION', status: 'executed'})]),
      )
      expect(JSON.parse(await readFile(joinPath(directory, 'app-doctor-trace.json')))).toEqual(trace)
      expect(result.exitCode).toBe(0)
    })
  })
})
