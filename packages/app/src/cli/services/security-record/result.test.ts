import {renderSecurityRecordResult} from './result.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {fileRealPath, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
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
          {
            checkId: 'MISSING_TENANT_ISOLATION',
            location: {file: 'app/routes/orders.tsx', line: 3},
            problem:
              'every code from its lines also names another finding of MISSING_TENANT_ISOLATION in app/routes/orders.tsx',
            withoutCode: {findingCount: 2},
          },
        ],
      }
    }

    test('say how many were saved and already saved, to review and commit the file, and which were not saved and why', async () => {
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
        expect(warning).toContain("2 suppressions couldn't be saved to shopify.app-security.json.")
        expect(warning).toContain('shopify.app.toml:4 · SCOPE_OVER_REQUEST')
        expect(warning).toContain('app/routes/orders.tsx:3 · MISSING_TENANT_ISOLATION')
        const text = warning.replace(/[│\s]+/g, ' ')
        expect(text).toContain(
          "They're recorded in agent-findings.json, so they apply to these findings only, until the next record. To keep them, add entries to shopify.app-security.json by hand.",
        )
        expect(text).toContain(
          "It can't be saved because every code from its lines also names another finding of SCOPE_OVER_REQUEST in shopify.app.toml. Give its entry a code that names it alone.",
        )
        // No code can name the second one alone, so the advice is an entry without code, or a change to the code.
        expect(text).toContain(
          "It can't be saved because every code from its lines also names another finding of MISSING_TENANT_ISOLATION in app/routes/orders.tsx. No code from its lines, evidence or message names it alone. An agent entry without code suppresses all 2 agent findings of MISSING_TENANT_ISOLATION in that file. To keep only this one suppressed, change the code so that the findings differ.",
        )
        expect(text.match(/a code that names it alone/g)).toHaveLength(1)
        output.clear()
      })
    })

    /** The text of the "not saved" warning for these suppressions, on one line. */
    async function notSavedWarning(notSaved: RecordedSuppressions['notSaved']): Promise<string> {
      let text = ''
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const output = mockAndCaptureOutput()
        output.clear()

        renderSecurityRecordResult(
          {
            path: artifactPaths(appRoot).agentFindingsPath,
            checks: 1,
            findings: 3,
            suppressions: {path: joinPath(appRoot, 'shopify.app-security.json'), saved: [], alreadySaved: 0, notSaved},
          },
          {selection: selectionFor(appRoot), path: appRoot},
          'text',
        )

        text = unstyled(output.warn()).replace(/[│\s]+/g, ' ')
        output.clear()
      })
      return text
    }

    const wildcardPath = {
      checkId: 'MISSING_TENANT_ISOLATION',
      location: {file: 'app/routes/*.tsx', line: 3},
      problem: "its entry would be invalid: path: can't contain wildcards: name one file",
      invalidFields: ['path'],
    }

    test('say that no entry can keep a suppression whose path the file cannot name, and advise no entry by hand', async () => {
      const text = await notSavedWarning([wildcardPath])

      expect(text).toContain(
        "They're recorded in agent-findings.json, so they apply to these findings only, until the next record. • app/routes/*.tsx:3",
      )
      expect(text).toContain(
        "It can't be saved because its entry would be invalid: path: can't contain wildcards: name one file. shopify.app-security.json can't name this path, so no entry can keep it. An entry for it by hand would make the file invalid too.",
      )
      expect(text).not.toContain('add entries')
      expect(text).not.toContain('a code that names it alone')
    })

    test('advise entries by hand only for the suppressions that the file can name', async () => {
      const text = await notSavedWarning([
        wildcardPath,
        {
          checkId: 'SCOPE_OVER_REQUEST',
          location: {file: 'shopify.app.toml', line: 4},
          problem: 'every code from its lines also names another finding of SCOPE_OVER_REQUEST in shopify.app.toml',
        },
      ])

      expect(text).toContain(
        'until the next record. To keep the ones that shopify.app-security.json can name, add entries to it by hand.',
      )
      expect(text).toContain('so no entry can keep it.')
      expect(text).toContain('Give its entry a code that names it alone.')
    })

    test('advise no entry by hand when another field would make the entry invalid', async () => {
      const text = await notSavedWarning([
        {
          checkId: 'CREDENTIAL_LOGGING',
          location: {file: 'app/routes/orders.tsx', line: 3},
          problem: 'its entry would be invalid: check: not a known check ID',
          invalidFields: ['check'],
        },
      ])

      expect(text).toContain(
        "It can't be saved because its entry would be invalid: check: not a known check ID. An entry for it by hand with the same values would make shopify.app-security.json invalid too.",
      )
      expect(text).not.toContain('add entries')
    })

    test('keep the JSON fields of a suppression whose entry would be invalid', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const suppressions = {path: joinPath(appRoot, 'shopify.app-security.json'), saved: [], alreadySaved: 0}

        await withCapturedStandardStreams(({stdout}) => {
          renderSecurityRecordResult(
            {
              path: artifactPaths(appRoot).agentFindingsPath,
              checks: 1,
              findings: 1,
              suppressions: {...suppressions, notSaved: [wildcardPath]},
            },
            {selection: selectionFor(appRoot), path: appRoot},
            'json',
          )

          expect(JSON.parse(stdout()).suppressions.notSaved).toStrictEqual([
            {
              checkId: 'MISSING_TENANT_ISOLATION',
              location: {filePath: resolve(appRoot, 'app', 'routes', '*.tsx'), line: 3},
              message: "its entry would be invalid: path: can't contain wildcards: name one file",
            },
          ])
        })
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
            // The advice is in the text output only, so the JSON keeps its fields.
            notSaved: [
              {
                checkId: 'SCOPE_OVER_REQUEST',
                location: {filePath: resolve(appRoot, 'shopify.app.toml'), line: 4},
                message:
                  'every code from its lines also names another finding of SCOPE_OVER_REQUEST in shopify.app.toml',
              },
              {
                checkId: 'MISSING_TENANT_ISOLATION',
                location: {filePath: resolve(appRoot, 'app', 'routes', 'orders.tsx'), line: 3},
                message:
                  'every code from its lines also names another finding of MISSING_TENANT_ISOLATION in app/routes/orders.tsx',
              },
            ],
          })
        })
      })
    })
  })
})
