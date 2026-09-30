import securityRecord, {renderSecurityRecordResult} from './security-record.js'
import {securityRecordJsonOutputSchema} from './security-record-json.js'
import {resolveAppSecurityRoot} from './app-security-api.js'
import {appSecurityArtifactPaths, writeAgentFindings} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import type {SecurityRecordDependencies} from './security-record.js'
import type {AgentFindingsArtifact} from './app-security-engine/index.js'

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

function validDocument(): Record<string, unknown> {
  return {
    schema_version: 1,
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
  return resolveAppSecurityRoot(directory)
}

function testDependencies(stdin: string | undefined): SecurityRecordDependencies {
  return {
    readStdin: vi.fn(async () => stdin),
    readProjectState: vi.fn(async () => ({commit: 'abc123', dirty: true})),
    engineVersion: () => '3.99.0',
    writeAgentFindings: vi.fn(writeAgentFindings),
  }
}

function recordCommand(appRoot: string): string {
  return formatAppSecurityCommand(resolveAppSecurityCommands(appRoot).record)
}

async function readRecorded(appRoot: string): Promise<AgentFindingsArtifact> {
  return JSON.parse(await readFile(appSecurityArtifactPaths(appRoot).agentFindingsPath)) as AgentFindingsArtifact
}

async function recordError(appRoot: string, dependencies: SecurityRecordDependencies): Promise<AbortError> {
  const error: unknown = await securityRecord({appRoot}, dependencies).catch((error: unknown) => error)
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
    expect(error.details).toEqual({errors: expectedErrors})
    expect(dependencies.writeAgentFindings).not.toHaveBeenCalled()
    await expect(fileExists(appSecurityArtifactPaths(appRoot).agentFindingsPath)).resolves.toBe(false)
  })
}

