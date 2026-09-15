/* eslint-disable no-restricted-imports -- integration coverage uses real temporary repositories */
import {doctorExitCode} from '../../app-doctor-api.js'
import {formatJson} from '../output/format.js'
import {getRegistry} from '../registry/index.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {DETERMINISTIC_CHECKS, scan} from '../scanners/index.js'
import {buildSubmission} from '../submission/index.js'
import {compileTrace, sha256, validateTrace} from '../trace/index.js'
import {scanApp} from '../run.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mkdir, mkdtemp, rm, unlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'

vi.mock('@shopify/cli-kit/node/http', async (importActual) => {
  const actual: any = await importActual()
  return {...actual, fetch: vi.fn(actual.fetch)}
})

vi.mock('@shopify/cli-kit/node/system', async (importActual) => {
  const actual: any = await importActual()
  return {...actual, captureOutputWithExitCode: vi.fn(actual.captureOutputWithExitCode)}
})

const temporaryDirectories: string[] = []
const appConfiguration = `name = "Dependency auditing integration"
[webhooks]
api_version = "unstable"
[[webhooks.subscriptions]]
compliance_topics = ["shop/redact", "customers/data_request", "customers/redact"]
uri = "https://example.test/webhooks"
`

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

async function makeDirectory(prefix = 'app-doctor-dependency-auditing-'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const absolutePath = join(root, path)
      await mkdir(dirname(absolutePath), {recursive: true})
      await writeFile(absolutePath, content)
    }),
  )
}

async function makeApp(files: Record<string, string>): Promise<string> {
  const directory = await makeDirectory()
  await writeFiles(directory, {'shopify.app.toml': appConfiguration, ...files})
  return directory
}

function dependencyExecution(result: Awaited<ReturnType<typeof scan>>) {
  return result.scan.checks_executed.find((execution) => execution.id === 'MISSING_DEPENDENCY_AUDITING')!
}

function dependencyFindings(result: Awaited<ReturnType<typeof scan>>) {
  return result.issues.filter((issue) => issue.id === 'MISSING_DEPENDENCY_AUDITING')
}

