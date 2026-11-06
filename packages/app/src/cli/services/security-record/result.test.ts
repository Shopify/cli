import {renderSecurityRecordResult} from './result.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {fileRealPath, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {unstyled} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'
import type {AppSecuritySelection} from '../app-security-selection.js'
import type {AppSecuritySuppression} from '../app-security-suppressions.js'
import type {RecordedSuppressions} from '../security-record.js'

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
        {path, checks: 1, findings: 2, suppressions: null},
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

  test('warns on stderr when agent-findings.json was written without code excerpts', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const path = artifactPaths(appRoot).agentFindingsPath

      await withCapturedStandardStreams(({stderr}) => {
        renderSecurityRecordResult(
          {path, checks: 1, findings: 2, suppressions: null, codeExcerptsOmitted: true},
          {selection: selectionFor(appRoot), path: appRoot},
          'text',
        )

        const output = unstyled(stderr())
          .replaceAll(/[│╭╮╰╯─]/g, ' ')
          .replace(/\s+/g, ' ')
        expect(output).toContain(
          'agent-findings.json was written without code excerpts, because with them it would be larger than 5 MB. Record fewer or shorter findings to keep them.',
        )
        expect(output).toContain('Agent findings recorded.')
      })
    })
  })

  test('reports code excerpts left out of agent-findings.json as an event on stderr, with the JSON result', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const path = artifactPaths(appRoot).agentFindingsPath

      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runWithCommandEventsForCommand(['--json'], async () =>
          renderSecurityRecordResult(
            {path, checks: 1, findings: 2, suppressions: null, codeExcerptsOmitted: true},
            {selection: selectionFor(appRoot), path: appRoot},
            'json',
          ),
        )

        expect(JSON.parse(stdout())).toMatchObject({status: 'success', checkCount: 1, findingCount: 2})
        expect(JSON.parse(stderr())).toEqual({
          type: 'diagnostic',
          timestamp: expect.any(String),
          level: 'warning',
          message:
            'agent-findings.json was written without code excerpts, because with them it would be larger than 5 MB.\n\nRecord fewer or shorter findings to keep them.',
        })
      })
    })
  })

  test('writes one JSON result with the selected app, the results directory and the recorded file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const selection = {...selectionFor(appRoot), configClientId: 'test'}
      const path = artifactPaths(appRoot).agentFindingsPath

      await withCapturedStandardStreams(({stdout, stderr}) => {
        renderSecurityRecordResult(
          {path, checks: 1, findings: 2, suppressions: null},
          {selection, path: appRoot},
          'json',
        )

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
          suppressions: null,
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
        renderSecurityRecordResult(
          {path, checks: 0, findings: 0, suppressions: null},
          {selection, path: appRoot},
          'json',
        )

        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          app: {directory: resolve(appRoot), configurationPath: null, clientId: 'flag-client-id'},
          resultsDirectory: resolve(appRoot, '.shopify', 'app-security', 'flag-client-id'),
          path: resolve(appRoot, '.shopify', 'app-security', 'flag-client-id', 'agent-findings.json'),
          checkCount: 0,
          findingCount: 0,
          suppressions: null,
        })
      })
    })
  })

  describe("the agent's suppressions", () => {
    const entry: AppSecuritySuppression = {
      source: 'agent',
      check: 'MISSING_TENANT_ISOLATION',
      kind: 'false-positive',
      path: 'app/routes/orders.tsx',
      code: 'const orders = await prisma.order.findMany()',
      reason: 'Every order table holds one shop.',
      configurations: ['shopify.app.toml'],
    }

    function suppressions(appRoot: string): RecordedSuppressions {
      return {
        path: joinPath(appRoot, 'shopify.app-security.json'),
        saved: [{index: 2, change: 'added', entry}],
        alreadySaved: 1,
        notSaved: [
          {
            checkId: 'SCOPE_OVER_REQUEST',
            location: {file: 'shopify.app.toml', line: 4},
            problem: 'every code from its lines also names another finding of SCOPE_OVER_REQUEST in shopify.app.toml',
          },
        ],
      }
    }

    test('say how many were saved and already saved, to review and commit the file, and which were not saved', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const path = artifactPaths(appRoot).agentFindingsPath
        const output = mockAndCaptureOutput()
        output.clear()

        renderSecurityRecordResult(
          {path, checks: 2, findings: 3, suppressions: suppressions(appRoot)},
          {selection: selectionFor(appRoot), path: appRoot},
          'text',
        )

        const success = unstyled(output.info())
        expect(success).toContain('Saved 1 suppression to shopify.app-security.json.')
        expect(success).toContain('1 suppression was already in shopify.app-security.json.')
        expect(success).toContain('Review and commit shopify.app-security.json.')
        const warning = unstyled(output.warn())
        expect(warning).toContain("1 suppression couldn't be saved to shopify.app-security.json.")
        expect(warning).toContain('shopify.app.toml:4 · SCOPE_OVER_REQUEST')
        expect(warning.replace(/[│\s]+/g, ' ')).toContain(
          "It can't be saved because every code from its lines also names another finding of SCOPE_OVER_REQUEST in shopify.app.toml.",
        )
        output.clear()
      })
    })

    test('say nothing about the file when the document has no suppression', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const output = mockAndCaptureOutput()
        output.clear()

        renderSecurityRecordResult(
          {path: artifactPaths(appRoot).agentFindingsPath, checks: 1, findings: 2, suppressions: null},
          {selection: selectionFor(appRoot), path: appRoot},
          'text',
        )

        expect(output.info()).not.toContain('shopify.app-security.json')
        expect(output.warn()).toBe('')
        output.clear()
      })
    })

    test('are in the JSON result with absolute native paths and the kind as the file spells it', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const path = artifactPaths(appRoot).agentFindingsPath

        await withCapturedStandardStreams(({stdout}) => {
          renderSecurityRecordResult(
            {path, checks: 2, findings: 3, suppressions: suppressions(appRoot)},
            {selection: selectionFor(appRoot), path: appRoot},
            'json',
          )

          expect(JSON.parse(stdout()).suppressions).toStrictEqual({
            filePath: resolve(appRoot, 'shopify.app-security.json'),
            entries: [
              {
                index: 2,
                change: 'added',
                source: 'agent',
                check: 'MISSING_TENANT_ISOLATION',
                kind: 'false-positive',
                path: resolve(appRoot, 'app', 'routes', 'orders.tsx'),
                code: 'const orders = await prisma.order.findMany()',
                reason: 'Every order table holds one shop.',
                configurations: ['shopify.app.toml'],
              },
            ],
            alreadySavedCount: 1,
            notSaved: [
              {
                checkId: 'SCOPE_OVER_REQUEST',
                location: {filePath: resolve(appRoot, 'shopify.app.toml'), line: 4},
                message:
                  'every code from its lines also names another finding of SCOPE_OVER_REQUEST in shopify.app.toml',
              },
            ],
          })
        })
      })
    })
  })
})
