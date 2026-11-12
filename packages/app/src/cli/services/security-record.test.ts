import securityRecord from './security-record.js'
import {git, isolateGitConfig} from './app-security-engine/tests/git-test-helpers.js'
import {
  appSecurityArtifactPaths,
  appSecuritySuppressionsPath,
  readFindingsDocument,
  writeAgentFindings,
  writeCheckArtifacts,
} from './app-security-artifacts.js'
import {agentChecks, deterministicFindings} from './security-check.test-data.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {
  fileExists,
  fileRealPath,
  fileSize,
  inTemporaryDirectory,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from '@shopify/cli-kit/node/fs'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type {AppSecuritySelection} from './app-security-selection.js'
import type {SecurityRecordDependencies} from './security-record.js'
import type {AgentFindingsDocument, AppSecurityScope} from './app-security-engine/index.js'

// Composed at runtime so the literal token never appears in the repository.
const FAKE_SHOPIFY_TOKEN = ['shpat', '_', '0123456789abcdef'.repeat(2)].join('')

const REJECTED_MESSAGE = 'The findings document was rejected. Nothing was recorded.'

function finding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    check_id: 'MISSING_TENANT_ISOLATION',
    check_version: 1,
    file: 'app/routes/orders.tsx',
    line: 12,
    message: 'Orders are loaded without a shop filter',
    evidence: [{file: 'app/routes/orders.tsx', line: 12, quote: 'prisma.order.findMany()'}],
    ...overrides,
  }
}

const NO_SCOPE = {include_dirs: [], excludes: [], no_git_ignore: false}

function validDocument(): Record<string, unknown> {
  return {
    schema_version: 2,
    scope: NO_SCOPE,
    checks_executed: [
      {check_id: 'MISSING_TENANT_ISOLATION', check_version: 1, status: 'executed'},
      {
        check_id: 'OPEN_REDIRECT',
        check_version: 1,
        status: 'not_applicable',
        reason: {code: 'no_redirects', message: 'The app never redirects'},
      },
    ],
    findings: [finding(), finding({line: 30})],
  }
}

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

async function record(appRoot: string, dependencies: SecurityRecordDependencies) {
  return securityRecord({selection: selectionFor(appRoot), path: appRoot}, dependencies)
}

function testDependencies(stdin: string | undefined): SecurityRecordDependencies {
  return {
    readStdin: vi.fn(async () => stdin),
    engineVersion: () => '3.99.0',
    writeAgentFindings: vi.fn(writeAgentFindings),
    recordMetadata: vi.fn(async () => {}),
  }
}

function recordCommand(appRoot: string): string {
  return formatAppSecurityCommand(resolveAppSecurityCommands(selectionFor(appRoot), appRoot).record)
}

async function readRecorded(appRoot: string): Promise<AgentFindingsDocument> {
  return JSON.parse(await readFile(artifactPaths(appRoot).agentFindingsPath)) as AgentFindingsDocument
}

/** The custom section of a rejection error, which lists every validation error. */
function errorsSection(errors: unknown[]) {
  return [{title: 'Errors', body: {list: {items: errors}}}]
}

async function recordError(appRoot: string, dependencies: SecurityRecordDependencies): Promise<AbortError> {
  const error: unknown = await record(appRoot, dependencies).catch((error: unknown) => error)
  expect(error).toBeInstanceOf(AbortError)
  return error as AbortError
}

/** Asserts the rejection error and that neither a new nor an existing agent-findings.json was touched. */
async function expectRejected(stdin: string | undefined, expectedErrors: unknown[]) {
  await inTemporaryDirectory(async (directory) => {
    const appRoot = await createApp(directory)
    const dependencies = testDependencies(stdin)

    const error = await recordError(appRoot, dependencies)

    expect(error.message).toBe(REJECTED_MESSAGE)
    expect(error.customSections).toEqual(errorsSection(expectedErrors))
    expect(error.code).toBe('findings-document-rejected')
    expect(error.details).toEqual({errors: expectedErrors})
    expect(dependencies.writeAgentFindings).not.toHaveBeenCalled()
    expect(dependencies.recordMetadata).not.toHaveBeenCalled()
    await expect(fileExists(artifactPaths(appRoot).agentFindingsPath)).resolves.toBe(false)
  })
}

