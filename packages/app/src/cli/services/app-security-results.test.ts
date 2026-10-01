import {loadAppSecurityResults} from './app-security-results.js'
import {appSecurityArtifactPaths, writeAgentFindings, writeCheckArtifacts} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {combineFindings, scanApp} from './app-security-engine/index.js'
import {agentFindingsDocument} from './app-security-engine/tests/fixtures/findings-documents.js'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import type {DeterministicFindingsDocument} from './app-security-engine/index.js'

type FileState = 'present' | 'missing' | 'invalid'

async function createApp(directory: string): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
  return directory
}

/** Writes a real deterministic-findings.json by running `check` on the app. */
async function writeDeterministicFindings(appRoot: string): Promise<DeterministicFindingsDocument> {
  const {deterministicFindings, agentChecks} = await scanApp(appRoot)
  await writeCheckArtifacts(appRoot, {deterministicFindings, agentChecks})
  return deterministicFindings
}

async function writeInvalidFile(path: string, contents: string): Promise<void> {
  await mkdir(joinPath(path, '..'))
  await writeFile(path, contents)
}

async function loadError(appRoot: string): Promise<AbortError> {
  const error: unknown = await loadAppSecurityResults(appRoot).catch((error: unknown) => error)
  expect(error).toBeInstanceOf(AbortError)
  return error as AbortError
}

function command(appRoot: string, name: 'scan' | 'record' | 'clean'): string {
  return formatAppSecurityCommand(resolveAppSecurityCommands(appRoot)[name])
}

