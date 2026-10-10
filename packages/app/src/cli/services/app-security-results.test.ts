import {
  loadAppSecurityResults as loadResults,
  requireResultsDirectory as requireResults,
} from './app-security-results.js'
import {appSecurityArtifactPaths, writeAgentFindings, writeCheckArtifacts} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {combineFindings} from './app-security-engine/index.js'
import {scanAppDirectory} from './app-security-engine/tests/scan-directory.js'
import {agentFindingsDocument} from './app-security-engine/tests/fixtures/findings-documents.js'
import {resultsKey, type AppSecuritySelection} from './app-security-selection.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {DeterministicFindingsDocument} from './app-security-engine/index.js'

type FileState = 'present' | 'missing' | 'invalid'

/** The selection `shopify.app.toml` gives: the results key is `shopify.app`. */
async function createApp(directory: string): Promise<AppSecuritySelection> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
  const appDirectory = await fileRealPath(directory)
  return {kind: 'config', appDirectory, appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml')}
}

/** `--path` is the app directory in these tests, as when `check` is run from somewhere else. */
function loadAppSecurityResults(selection: AppSecuritySelection) {
  return loadResults(selection, selection.appDirectory)
}

function requireResultsDirectory(selection: AppSecuritySelection) {
  return requireResults(selection, selection.appDirectory)
}

function artifactPathsFor(selection: AppSecuritySelection) {
  return appSecurityArtifactPaths(selection.appDirectory, resultsKey(selection))
}

/** Writes a real deterministic-findings.json by running `check` on the app. */
async function writeDeterministicFindings(selection: AppSecuritySelection): Promise<DeterministicFindingsDocument> {
  const {deterministicFindings, agentChecks} = await scanAppDirectory(selection.appDirectory)
  await writeCheckArtifacts(selection.appDirectory, resultsKey(selection), {deterministicFindings, agentChecks})
  return deterministicFindings
}

async function writeInvalidFile(path: string, contents: string): Promise<void> {
  await mkdir(joinPath(path, '..'))
  await writeFile(path, contents)
}

async function loadError(selection: AppSecuritySelection): Promise<AbortError> {
  const error: unknown = await loadAppSecurityResults(selection).catch((error: unknown) => error)
  expect(error).toBeInstanceOf(AbortError)
  return error as AbortError
}

function command(selection: AppSecuritySelection, name: 'scan' | 'record' | 'clean'): string {
  return formatAppSecurityCommand(resolveAppSecurityCommands(selection, selection.appDirectory)[name])
}

describe('requireResultsDirectory', () => {
  test('passes when the results directory exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)
      await writeDeterministicFindings(selection)

      await expect(requireResultsDirectory(selection)).resolves.toBeUndefined()
    })
  })

  test('throws "No results found" with the check command as the next step', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)

      const error: unknown = await requireResultsDirectory(selection).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(AbortError)
      expect((error as AbortError).message).toBe(
        `No app security check results for shopify.app in ${selection.appDirectory}.`,
      )
      expect((error as AbortError).tryMessage).toBe(`Run \`${command(selection, 'scan')}\`.`)
    })
  })

  test('looks for the --client-id results key, not the configuration name', async () => {
    await inTemporaryDirectory(async (directory) => {
      const configSelection = await createApp(directory)
      await writeDeterministicFindings(configSelection)
      const selection = {...configSelection, clientIdOverride: 'other-client-id'}

      await expect(requireResultsDirectory(selection)).rejects.toMatchObject({
        message: `No app security check results for other-client-id in ${selection.appDirectory}.`,
      })
    })
  })

  test('looks for the --client-id results key without app configuration', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await fileRealPath(directory)
      const selection: AppSecuritySelection = {
        kind: 'no-config',
        appDirectory,
        clientId: 'client-id-1',
        clientIdSource: 'flag',
      }

      await expect(requireResultsDirectory(selection)).rejects.toMatchObject({
        message: `No app security check results for client-id-1 in ${appDirectory}.`,
      })
      await writeAgentFindings(appDirectory, 'client-id-1', agentFindingsDocument)
      await expect(requireResultsDirectory(selection)).resolves.toBeUndefined()
    })
  })
})