describe('securityRecord', () => {
  test('writes agent-findings.json, returns the counts, and prints nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const output = mockAndCaptureOutput()
      output.clear()

      const result = await record(appRoot, testDependencies(JSON.stringify(validDocument())))

      expect(result).toStrictEqual({
        path: artifactPaths(appRoot).agentFindingsPath,
        checks: 2,
        findings: 2,
        suppressions: null,
      })
      const recorded = await readRecorded(appRoot)
      expect(recorded.engine.version).toBe('3.99.0')
      expect(recorded).not.toHaveProperty('project')
      expect(recorded.checks.map((check) => [check.id, check.findings.length])).toEqual([
        ['MISSING_TENANT_ISOLATION', 2],
        ['OPEN_REDIRECT', 0],
      ])
      // Debug logs from the file writes are diagnostics, not presentation.
      expect(output.info()).toBe('')
      expect(output.success()).toBe('')
      expect(output.warn()).toBe('')
      expect(output.error()).toBe('')
      output.clear()
    })
  })

  test('records the number of agent findings in the command metadata', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const dependencies = testDependencies(JSON.stringify(validDocument()))

      await record(appRoot, dependencies)

      expect(dependencies.recordMetadata).toHaveBeenCalledWith({num_security_findings: 2})
    })
  })

  test('records findings when there is no deterministic-findings.json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const paths = artifactPaths(appRoot)

      await record(appRoot, testDependencies(JSON.stringify(validDocument())))

      await expect(fileExists(paths.deterministicFindingsPath)).resolves.toBe(false)
      await expect(fileExists(paths.agentFindingsPath)).resolves.toBe(true)
    })
  })

  test('writes agent-findings.json under the --client-id results key when one is passed', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const selection = {...selectionFor(appRoot), clientIdOverride: 'other-client-id'}

      const result = await securityRecord({selection, path: appRoot}, testDependencies(JSON.stringify(validDocument())))

      expect(result.path).toBe(appSecurityArtifactPaths(appRoot, 'other-client-id').agentFindingsPath)
      await expect(fileExists(result.path)).resolves.toBe(true)
      await expect(fileExists(artifactPaths(appRoot).agentFindingsPath)).resolves.toBe(false)
    })
  })

  test('ignores an existing deterministic-findings.json, even one that disagrees with the recorded findings', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const paths = artifactPaths(appRoot)
      await mkdir(paths.resultsDirectory)
      const staleScan = JSON.stringify({
        schema_version: 2,
        commit: 'zzz999-does-not-match',
        generated_at: '2000-01-01T00:00:00.000Z',
        findings: [],
      })
      await writeFile(paths.deterministicFindingsPath, staleScan)

      await record(appRoot, testDependencies(JSON.stringify(validDocument())))

      await expect(fileExists(paths.agentFindingsPath)).resolves.toBe(true)
      await expect(readFile(paths.deterministicFindingsPath)).resolves.toBe(staleScan)
    })
  })

  test('rejects the whole document with every error and leaves the existing file untouched', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const paths = artifactPaths(appRoot)
      await mkdir(paths.resultsDirectory)
      const previousFindings = '{"previous": "findings — ünchanged"}\n'
      await writeFile(paths.agentFindingsPath, previousFindings)
      const dependencies = testDependencies(
        JSON.stringify({
          schema_version: 2,
          scope: NO_SCOPE,
          checks_executed: [{check_id: 'OPEN_REDIRECT', check_version: 1, status: 'unresolved'}],
          findings: [finding(), finding({line: 0}), finding({evidence: []})],
        }),
      )

      const error = await recordError(appRoot, dependencies)

      const errors = [
        'checks_executed[0] (OPEN_REDIRECT): unresolved requires a reason',
        'findings[1] (MISSING_TENANT_ISOLATION): invalid line number: 0',
        'findings[2] (MISSING_TENANT_ISOLATION): finding requires at least one evidence citation',
      ]
      expect(error.message).toBe(REJECTED_MESSAGE)
      expect(error.customSections).toStrictEqual(errorsSection(errors))
      expect(error.code).toBe('findings-document-rejected')
      expect(error.details).toStrictEqual({errors})
      expect(error.nextSteps).toStrictEqual([
        ['Fix every error, then run', {command: recordCommand(appRoot)}, 'again.'],
      ])
      expect(dependencies.writeAgentFindings).not.toHaveBeenCalled()
      await expect(readFile(paths.agentFindingsPath)).resolves.toBe(previousFindings)
    })
  })

  test('rejects an unknown check', async () => {
    await expectRejected(
      JSON.stringify({
        schema_version: 2,
        scope: NO_SCOPE,
        checks_executed: [{check_id: 'NOT_A_CHECK', check_version: 1, status: 'executed'}],
      }),
      ['checks_executed[0] (NOT_A_CHECK): unknown check_id'],
    )
  })

  test('rejects an unsupported schema version', async () => {
    await expectRejected(JSON.stringify({schema_version: 1, scope: NO_SCOPE}), [
      'schema_version must be 2. Version 1 is from an earlier Shopify CLI: run check again and follow its instructions.',
    ])
  })

  test('rejects a document without a scope', async () => {
    const {scope: _scope, ...withoutScope} = validDocument()

    await expectRejected(JSON.stringify(withoutScope), ['scope is required and must be an object'])
  })

  test.each([
    [{excludes: [], no_git_ignore: false}, 'scope.include_dirs must be an array of strings'],
    [{include_dirs: [], excludes: 'generated', no_git_ignore: false}, 'scope.excludes must be an array of strings'],
    [{include_dirs: [1], excludes: [], no_git_ignore: false}, 'scope.include_dirs must be an array of strings'],
    [{include_dirs: [], excludes: []}, 'scope.no_git_ignore must be a boolean'],
    [{include_dirs: [], excludes: [], no_git_ignore: 'yes'}, 'scope.no_git_ignore must be a boolean'],
    ['--no-git-ignore', 'scope is required and must be an object'],
  ])('rejects a malformed scope %j', async (scope, expectedError) => {
    await expectRejected(JSON.stringify({...validDocument(), scope}), [expectedError])
  })

  test('writes the scope into agent-findings.json exactly as reported, without unknown keys', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const scope = {include_dirs: ['../backend', './lib/'], excludes: ['**/generated'], no_git_ignore: true}

      await record(appRoot, testDependencies(JSON.stringify({...validDocument(), scope: {...scope, extra: 1}})))

      expect((await readRecorded(appRoot)).scope).toEqual(scope)
    })
  })

  test('keeps the claimed check version and populates the check snapshot', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const document = {
        schema_version: 2,
        scope: NO_SCOPE,
        checks_executed: [{check_id: 'MISSING_TENANT_ISOLATION', check_version: 99, status: 'executed'}],
        findings: [finding({check_version: 99})],
      }

      await record(appRoot, testDependencies(JSON.stringify(document)))

      const [check] = (await readRecorded(appRoot)).checks
      expect(check!.version).toBe(99)
      expect(check!.snapshot).toEqual(
        expect.objectContaining({
          title: expect.any(String),
          severity: expect.any(String),
          description: expect.any(String),
          current_version: expect.any(Number),
          guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
        }),
      )
      expect(check!.snapshot.title).not.toBe('')
    })
  })

  test('redacts secrets in agent text', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const document = {
        schema_version: 2,
        scope: NO_SCOPE,
        findings: [
          finding({
            message: `Leaks ${FAKE_SHOPIFY_TOKEN}`,
            reasoning: `Found ${FAKE_SHOPIFY_TOKEN}`,
            evidence: [{file: 'app/routes/orders.tsx', line: 1, quote: FAKE_SHOPIFY_TOKEN}],
          }),
        ],
      }

      await record(appRoot, testDependencies(JSON.stringify(document)))

      const written = await readFile(artifactPaths(appRoot).agentFindingsPath)
      expect(written).toContain('Leaks')
      expect(written).not.toContain(FAKE_SHOPIFY_TOKEN)
    })
  })

  describe('redacts secrets quoted in validation errors', () => {
    const documentWithSecrets = JSON.stringify({
      schema_version: 2,
      scope: NO_SCOPE,
      checks_executed: [{check_id: FAKE_SHOPIFY_TOKEN, check_version: 1}],
      findings: [
        finding({check_id: FAKE_SHOPIFY_TOKEN}),
        finding({file: `/${FAKE_SHOPIFY_TOKEN}`}),
        finding({line: FAKE_SHOPIFY_TOKEN}),
      ],
    })
    const redactedErrors = [
      expect.stringMatching(/^checks_executed\[0\] \(.*REDACTED.*\): unknown check_id$/),
      expect.stringMatching(/^findings\[0\] \(.*REDACTED.*\): unknown check_id$/),
      expect.stringMatching(/^findings\[1\] \(MISSING_TENANT_ISOLATION\): unsafe file path .*REDACTED/),
      expect.stringMatching(/^findings\[2\] \(MISSING_TENANT_ISOLATION\): invalid line number: .*REDACTED/),
    ]

    test('in the terminal', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const error = await recordError(appRoot, testDependencies(documentWithSecrets))
        expect(error.customSections).toStrictEqual(errorsSection(redactedErrors))

        const output = mockAndCaptureOutput()
        output.clear()
        try {
          await handler(error)

          expect(output.error()).toContain('unknown check_id')
          expect(output.error()).toContain('REDACTED')
          expect(output.error()).not.toContain(FAKE_SHOPIFY_TOKEN)
        } finally {
          output.clear()
        }
      })
    })

    test('in the error details', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)

        const error = await recordError(appRoot, testDependencies(documentWithSecrets))

        expect(error.details).toStrictEqual({errors: redactedErrors})
        expect(JSON.stringify(error.details)).not.toContain(FAKE_SHOPIFY_TOKEN)
      })
    })
  })

  test('fails when nothing is piped on stdin', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const dependencies = testDependencies(undefined)

      const error = await recordError(appRoot, dependencies)

      expect(error.message).toBe('No findings document was piped on stdin.')
      expect(error.code).toBe('findings-document-missing')
      expect(error.details).toBeUndefined()
      expect(error.nextSteps).toStrictEqual([
        ['Pipe the findings document on stdin:', {command: recordCommand(appRoot)}],
      ])
      expect(recordCommand(appRoot)).toContain('shopify app security record --path')
      expect(error.customSections).toBeUndefined()
      await expect(fileExists(artifactPaths(appRoot).agentFindingsPath)).resolves.toBe(false)
    })
  })

  test('rejects stdin that exceeds the read limit', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const dependencies = testDependencies(undefined)
      vi.mocked(dependencies.readStdin).mockRejectedValue(
        new AbortError('Stdin input exceeded the maximum allowed size.'),
      )

      const error = await recordError(appRoot, dependencies)

      expect(error.message).toBe(REJECTED_MESSAGE)
      expect(error.customSections).toStrictEqual(errorsSection(['Stdin input exceeded the maximum allowed size.']))
      expect(error.code).toBe('findings-document-rejected')
      expect(error.details).toStrictEqual({errors: ['Stdin input exceeded the maximum allowed size.']})
      await expect(fileExists(artifactPaths(appRoot).agentFindingsPath)).resolves.toBe(false)
    })
  })

  test('rejects a document over 5 MB, measured in bytes', async () => {
    // 2.6 million two-byte characters: under 5 million characters but over 5 MB.
    const document = JSON.stringify({...validDocument(), padding: 'é'.repeat(2_600_000)})

    await expectRejected(document, [expect.stringContaining('the limit is 5 MB')])
  })

  describe('near the 5 MB limit', () => {
    // 1,000 findings of about 5 KB each. The stored document adds about 180 KB of snapshots and indentation,
    // so the reasoning length decides which side of the limit the stored file lands on.
    function nearLimitDocument(reasoningLength: number): string {
      return JSON.stringify({
        schema_version: 2,
        scope: NO_SCOPE,
        findings: Array.from({length: 1_000}, (_, index) =>
          finding({line: index + 1, message: 'm'.repeat(4_000), reasoning: 'r'.repeat(reasoningLength)}),
        ),
      })
    }

    test('rejects a document under the input limit whose stored form review could not read', async () => {
      const document = nearLimitDocument(700)
      expect(Buffer.byteLength(document)).toBeLessThan(5_000_000)

      await expectRejected(document, [
        expect.stringMatching(/^The recorded findings would be stored as \d+ bytes; the limit is 5 MB\./),
      ])
    })

    test('records a document that review can read', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const {agentFindingsPath} = artifactPaths(appRoot)

        await record(appRoot, testDependencies(nearLimitDocument(500)))

        await expect(fileSize(agentFindingsPath)).resolves.toBeGreaterThan(4_900_000)
        await expect(readFindingsDocument(agentFindingsPath, 'agent')).resolves.toMatchObject({status: 'ok'})
      })
    })
  })

  describe('code excerpts', () => {
    const orders = Array.from({length: 15}, (_, index) => `line ${index + 1}`)
    const excerptOf = (first: number, last: number) =>
      orders.slice(first - 1, last).map((text, index) => ({line: first + index, text}))

    /** An app directory below `directory`, so a cited path can leave it. */
    async function createNestedApp(directory: string): Promise<string> {
      await mkdir(joinPath(directory, 'app'))
      return createApp(joinPath(directory, 'app'))
    }

    let restoreGitConfig: (() => void) | undefined
    beforeEach(() => {
      restoreGitConfig = isolateGitConfig()
    })
    afterEach(() => {
      restoreGitConfig?.()
    })

    /** Writes each file below the app directory, creating its directory. */
    async function writeAppFiles(appRoot: string, files: Record<string, string>): Promise<void> {
      for (const [path, content] of Object.entries(files)) {
        // eslint-disable-next-line no-await-in-loop
        await mkdir(dirname(joinPath(appRoot, path)))
        // eslint-disable-next-line no-await-in-loop
        await writeFile(joinPath(appRoot, path), content)
      }
    }

    /** Records one finding on line 1 of each file, and returns each file's stored excerpt. */
    async function recordedExcerpts(appRoot: string, files: string[], scope: AppSecurityScope = NO_SCOPE) {
      const document = {
        ...validDocument(),
        scope,
        findings: files.map((file) => finding({file, line: 1, evidence: [{file, line: 1}]})),
      }
      await record(appRoot, testDependencies(JSON.stringify(document)))
      const findings = (await readRecorded(appRoot)).checks[0]!.findings
      return Object.fromEntries(findings.map((stored) => [stored.location.file, stored.code_excerpt]))
    }

    test('stores the lines each finding cites, read from the files in the app directory', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        await mkdir(joinPath(appRoot, 'app/routes'))
        await writeFile(joinPath(appRoot, 'app/routes/orders.tsx'), `${orders.join('\n')}\n`)

        await record(appRoot, testDependencies(JSON.stringify(validDocument())))

        const [first, second] = (await readRecorded(appRoot)).checks[0]!.findings
        expect(first!.code_excerpt).toEqual(excerptOf(10, 14))
        expect(first!.evidence).toEqual([
          {
            location: {file: 'app/routes/orders.tsx', line: 12},
            quote: 'prisma.order.findMany()',
            code_excerpt: excerptOf(12, 12),
          },
        ])
        // Line 30 is past the end of the file.
        expect(second).not.toHaveProperty('code_excerpt')
      })
    })

    test.each([
      ['.env', 'config.ts'],
      ['secrets.json', 'config.ts'],
      ['credentials.json', 'config.ts'],
      ['.npmrc', 'config.ts'],
      ['Secrets.json', 'config.ts'],
      ['source.ts', '.env'],
      ['source.ts', 'secrets.json'],
      ['source.ts', 'server.pem'],
    ])('omits excerpts for target %s cited through %s', async (targetFile, citedFile) => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const secret = '0123456789abcdef'.repeat(2)
        await writeFile(joinPath(appRoot, targetFile), `SHOPIFY_API_SECRET=${secret}\n`)
        await symlink(joinPath(appRoot, targetFile), joinPath(appRoot, citedFile))

        await recordedExcerpts(appRoot, [citedFile])

        const written = await readFile(artifactPaths(appRoot).agentFindingsPath)
        expect(written).not.toContain('code_excerpt')
        expect(written).not.toContain(secret)
      })
    })

    test.each(['.envrc', '.dev.vars', 'config/secrets.yml', '.npmrc', '.netrc', 'config/master.key', 'Secrets.json'])(
      'omits excerpts for the secret file %s',
      async (file) => {
        await inTemporaryDirectory(async (directory) => {
          const appRoot = await createApp(directory)
          // No redaction pattern knows a bare value, so only leaving the file out keeps it out of the excerpt.
          const secret = 'fedcba9876543210'.repeat(2)
          await mkdir(dirname(joinPath(appRoot, file)))
          await writeFile(joinPath(appRoot, file), `${secret}\n`)

          await recordedExcerpts(appRoot, [file])

          const written = await readFile(artifactPaths(appRoot).agentFindingsPath)
          expect(written).not.toContain('code_excerpt')
          expect(written).not.toContain(secret)
        })
      },
    )

    test('keeps excerpts for an in-root symlink to an ordinary source file', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        await writeFile(joinPath(appRoot, 'source.ts'), `${orders.join('\n')}\n`)
        await symlink(joinPath(appRoot, 'source.ts'), joinPath(appRoot, 'link.ts'))
        const document = {
          ...validDocument(),
          findings: [finding({file: 'link.ts', evidence: [{file: 'link.ts', line: 12}]})],
        }

        await record(appRoot, testDependencies(JSON.stringify(document)))

        const [stored] = (await readRecorded(appRoot)).checks[0]!.findings
        expect(stored!.code_excerpt).toEqual(excerptOf(10, 14))
        expect(stored!.evidence[0]!.code_excerpt).toEqual(excerptOf(12, 12))
      })
    })

    test("doesn't read a cited file outside the app directory, or through a symbolic link that leaves it", async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createNestedApp(directory)
        await writeFile(joinPath(directory, 'outside.ts'), `${orders.join('\n')}\n`)
        await symlink(joinPath(directory, 'outside.ts'), joinPath(appRoot, 'link.ts'))
        const document = {
          ...validDocument(),
          findings: [finding({file: '../outside.ts', evidence: [{file: 'link.ts', line: 12}]})],
        }

        await record(appRoot, testDependencies(JSON.stringify(document)))

        const written = await readFile(artifactPaths(appRoot).agentFindingsPath)
        expect(written).not.toContain('code_excerpt')
        expect(written).not.toContain('line 12')
      })
    })

    test("reads a cited file in an extension directory that the app's configuration adds outside it", async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createNestedApp(directory)
        const extensionDirectory = joinPath(directory, 'extensions')
        await mkdir(extensionDirectory)
        await writeFile(joinPath(extensionDirectory, 'block.liquid'), `${orders.join('\n')}\n`)
        const selection = {...selectionFor(appRoot), appConfigDirectories: [await fileRealPath(extensionDirectory)]}
        const document = {
          ...validDocument(),
          findings: [finding({file: '../extensions/block.liquid', evidence: [{file: '../extensions/block.liquid'}]})],
        }

        await securityRecord({selection, path: appRoot}, testDependencies(JSON.stringify(document)))

        const [stored] = (await readRecorded(appRoot)).checks[0]!.findings
        expect(stored!.code_excerpt).toEqual(excerptOf(10, 14))
      })
    })

    test("doesn't read a cited file that check doesn't gather: one that Git ignores, or one in .git", async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const secret = 'fedcba9876543210'.repeat(2)
        await writeAppFiles(appRoot, {
          '.gitignore': 'config/local.js\n',
          'config/local.js': `export const signingKey = '${secret}'\n`,
          'app/routes/orders.tsx': `${orders.join('\n')}\n`,
        })
        git(appRoot, ['init', '-q', '.'])
        git(appRoot, ['remote', 'add', 'origin', `https://deploy:${secret}@git.example.com/app.git`])

        const excerpts = await recordedExcerpts(appRoot, ['config/local.js', '.git/config', 'app/routes/orders.tsx'])

        expect(excerpts).toEqual({
          'config/local.js': undefined,
          '.git/config': undefined,
          'app/routes/orders.tsx': excerptOf(1, 3),
        })
        await expect(readFile(artifactPaths(appRoot).agentFindingsPath)).resolves.not.toContain(secret)
      })
    })

    test("reads the cited files that check gathers with the document's excludes and no_git_ignore", async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        await writeAppFiles(appRoot, {
          '.gitignore': 'config/local.js\n',
          'config/local.js': `${orders.join('\n')}\n`,
          'app/generated/schema.ts': `${orders.join('\n')}\n`,
        })
        git(appRoot, ['init', '-q', '.'])
        // `--exclude` globs are matched from the working directory.
        vi.stubEnv('INIT_CWD', appRoot)

        const excerpts = await recordedExcerpts(appRoot, ['config/local.js', 'app/generated/schema.ts'], {
          include_dirs: [],
          excludes: ['app/generated'],
          no_git_ignore: true,
        })

        expect(excerpts).toEqual({'config/local.js': excerptOf(1, 3), 'app/generated/schema.ts': undefined})
      })
    })

    /**
     * An app below `directory` with a `shared` directory next to it, and the deterministic-findings.json of a check run
     * with `--include-dir ../shared`.
     */
    async function createAppWithIncludeDirectory(directory: string): Promise<string> {
      const appRoot = await createNestedApp(directory)
      await mkdir(joinPath(directory, 'shared'))
      await writeFile(joinPath(directory, 'shared', 'util.ts'), `${orders.join('\n')}\n`)
      await writeCheckArtifacts(appRoot, 'shopify.app', {
        deterministicFindings: {
          ...deterministicFindings,
          coverage: {
            ...deterministicFindings.coverage,
            scope: {include_dirs: ['../shared'], excludes: [], no_git_ignore: false},
            scan_directories: [
              {directory: '.', origin: 'app_directory'},
              {directory: '../shared', origin: 'include_dir'},
            ],
          },
        },
        agentChecks,
      })
      return appRoot
    }

    test.each([
      ['matches the check run', ['../shared'], true],
      ['names other include directories', ['../other'], false],
      ['names none', [], false],
    ])(
      'captures a cited file in --include-dir only when the document %s',
      async (_description, includeDirs, captured) => {
        await inTemporaryDirectory(async (directory) => {
          const appRoot = await createAppWithIncludeDirectory(directory)

          const excerpts = await recordedExcerpts(appRoot, ['../shared/util.ts'], {
            include_dirs: includeDirs,
            excludes: [],
            no_git_ignore: false,
          })

          expect(excerpts).toEqual({'../shared/util.ts': captured ? excerptOf(1, 3) : undefined})
        })
      },
    )

    test('stores the findings without excerpts when the excerpts would make the file too large for review', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        await mkdir(joinPath(appRoot, 'app/routes'))
        await writeFile(joinPath(appRoot, 'app/routes/orders.tsx'), `${'x'.repeat(400)}\n`.repeat(1_000))
        // About 4.9 MB stored without excerpts; each finding's five excerpt lines add about 2 KB.
        const document = JSON.stringify({
          schema_version: 2,
          scope: NO_SCOPE,
          findings: Array.from({length: 1_000}, (_, index) =>
            finding({line: index + 1, message: 'm'.repeat(4_000), reasoning: 'r'.repeat(500)}),
          ),
        })

        const result = await record(appRoot, testDependencies(document))

        const {agentFindingsPath} = artifactPaths(appRoot)
        await expect(readFindingsDocument(agentFindingsPath, 'agent')).resolves.toMatchObject({status: 'ok'})
        await expect(readFile(agentFindingsPath)).resolves.not.toContain('code_excerpt')
        expect(result.codeExcerptsOmitted).toBe(true)
      })
    })
  })

  describe("the agent's suppressions", () => {
    const orderLines = [
      'export async function loader({request}) {',
      '  const {session} = await authenticate.admin(request)',
      '  const orders = await prisma.order.findMany()',
      '  return json(orders)',
      '}',
      'export async function action({request}) {',
      '  const {session} = await authenticate.admin(request)',
      '  await prisma.order.deleteMany()',
      '  return null',
      '}',
    ]
    const suppression = {justification: 'Every order table holds one shop.', kind: 'false-positive'}

    async function createAppWithRoute(directory: string): Promise<string> {
      const appRoot = await createApp(directory)
      await mkdir(joinPath(appRoot, 'app/routes'))
      await writeFile(joinPath(appRoot, 'app/routes/orders.tsx'), `${orderLines.join('\n')}\n`)
      return appRoot
    }

    function documentWith(findings: Record<string, unknown>[]): string {
      return JSON.stringify({schema_version: 2, scope: NO_SCOPE, findings})
    }

    const savedEntry = {
      source: 'agent',
      check: 'MISSING_TENANT_ISOLATION',
      kind: 'false-positive',
      path: 'app/routes/orders.tsx',
      code: 'const orders = await prisma.order.findMany()',
      reason: 'Every order table holds one shop.',
    }

    test.each([
      [
        'its own line',
        2,
        'const password',
        ['export function connect() {', '  const password: string = "hunter2xyz"', '}'],
      ],
      [
        'a neighbouring line',
        3,
        'return $db->orders->all()',
        [
          'function load() {',
          "  $db = connect(['password' => 'hunter2xyz']);",
          '  return $db->orders->all();',
          '}',
          'function list() {',
          '  $db = connect_readonly();',
          '  return $db->orders->all();',
          '}',
        ],
      ],
    ])('never saves a secret that the code of an entry takes from %s', async (_description, line, quote, lines) => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        await mkdir(joinPath(appRoot, 'app'))
        await writeFile(joinPath(appRoot, 'app/settings.php'), `${lines.join('\n')}\n`)
        const document = documentWith([
          finding({file: 'app/settings.php', line, evidence: [{file: 'app/settings.php', line, quote}], suppression}),
          finding({
            file: 'app/settings.php',
            line: 7,
            evidence: [{file: 'app/settings.php', line: 7, quote: 'return'}],
          }),
        ])

        const result = await record(appRoot, testDependencies(document))

        expect(result.suppressions?.saved).toHaveLength(1)
        await expect(readFile(appSecuritySuppressionsPath(appRoot))).resolves.not.toContain('hunter2xyz')
      })
    })

    test('saves each suppression to shopify.app-security.json with its kind, and saves it once', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createAppWithRoute(directory)
        const document = documentWith([finding({line: 3, suppression}), finding({line: 8})])

        const first = await record(appRoot, testDependencies(document))
        const fileAfterFirst = await readFile(appSecuritySuppressionsPath(appRoot))
        const second = await record(appRoot, testDependencies(document))

        expect(first.suppressions).toStrictEqual({
          path: appSecuritySuppressionsPath(appRoot),
          saved: [{index: 0, change: 'added', entry: savedEntry}],
          alreadySaved: 0,
          notSaved: [],
        })
        expect(JSON.parse(fileAfterFirst)).toStrictEqual({schema_version: 1, suppressions: [savedEntry]})
        expect(second.suppressions).toStrictEqual({
          path: appSecuritySuppressionsPath(appRoot),
          saved: [],
          alreadySaved: 1,
          notSaved: [],
        })
        await expect(readFile(appSecuritySuppressionsPath(appRoot))).resolves.toBe(fileAfterFirst)
        // agent-findings.json keeps the kind with the agent's own suppression.
        const [stored] = (await readRecorded(appRoot)).checks[0]!.findings
        expect(stored!.suppression).toStrictEqual(suppression)
      })
    })

    test('rejects oversized suppression output before replacing the recorded findings', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createAppWithRoute(directory)
        await record(appRoot, testDependencies(documentWith([])))
        const previousFindings = await readFile(artifactPaths(appRoot).agentFindingsPath)
        // Unknown keys are invalid, so `$schema` pads the file.
        const file = {$schema: '', schema_version: 1, suppressions: []}
        const emptySize = Buffer.byteLength(`${JSON.stringify(file, null, 2)}\n`)
        file.$schema = 'x'.repeat(5_000_000 - emptySize - 10)
        const previousSuppressions = `${JSON.stringify(file, null, 2)}\n`
        await writeFile(appSecuritySuppressionsPath(appRoot), previousSuppressions)
        const dependencies = testDependencies(documentWith([finding({line: 3, suppression})]))

        await expect(record(appRoot, dependencies)).rejects.toThrow('would be larger than 5 MB')

        expect(dependencies.writeAgentFindings).not.toHaveBeenCalled()
        await expect(readFile(artifactPaths(appRoot).agentFindingsPath)).resolves.toBe(previousFindings)
        await expect(readFile(appSecuritySuppressionsPath(appRoot))).resolves.toBe(previousSuppressions)
        await expect(fileExists(`${appSecuritySuppressionsPath(appRoot)}.lock`)).resolves.toBe(false)
      })
    })

    test('reports a partial write if suppressions change after the findings were recorded', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createAppWithRoute(directory)
        const dependencies = testDependencies(documentWith([finding({line: 3, suppression})]))
        const edited = JSON.stringify({schema_version: 1, suppressions: [], editor: 'changed'})
        dependencies.writeAgentFindings = async (...args) => {
          const path = await writeAgentFindings(...args)
          await writeFile(appSecuritySuppressionsPath(appRoot), edited)
          return path
        }

        await expect(record(appRoot, dependencies)).rejects.toMatchObject({
          code: 'suppressions-save-failed',
          cause: {code: 'suppressions-file-changed'},
        })
        await expect(readFile(appSecuritySuppressionsPath(appRoot))).resolves.toBe(edited)
        expect((await readRecorded(appRoot)).checks[0]?.findings[0]?.suppression).toStrictEqual(suppression)
        await expect(fileExists(`${appSecuritySuppressionsPath(appRoot)}.lock`)).resolves.toBe(false)
      })
    })

    test('saves a configuration-independent entry when recording by client ID', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createAppWithRoute(directory)
        const selection = {...selectionFor(appRoot), clientIdOverride: 'other-client-id'}

        const result = await securityRecord(
          {selection, path: appRoot},
          testDependencies(documentWith([finding({line: 3, suppression})])),
        )

        expect(result.suppressions?.saved).toStrictEqual([{index: 0, change: 'added', entry: {...savedEntry}}])
      })
    })

    test('records a suppression that no entry can name alone, and reports it as not saved', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createAppWithRoute(directory)
        // Both findings cite line 3 with the same message, so no code can tell them apart.
        const document = documentWith([finding({line: 3, suppression}), finding({line: 3})])

        const result = await record(appRoot, testDependencies(document))

        expect(result.suppressions).toStrictEqual({
          path: appSecuritySuppressionsPath(appRoot),
          saved: [],
          alreadySaved: 0,
          notSaved: [
            {
              checkId: 'MISSING_TENANT_ISOLATION',
              location: {file: 'app/routes/orders.tsx', line: 3},
              problem:
                'every automatic code candidate also names another finding of MISSING_TENANT_ISOLATION in app/routes/orders.tsx',
              // Only an entry without code can suppress it, and that entry also suppresses the other finding.
              withoutCode: {findingCount: 2},
            },
          ],
        })
        await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
        await expect(fileExists(artifactPaths(appRoot).agentFindingsPath)).resolves.toBe(true)
      })
    })

    test('reports the broader option even when a manual message selector can select the finding', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createAppWithRoute(directory)
        // The same line, and no word of it in either message, so the plan finds no code. Each message names its finding.
        const document = documentWith([
          finding({line: 3, message: "The loader reads every shop's data.", suppression}),
          finding({line: 3, message: "Every shop's data is loaded."}),
        ])

        const result = await record(appRoot, testDependencies(document))

        expect(result.suppressions?.notSaved).toStrictEqual([
          {
            checkId: 'MISSING_TENANT_ISOLATION',
            location: {file: 'app/routes/orders.tsx', line: 3},
            problem:
              'every automatic code candidate also names another finding of MISSING_TENANT_ISOLATION in app/routes/orders.tsx',
            withoutCode: {findingCount: 2},
          },
        ])
      })
    })

    test('rejects a suppression without a kind, naming the finding and the field, and saves nothing', async () => {
      await expectRejected(
        documentWith([finding({suppression: {justification: 'Every order table holds one shop.'}})]),
        ['findings[0] (MISSING_TENANT_ISOLATION): suppression.kind is required: false-positive or accepted-risk'],
      )
    })

    test('refuses to write into an invalid shopify.app-security.json, and records nothing', async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createAppWithRoute(directory)
        await writeFile(appSecuritySuppressionsPath(appRoot), '{"schema_version": 2, "suppressions": []}')
        const dependencies = testDependencies(documentWith([finding({line: 3, suppression})]))

        const error = await recordError(appRoot, dependencies)

        expect(error.code).toBe('suppressions-file-invalid')
        expect(dependencies.writeAgentFindings).not.toHaveBeenCalled()
        await expect(readFile(appSecuritySuppressionsPath(appRoot))).resolves.toBe(
          '{"schema_version": 2, "suppressions": []}',
        )
      })
    })

    test("doesn't read shopify.app-security.json when no finding is suppressed", async () => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createAppWithRoute(directory)
        await writeFile(appSecuritySuppressionsPath(appRoot), '{not json')

        const result = await record(appRoot, testDependencies(documentWith([finding({line: 3})])))

        expect(result.suppressions).toBeNull()
        await expect(readFile(appSecuritySuppressionsPath(appRoot))).resolves.toBe('{not json')
      })
    })
  })

  test('rejects invalid JSON', async () => {
    await expectRejected('{"schema_version": 2,', [expect.stringContaining('The findings document is not valid JSON')])
  })
})