describe('loadAppSecurityResults', () => {
  test('returns no sources and no checks when both files are missing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)

      await expect(loadAppSecurityResults(appRoot)).resolves.toEqual({
        sources: {deterministic: null, agent: null},
        checks: [],
      })
    })
  })

  test('loads the deterministic results alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const deterministic = await writeDeterministicFindings(appRoot)

      const results = await loadAppSecurityResults(appRoot)

      expect(results.sources).toEqual({
        deterministic: {path: appSecurityArtifactPaths(appRoot).deterministicFindingsPath, document: deterministic},
        agent: null,
      })
      expect(results.checks).toEqual(combineFindings({deterministic, agent: null}))
      expect(results.checks.length).toBeGreaterThan(0)
    })
  })

  test('loads the agent results alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const path = await writeAgentFindings(appRoot, agentFindingsDocument)

      const results = await loadAppSecurityResults(appRoot)

      expect(results.sources).toEqual({deterministic: null, agent: {path, document: agentFindingsDocument}})
      expect(results.checks).toEqual(combineFindings({deterministic: null, agent: agentFindingsDocument}))
      expect(results.checks.map((check) => check.id)).toEqual([
        'CREDENTIAL_LOG_LEAKAGE',
        'MISSING_TENANT_ISOLATION',
        'UNAUTHENTICATED_ENDPOINT',
        'OPEN_REDIRECT',
      ])
    })
  })

  test('combines both results when both files are present', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const deterministic = await writeDeterministicFindings(appRoot)
      const agentPath = await writeAgentFindings(appRoot, agentFindingsDocument)

      const results = await loadAppSecurityResults(appRoot)

      expect(results.sources).toEqual({
        deterministic: {path: appSecurityArtifactPaths(appRoot).deterministicFindingsPath, document: deterministic},
        agent: {path: agentPath, document: agentFindingsDocument},
      })
      expect(results.checks).toEqual(combineFindings({deterministic, agent: agentFindingsDocument}))
      const credentialLeak = results.checks.find((check) => check.id === 'CREDENTIAL_LOG_LEAKAGE')
      expect(credentialLeak?.by_source.agent).not.toBeNull()
    })
  })

  describe('invalid files', () => {
    test.each<[FileState, FileState]>([
      ['invalid', 'missing'],
      ['invalid', 'present'],
      ['missing', 'invalid'],
      ['present', 'invalid'],
    ])(
      'throws one error naming the invalid file (deterministic %s, agent %s)',
      async (deterministicState, agentState) => {
        await inTemporaryDirectory(async (directory) => {
          const appRoot = await createApp(directory)
          const paths = appSecurityArtifactPaths(appRoot)
          if (deterministicState === 'present') await writeDeterministicFindings(appRoot)
          if (deterministicState === 'invalid') await writeInvalidFile(paths.deterministicFindingsPath, '{invalid')
          if (agentState === 'present') await writeAgentFindings(appRoot, agentFindingsDocument)
          if (agentState === 'invalid') await writeInvalidFile(paths.agentFindingsPath, '{invalid')

          const error = await loadError(appRoot)

          const invalidPath =
            deterministicState === 'invalid' ? paths.deterministicFindingsPath : paths.agentFindingsPath
          const validPath = deterministicState === 'invalid' ? paths.agentFindingsPath : paths.deterministicFindingsPath
          const fix =
            deterministicState === 'invalid'
              ? ['Run', {command: command(appRoot, 'scan')}, 'to regenerate deterministic-findings.json.']
              : [
                  'Have your coding agent run',
                  {command: command(appRoot, 'record')},
                  'again to regenerate agent-findings.json.',
                ]
          expect(error.message).toBe('The App Security results could not be loaded because a results file is invalid.')
          expect(error.nextSteps).toStrictEqual([
            fix,
            ['Or run', {command: command(appRoot, 'clean')}, 'to delete both results files and start over.'],
          ])
          expect(error.customSections).toStrictEqual([
            {title: invalidPath, body: {list: {items: [expect.stringContaining('Could not parse JSON')]}}},
          ])
          expect(error.details).toStrictEqual({
            invalidFiles: [
              {
                source: deterministicState === 'invalid' ? 'deterministic' : 'agent',
                path: invalidPath,
                errors: [expect.stringContaining('Could not parse JSON')],
              },
            ],
          })
          expect(JSON.stringify(error.customSections)).not.toContain(validPath)
        })
      },
    )

    test('lists both invalid files in one error, deterministic first', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const paths = appSecurityArtifactPaths(appRoot)
        await writeInvalidFile(paths.deterministicFindingsPath, JSON.stringify(agentFindingsDocument))
        await writeInvalidFile(paths.agentFindingsPath, '{invalid')

        const error = await loadError(appRoot)

        expect(error.message).toBe(
          'The App Security results could not be loaded because both results files are invalid.',
        )
        expect(error.nextSteps).toStrictEqual([
          ['Run', {command: command(appRoot, 'scan')}, 'to regenerate deterministic-findings.json.'],
          [
            'Have your coding agent run',
            {command: command(appRoot, 'record')},
            'again to regenerate agent-findings.json.',
          ],
          ['Or run', {command: command(appRoot, 'clean')}, 'to delete both results files and start over.'],
        ])
        expect(error.customSections).toStrictEqual([
          {
            title: paths.deterministicFindingsPath,
            body: {list: {items: ['source is "agent", but this file must hold "deterministic" findings.']}},
          },
          {title: paths.agentFindingsPath, body: {list: {items: [expect.stringContaining('Could not parse JSON')]}}},
        ])
        expect(error.details).toStrictEqual({
          invalidFiles: [
            {
              source: 'deterministic',
              path: paths.deterministicFindingsPath,
              errors: ['source is "agent", but this file must hold "deterministic" findings.'],
            },
            {source: 'agent', path: paths.agentFindingsPath, errors: [expect.stringContaining('Could not parse JSON')]},
          ],
        })
      })
    })

    test('lists every translation error of a file on its own line without repeating the path', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const paths = appSecurityArtifactPaths(appRoot)
        const document = {...agentFindingsDocument, engine: {name: 'other'}, checks: [{id: 'X', status: 'skipped'}]}
        await writeInvalidFile(paths.agentFindingsPath, JSON.stringify(document))

        const error = await loadError(appRoot)

        expect(error.customSections).toHaveLength(1)
        const section = error.customSections![0]!
        expect(section.title).toBe(paths.agentFindingsPath)
        const items = (section.body as {list: {items: string[]}}).list.items
        expect(items.length).toBeGreaterThan(1)
        expect(items).toEqual(expect.arrayContaining([expect.stringMatching(/^engine\.name: /)]))
        for (const item of items) expect(item).not.toContain(paths.agentFindingsPath)
      })
    })

    test('renders as a JSON error document in JSON mode', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const paths = appSecurityArtifactPaths(appRoot)
        await writeInvalidFile(paths.deterministicFindingsPath, '{"schema_version":3}')
        const error = await loadError(appRoot)

        const output = mockAndCaptureOutput()
        output.clear()
        vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
        try {
          await handler(error)

          expect(JSON.parse(output.info())).toStrictEqual({
            error: {
              type: 'abort',
              message: 'The App Security results could not be loaded because a results file is invalid.',
              nextSteps: [
                `Run ${command(appRoot, 'scan')} to regenerate deterministic-findings.json.`,
                `Or run ${command(appRoot, 'clean')} to delete both results files and start over.`,
              ],
              customSections: [
                {title: paths.deterministicFindingsPath, body: 'unsupported schema_version: 3 (expected 1)'},
              ],
              details: {
                invalidFiles: [
                  {
                    source: 'deterministic',
                    path: paths.deterministicFindingsPath,
                    errors: ['unsupported schema_version: 3 (expected 1)'],
                  },
                ],
              },
            },
          })
        } finally {
          vi.unstubAllEnvs()
          output.clear()
        }
      })
    })
  })
})