describe('securityRecord', () => {
  test('writes agent-findings.json, returns the counts, and prints nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const output = mockAndCaptureOutput()
      output.clear()

      const result = await securityRecord({appRoot}, testDependencies(JSON.stringify(validDocument())))

      expect(result).toStrictEqual({path: appSecurityArtifactPaths(appRoot).agentFindingsPath, checks: 2, findings: 2})
      const recorded = await readRecorded(appRoot)
      expect(recorded.engine.version).toBe('3.99.0')
      expect(recorded.project).toEqual({commit: 'abc123', dirty: true})
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

  test('records findings when there is no deterministic-findings.json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const paths = appSecurityArtifactPaths(appRoot)

      await securityRecord({appRoot}, testDependencies(JSON.stringify(validDocument())))

      await expect(fileExists(paths.deterministicFindingsPath)).resolves.toBe(false)
      await expect(fileExists(paths.agentFindingsPath)).resolves.toBe(true)
    })
  })

  test('ignores an existing deterministic-findings.json, even one that disagrees with the recorded findings', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const paths = appSecurityArtifactPaths(appRoot)
      await mkdir(paths.artifactDirectory)
      const staleScan = JSON.stringify({
        schema_version: 1,
        commit: 'zzz999-does-not-match',
        generated_at: '2000-01-01T00:00:00.000Z',
        findings: [],
      })
      await writeFile(paths.deterministicFindingsPath, staleScan)

      await securityRecord({appRoot}, testDependencies(JSON.stringify(validDocument())))

      await expect(fileExists(paths.agentFindingsPath)).resolves.toBe(true)
      await expect(readFile(paths.deterministicFindingsPath)).resolves.toBe(staleScan)
    })
  })

  test('rejects the whole document with every error and leaves the existing file untouched', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const paths = appSecurityArtifactPaths(appRoot)
      await mkdir(paths.artifactDirectory)
      const previousFindings = '{"previous": "findings — ünchanged"}\n'
      await writeFile(paths.agentFindingsPath, previousFindings)
      const dependencies = testDependencies(
        JSON.stringify({
          schema_version: 1,
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
      expect(error.details).toStrictEqual({errors})
      expect(error.customSections).toStrictEqual([{title: 'Errors', body: {list: {items: errors}}}])
      expect(error.nextSteps).toStrictEqual([
        ['Fix every error, then run', {command: recordCommand(appRoot)}, 'again.'],
      ])
      expect(dependencies.writeAgentFindings).not.toHaveBeenCalled()
      await expect(readFile(paths.agentFindingsPath)).resolves.toBe(previousFindings)
    })
  })

  test('writes the rejection as a JSON fatal error document in JSON mode', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const error = await recordError(
        appRoot,
        testDependencies(JSON.stringify({schema_version: 1, findings: [finding({line: 0}), finding({evidence: []})]})),
      )
      const errors = [
        'findings[0] (MISSING_TENANT_ISOLATION): invalid line number: 0',
        'findings[1] (MISSING_TENANT_ISOLATION): finding requires at least one evidence citation',
      ]

      const output = mockAndCaptureOutput()
      output.clear()
      vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      try {
        await handler(error)

        expect(JSON.parse(output.info())).toStrictEqual({
          error: {
            type: 'abort',
            message: REJECTED_MESSAGE,
            nextSteps: [`Fix every error, then run ${recordCommand(appRoot)} again.`],
            customSections: [{title: 'Errors', body: errors.join('; ')}],
            details: {errors},
          },
        })
      } finally {
        vi.unstubAllEnvs()
        output.clear()
      }
    })
  })

  test('rejects an unknown check', async () => {
    await expectRejected(
      JSON.stringify({
        schema_version: 1,
        checks_executed: [{check_id: 'NOT_A_CHECK', check_version: 1, status: 'executed'}],
      }),
      ['checks_executed[0] (NOT_A_CHECK): unknown check_id'],
    )
  })

  test('rejects an unsupported schema version', async () => {
    await expectRejected(JSON.stringify({schema_version: 2}), ['schema_version must be 1'])
  })

  test('keeps the claimed check version and populates the check snapshot', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const document = {
        schema_version: 1,
        checks_executed: [{check_id: 'MISSING_TENANT_ISOLATION', check_version: 99, status: 'executed'}],
        findings: [finding({check_version: 99})],
      }

      await securityRecord({appRoot}, testDependencies(JSON.stringify(document)))

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
        schema_version: 1,
        findings: [
          finding({
            message: `Leaks ${FAKE_SHOPIFY_TOKEN}`,
            reasoning: `Found ${FAKE_SHOPIFY_TOKEN}`,
            evidence: [{file: 'app/routes/orders.tsx', line: 1, quote: FAKE_SHOPIFY_TOKEN}],
          }),
        ],
      }

      await securityRecord({appRoot}, testDependencies(JSON.stringify(document)))

      const written = await readFile(appSecurityArtifactPaths(appRoot).agentFindingsPath)
      expect(written).toContain('Leaks')
      expect(written).not.toContain(FAKE_SHOPIFY_TOKEN)
    })
  })

  test('fails when nothing is piped on stdin', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const dependencies = testDependencies(undefined)

      const error = await recordError(appRoot, dependencies)

      expect(error.message).toBe('No findings document was piped on stdin.')
      expect(error.nextSteps).toStrictEqual([
        ['Pipe the findings document on stdin:', {command: recordCommand(appRoot)}],
      ])
      expect(recordCommand(appRoot)).toContain('shopify app security record --path')
      expect(error.details).toBeUndefined()
      expect(dependencies.readProjectState).not.toHaveBeenCalled()
      await expect(fileExists(appSecurityArtifactPaths(appRoot).agentFindingsPath)).resolves.toBe(false)
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
      expect(error.details).toStrictEqual({errors: ['Stdin input exceeded the maximum allowed size.']})
      await expect(fileExists(appSecurityArtifactPaths(appRoot).agentFindingsPath)).resolves.toBe(false)
    })
  })

  test('rejects a document over 5 MB, measured in bytes', async () => {
    // 2.6 million two-byte characters: under 5 million characters but over 5 MB.
    const document = JSON.stringify({...validDocument(), padding: 'é'.repeat(2_600_000)})

    await expectRejected(document, [expect.stringContaining('the limit is 5 MB')])
  })

  test('rejects invalid JSON', async () => {
    await expectRejected('{"schema_version": 1,', [expect.stringContaining('The findings document is not valid JSON')])
  })
})

describe('securityRecordJsonOutputSchema', () => {
  test('encodes exactly the recorded path and counts', () => {
    const encoded = securityRecordJsonOutputSchema.encode({
      path: '/app/.shopify/app-security/agent-findings.json',
      checks: 2,
      findings: 0,
    })

    expect(encoded).toBe(
      [
        '{',
        '  "path": "/app/.shopify/app-security/agent-findings.json",',
        '  "checks": 2,',
        '  "findings": 0',
        '}',
      ].join('\n'),
    )
  })

  test('rejects results that are not whole counts', () => {
    expect(() =>
      securityRecordJsonOutputSchema.encode({path: 'agent-findings.json', checks: 1.5, findings: 0}),
    ).toThrow()
  })

  test('describes only the success result', () => {
    const result = {path: 'agent-findings.json', checks: 1, findings: 0}
    expect(securityRecordJsonOutputSchema.validate(result)).toStrictEqual(result)
    expect(() => securityRecordJsonOutputSchema.validate({errors: ['schema_version must be 1']})).toThrow()
  })
})

describe('renderSecurityRecordResult', () => {
  test('shows the counts and the recorded path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const path = appSecurityArtifactPaths(appRoot).agentFindingsPath
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityRecordResult({path, checks: 1, findings: 2})

      const rendered = output.info()
      expect(rendered).toContain('Agent findings recorded.')
      expect(rendered).toContain('Recorded 1 check and 2 findings in')
      expect(rendered).toContain('agent-findings.json')
      output.clear()
    })
  })
})