describe('loadAppSecurityResults', () => {
  test('throws "No results found" when the results directory does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)

      await expect(loadAppSecurityResults(selection)).rejects.toMatchObject({
        message: `No app security check results for shopify.app in ${selection.appDirectory}.`,
      })
    })
  })

  test('returns no sources and no checks when the results directory has neither file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)
      await mkdir(artifactPathsFor(selection).resultsDirectory)

      await expect(loadAppSecurityResults(selection)).resolves.toEqual({
        sources: {deterministic: null, agent: null},
        checks: [],
      })
    })
  })

  test('loads the deterministic results alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)
      const deterministic = await writeDeterministicFindings(selection)

      const results = await loadAppSecurityResults(selection)

      expect(results.sources).toEqual({
        deterministic: {path: artifactPathsFor(selection).deterministicFindingsPath, document: deterministic},
        agent: null,
      })
      expect(results.checks).toEqual(combineFindings({deterministic, agent: null}))
      expect(results.checks.length).toBeGreaterThan(0)
    })
  })

  test('loads the agent results alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)
      const path = await writeAgentFindings(selection.appDirectory, resultsKey(selection), agentFindingsDocument)

      const results = await loadAppSecurityResults(selection)

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
      const selection = await createApp(directory)
      const deterministic = await writeDeterministicFindings(selection)
      const agentPath = await writeAgentFindings(selection.appDirectory, resultsKey(selection), agentFindingsDocument)

      const results = await loadAppSecurityResults(selection)

      expect(results.sources).toEqual({
        deterministic: {path: artifactPathsFor(selection).deterministicFindingsPath, document: deterministic},
        agent: {path: agentPath, document: agentFindingsDocument},
      })
      expect(results.checks).toEqual(combineFindings({deterministic, agent: agentFindingsDocument}))
      const credentialLeak = results.checks.find((check) => check.id === 'CREDENTIAL_LOG_LEAKAGE')
      expect(credentialLeak?.by_source.agent).not.toBeNull()
    })
  })

  test('loads only the results of the selected results key', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)
      await writeDeterministicFindings(selection)
      const otherSelection = {...selection, clientIdOverride: 'other-client-id'}
      await writeAgentFindings(selection.appDirectory, 'other-client-id', agentFindingsDocument)

      const results = await loadAppSecurityResults(otherSelection)

      expect(results.sources.deterministic).toBeNull()
      expect(results.sources.agent?.document).toEqual(agentFindingsDocument)
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
          const selection = await createApp(directory)
          const paths = artifactPathsFor(selection)
          if (deterministicState === 'present') await writeDeterministicFindings(selection)
          if (deterministicState === 'invalid') await writeInvalidFile(paths.deterministicFindingsPath, '{invalid')
          if (agentState === 'present') {
            await writeAgentFindings(selection.appDirectory, resultsKey(selection), agentFindingsDocument)
          }
          if (agentState === 'invalid') await writeInvalidFile(paths.agentFindingsPath, '{invalid')

          const error = await loadError(selection)

          const invalidPath =
            deterministicState === 'invalid' ? paths.deterministicFindingsPath : paths.agentFindingsPath
          const validPath = deterministicState === 'invalid' ? paths.agentFindingsPath : paths.deterministicFindingsPath
          const fix =
            deterministicState === 'invalid'
              ? ['Run', {command: command(selection, 'scan')}, 'to regenerate deterministic-findings.json.']
              : [
                  'Have your coding agent run',
                  {command: command(selection, 'record')},
                  'again to regenerate agent-findings.json.',
                ]
          expect(error.message).toBe(
            'The app security check results could not be loaded because a results file is invalid.',
          )
          expect(error.nextSteps).toStrictEqual([
            fix,
            ['Or run', {command: command(selection, 'clean')}, 'to delete both results files and start over.'],
          ])
          expect(error.customSections).toStrictEqual([
            {title: invalidPath, body: {list: {items: [expect.stringContaining('Could not parse JSON')]}}},
          ])
          expect(JSON.stringify(error.customSections)).not.toContain(validPath)
        })
      },
    )

    test('lists both invalid files in one error, deterministic first', async () => {
      await inTemporaryDirectory(async (directory) => {
        const selection = await createApp(directory)
        const paths = artifactPathsFor(selection)
        await writeInvalidFile(paths.deterministicFindingsPath, JSON.stringify(agentFindingsDocument))
        await writeInvalidFile(paths.agentFindingsPath, '{invalid')

        const error = await loadError(selection)

        expect(error.message).toBe(
          'The app security check results could not be loaded because both results files are invalid.',
        )
        expect(error.nextSteps).toStrictEqual([
          ['Run', {command: command(selection, 'scan')}, 'to regenerate deterministic-findings.json.'],
          [
            'Have your coding agent run',
            {command: command(selection, 'record')},
            'again to regenerate agent-findings.json.',
          ],
          ['Or run', {command: command(selection, 'clean')}, 'to delete both results files and start over.'],
        ])
        expect(error.customSections).toStrictEqual([
          {
            title: paths.deterministicFindingsPath,
            body: {list: {items: ['source is "agent", but this file must hold "deterministic" findings.']}},
          },
          {title: paths.agentFindingsPath, body: {list: {items: [expect.stringContaining('Could not parse JSON')]}}},
        ])
      })
    })

    test('lists every translation error of a file on its own line without repeating the path', async () => {
      await inTemporaryDirectory(async (directory) => {
        const selection = await createApp(directory)
        const paths = artifactPathsFor(selection)
        const document = {...agentFindingsDocument, engine: {name: 'other'}, checks: [{id: 'X', status: 'skipped'}]}
        await writeInvalidFile(paths.agentFindingsPath, JSON.stringify(document))

        const error = await loadError(selection)

        expect(error.customSections).toHaveLength(1)
        const section = error.customSections![0]!
        expect(section.title).toBe(paths.agentFindingsPath)
        const items = (section.body as {list: {items: string[]}}).list.items
        expect(items.length).toBeGreaterThan(1)
        expect(items).toEqual(expect.arrayContaining([expect.stringMatching(/^engine\.name: /)]))
        for (const item of items) expect(item).not.toContain(paths.agentFindingsPath)
      })
    })
  })
})