describe('dependency-auditing scanner integration', () => {
  test('registers one active, framework-independent structured-config implementation', () => {
    const definition = DETERMINISTIC_CHECKS.get('MISSING_DEPENDENCY_AUDITING')
    expect(definition).toMatchObject({
      version: 1,
      lifecycle: 'active',
      analysisMode: 'structured_config',
      target: 'dependency_auditing',
    })
    expect(definition).not.toHaveProperty('requires')
    const catalogEntry = RULE_CATALOG.find((entry) => entry.id === 'MISSING_DEPENDENCY_AUDITING')
    expect(catalogEntry).toMatchObject({
      title: 'Dependency auditing configuration not detected',
      severity: 'low',
      points: -5,
    })
    expect(catalogEntry).not.toHaveProperty('status')
    expect(catalogEntry).not.toHaveProperty('requires')
    const registryEntries = getRegistry().filter((entry) => entry.id === 'MISSING_DEPENDENCY_AUDITING')
    expect(registryEntries).toEqual([
      expect.objectContaining({
        kind: 'deterministic',
        version: 1,
        status: 'active',
        severity: 'low',
        points: -5,
        title: 'Dependency auditing configuration not detected',
      }),
    ])
  })

  test('is not applicable when no supported manifest declares dependencies', async () => {
    const directory = await makeApp({
      'package.json': JSON.stringify({name: 'empty'}),
      '.github/workflows/irrelevant.yml': 'x'.repeat(500_001),
    })

    const result = await scan(directory)

    expect(dependencyFindings(result)).toEqual([])
    expect(dependencyExecution(result)).toMatchObject({
      status: 'not_applicable',
      required: false,
      applicable: false,
      inspected_files: ['package.json'],
      findings: 0,
      analysis_mode: 'structured_config',
      reason: {code: 'no_relevant_files'},
    })
  })

  test('emits exactly one ordinary low finding and honors low blocking', async () => {
    const directory = await makeApp({'package.json': JSON.stringify({dependencies: {react: '^19.0.0'}})})

    const execution = await scanApp(directory)
    const result = execution.scan

    expect(dependencyFindings(result)).toEqual([
      expect.objectContaining({
        id: 'MISSING_DEPENDENCY_AUDITING',
        severity: 'low',
        points: -5,
        title: 'Dependency auditing configuration not detected',
        location: {file: 'package.json'},
        found_by: 'static',
        rule_version: 1,
      }),
    ])
    expect(dependencyExecution(result)).toMatchObject({
      status: 'executed',
      required: true,
      applicable: true,
      inspected_files: ['package.json'],
      findings: 1,
      analysis_mode: 'structured_config',
    })
    expect(result.score).toEqual({total: 95, baseline: 100, grade: 'EXCELLENT'})
    expect(formatJson(result)).toContain('MISSING_DEPENDENCY_AUDITING')
    expect(execution.trace.findings).toContainEqual(
      expect.objectContaining({
        source: 'deterministic',
        rule_id: 'MISSING_DEPENDENCY_AUDITING',
        rule_version: 1,
        severity: 'low',
      }),
    )
    const submission = buildSubmission(execution.trace, {
      cliVersion: '3.99.0',
      submittedAt: '2026-09-15T00:01:00.000Z',
    })
    expect(submission.report.findings).toContainEqual(
      expect.objectContaining({
        source: 'deterministic',
        rule_id: 'MISSING_DEPENDENCY_AUDITING',
        rule_version: 1,
        severity: 'low',
      }),
    )
    expect(doctorExitCode({...execution, elapsedMilliseconds: 0}, 'low')).toBe(1)
    expect(doctorExitCode({...execution, elapsedMilliseconds: 0}, 'medium')).toBe(0)
    expect(doctorExitCode({...execution, elapsedMilliseconds: 0}, 'none')).toBe(0)
  })

  test('treats an empty allowlisted CI file as negative evidence, not an unresolved parse', async () => {
    const directory = await makeApp({
      'package.json': JSON.stringify({dependencies: {react: '^19.0.0'}}),
      '.github/workflows/dependencies.yml': '',
    })

    const result = await scan(directory)

    expect(dependencyFindings(result)).toHaveLength(1)
    expect(dependencyExecution(result)).toMatchObject({
      status: 'executed',
      inspected_files: ['package.json', '.github/workflows/dependencies.yml'],
      findings: 1,
    })
  })

  test('passes when allowlisted CI runs auditing without executing it or making network requests', async () => {
    const directory = await makeApp({
      'package.json': JSON.stringify({dependencies: {react: '^19.0.0'}}),
      '.github/workflows/dependencies.yml': `on: pull_request
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - run: npm audit
`,
    })

    const result = await scan(directory)

    expect(dependencyFindings(result)).toEqual([])
    expect(dependencyExecution(result)).toMatchObject({
      status: 'executed',
      inspected_files: ['package.json', '.github/workflows/dependencies.yml'],
      findings: 0,
    })
    expect(
      vi.mocked(captureOutputWithExitCode).mock.calls.map(([command, arguments_]) => [command, arguments_]),
    ).toEqual([
      ['git', ['rev-parse', 'HEAD']],
      ['git', ['status', '--porcelain']],
    ])
    expect(fetch).not.toHaveBeenCalled()
  })

  test.each([
    ['malformed', '.github/workflows/dependencies.yml', 'jobs: ['],
    ['unreadable', '.github/workflows/oversized.yml', 'x'.repeat(500_001)],
  ])('leaves %s configuration unresolved without a missing finding', async (_kind, path, content) => {
    const directory = await makeApp({
      'package.json': JSON.stringify({dependencies: {react: '^19.0.0'}}),
      [path]: content,
    })

    const result = await scan(directory)

    expect(dependencyFindings(result)).toEqual([])
    expect(dependencyExecution(result)).toMatchObject({
      status: 'unresolved',
      required: true,
      applicable: true,
      inspected_files: _kind === 'unreadable' ? ['package.json'] : ['package.json', path],
      findings: 0,
      reason: {code: expect.stringMatching(/^(parser_unavailable|input_rejected)$/)},
    })
    expect(result.score).toBeNull()
    expect(result.scan.coverage_gaps).toContainEqual(
      expect.objectContaining({code: 'unresolved_check', check_id: 'MISSING_DEPENDENCY_AUDITING'}),
    )
  })

  test('suppresses the missing finding when any relevant manifest cannot be parsed', async () => {
    const directory = await makeApp({
      'package.json': '{invalid',
      'packages/web/package.json': JSON.stringify({dependencies: {react: '^19.0.0'}}),
    })

    const result = await scan(directory)

    expect(dependencyFindings(result)).toEqual([])
    expect(dependencyExecution(result)).toMatchObject({
      status: 'unresolved',
      findings: 0,
      inspected_files: ['package.json', 'packages/web/package.json'],
      reason: {code: 'parser_unavailable'},
    })
  })

  test('leaves an app below its repository root unresolved without a missing finding', async () => {
    const repository = await makeDirectory('app-doctor-dependency-repository-')
    const directory = join(repository, 'apps', 'example')
    await mkdir(join(repository, '.git'))
    await writeFiles(directory, {
      'shopify.app.toml': appConfiguration,
      'package.json': JSON.stringify({dependencies: {react: '^19.0.0'}}),
    })

    const result = await scan(directory)

    expect(dependencyFindings(result)).toEqual([])
    expect(dependencyExecution(result)).toMatchObject({
      status: 'unresolved',
      inspected_files: ['package.json'],
      findings: 0,
      reason: {code: 'parser_unavailable', message: expect.stringContaining('nested below repository root')},
    })
  })

  test('hashes exact configuration bytes and tracks configuration changes, additions, and deletion', async () => {
    const directory = await makeApp({'package.json': JSON.stringify({dependencies: {react: '^19.0.0'}})})
    const configurationPath = join(directory, '.github', 'workflows', 'dependencies.yml')
    const initial = await scan(directory)
    const firstContent = 'jobs:\n  audit:\n    steps:\n      - run: npm audit\n'
    await writeFiles(directory, {'.github/workflows/dependencies.yml': firstContent})
    const added = await scan(directory)
    const secondContent = `${firstContent}# changed without normalization\r\n`
    await writeFile(configurationPath, secondContent)
    const changed = await scan(directory)
    await unlink(configurationPath)
    const deleted = await scan(directory)

    expect(initial.scan.file_hashes).not.toHaveProperty('.github/workflows/dependencies.yml')
    expect(added.scan.file_hashes?.['.github/workflows/dependencies.yml']).toBe(sha256(firstContent))
    expect(changed.scan.file_hashes?.['.github/workflows/dependencies.yml']).toBe(sha256(secondContent))
    expect(deleted.scan.file_hashes).not.toHaveProperty('.github/workflows/dependencies.yml')
    expect(new Set([initial.scan.input_hash, added.scan.input_hash, changed.scan.input_hash])).toHaveProperty('size', 3)
    expect(deleted.scan.input_hash).toBe(initial.scan.input_hash)
    expect(dependencyExecution(changed).inspected_files).toEqual(['package.json', '.github/workflows/dependencies.yml'])
  })

  test('routes only paths, hashes, and static metadata through output, trace, and submission', async () => {
    const privateConfigurationMarker = 'DO_NOT_SUBMIT_DEPENDENCY_AUDIT_CONFIGURATION_CONTENT'
    const privateConfigurationContent = `# ${privateConfigurationMarker}
jobs:
  audit:
    steps:
      - run: npm audit
`
    const directory = await makeApp({
      'package.json': JSON.stringify({dependencies: {react: '^19.0.0'}}),
      '.github/workflows/dependencies.yml': privateConfigurationContent,
    })
    const result = await scan(directory)
    const trace = compileTrace(result, {generatedAt: '2026-09-15T00:00:00.000Z'})
    const submission = buildSubmission(trace, {
      cliVersion: '3.99.0',
      submittedAt: '2026-09-15T00:01:00.000Z',
    })
    const serializedOutputs = [formatJson(result), JSON.stringify(trace), JSON.stringify(submission)]

    expect(validateTrace(trace)).toEqual({valid: true, errors: []})
    expect(trace.project.input_hashes['.github/workflows/dependencies.yml']).toBe(sha256(privateConfigurationContent))
    expect(trace.checks_executed).toContainEqual(
      expect.objectContaining({
        id: 'MISSING_DEPENDENCY_AUDITING',
        analysis_mode: 'structured_config',
        status: 'executed',
        inspected_files: ['package.json', '.github/workflows/dependencies.yml'],
      }),
    )
    expect(submission.report.checks_executed).toContainEqual(
      expect.objectContaining({
        id: 'MISSING_DEPENDENCY_AUDITING',
        analysis_mode: 'structured_config',
        status: 'executed',
        inspected_file_count: 2,
        finding_count: 0,
      }),
    )
    for (const output of serializedOutputs) expect(output).not.toContain(privateConfigurationMarker)
  })
})
