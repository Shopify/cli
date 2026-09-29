/* eslint-disable no-restricted-imports -- integration coverage uses real temporary repositories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {securityExitCode} from '../../app-security-api.js'
import {formatJson} from '../output/format.js'
import {getRegistry} from '../registry/index.js'
import {DETERMINISTIC_CHECKS, scan} from '../scanners/index.js'
import {buildSubmission} from '../submission/index.js'
import {sha256, validateTrace} from '../trace/index.js'
import {scanApp} from '../run.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mkdir, unlink, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'

vi.mock('@shopify/cli-kit/node/http', async (importActual) => {
  const actual: any = await importActual()
  return {...actual, fetch: vi.fn(actual.fetch)}
})
vi.mock('@shopify/cli-kit/node/system', async (importActual) => {
  const actual: any = await importActual()
  return {...actual, captureOutputWithExitCode: vi.fn(actual.captureOutputWithExitCode)}
})

const checkId = 'MISSING_DEPENDENCY_SECURITY_AUTOMATION'
const dependabot = '# Configuration contents are not validated.\n'

// Keep the scan's git calls independent of the developer's global excludes and any enclosing repository.
let restoreGitConfig: (() => void) | undefined
beforeEach(() => {
  restoreGitConfig = isolateGitConfig()
})
afterEach(() => {
  restoreGitConfig?.()
})

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      await mkdir(dirname(join(root, path)), {recursive: true})
      await writeFile(join(root, path), content)
    }),
  )
}

async function makeApp(root: string, files: Record<string, string> = {}): Promise<void> {
  await writeFiles(root, {
    'shopify.app.toml': `name = "Dependency automation integration"
[webhooks]
api_version = "unstable"
[[webhooks.subscriptions]]
compliance_topics = ["shop/redact", "customers/data_request", "customers/redact"]
uri = "https://example.test/webhooks"
`,
    'package.json': JSON.stringify({dependencies: {react: '^19.0.0'}}),
    ...files,
  })
}

function dependencyExecution(result: Awaited<ReturnType<typeof scan>>) {
  return result.scan.checks_executed.find((execution) => execution.id === checkId)!
}

function dependencyFindings(result: Awaited<ReturnType<typeof scan>>) {
  return result.issues.filter((issue) => issue.id === checkId)
}

describe('dependency automation scanner integration', () => {
  test('registers one framework-independent low-severity structured-config check', () => {
    expect(DETERMINISTIC_CHECKS.get(checkId)).toMatchObject({
      version: 1,
      lifecycle: 'active',
      analysisMode: 'structured_config',
      target: 'dependency_automation',
    })
    expect(DETERMINISTIC_CHECKS.get(checkId)).not.toHaveProperty('requires')
    expect(getRegistry().filter((entry) => entry.id === checkId)).toEqual([
      expect.objectContaining({kind: 'deterministic', status: 'active', severity: 'low', points: -5}),
    ])
  })

  test('does not inspect bot configuration when no supported dependencies apply', async () => {
    await inTemporaryDirectory(async (root) => {
      await makeApp(root, {'package.json': '{}', '.github/dependabot.yml': 'x'.repeat(500_001)})
      const result = await scan(root)
      expect(dependencyFindings(result)).toEqual([])
      expect(dependencyExecution(result)).toMatchObject({status: 'not_applicable', findings: 0, applicable: false})
    })
  })

  test('reports one ordinary finding through scoring, blocking, trace, and submission', async () => {
    await inTemporaryDirectory(async (root) => {
      await makeApp(root, {
        'extensions/app-home/package.json': JSON.stringify({dependencies: {react: '^19.0.0'}}),
      })
      const execution = await scanApp(root)
      expect(dependencyFindings(execution.scan)).toEqual([
        expect.objectContaining({id: checkId, severity: 'low', points: -5, location: {file: 'package.json'}}),
      ])
      expect(dependencyExecution(execution.scan)).toMatchObject({
        status: 'executed',
        required: true,
        findings: 1,
        inspected_files: ['extensions/app-home/package.json', 'package.json'],
      })
      expect(formatJson(execution.scan)).toContain(checkId)
      expect(validateTrace(execution.trace)).toEqual({valid: true, errors: []})
      const submission = buildSubmission(execution.trace, {cliVersion: '3.99.0', submittedAt: '2026-09-15T00:00:00Z'})
      for (const findings of [execution.trace.findings, submission.report.findings]) {
        expect(findings).toContainEqual(expect.objectContaining({rule_id: checkId, severity: 'low'}))
      }
      expect(securityExitCode({...execution, elapsedMilliseconds: 0}, 'low')).toBe(1)
      expect(securityExitCode({...execution, elapsedMilliseconds: 0}, 'medium')).toBe(0)
      expect(securityExitCode({...execution, elapsedMilliseconds: 0}, 'none')).toBe(0)
    })
  })

  test.each([
    ['.github/dependabot.yml', dependabot],
    ['.gitlab/renovate.json', '{"extends":["local>org/renovate-config"]}'],
    ['renovate.json', '{"enabled":false}'],
    ['.github/dependabot.yaml', 'not valid YAML: ['],
    ['.renovaterc', ''],
  ])(
    'recognizes %s without network requests, repository commands, or configuration disclosure',
    async (path, content) => {
      await inTemporaryDirectory(async (root) => {
        await makeApp(root, {[path]: content})
        const execution = await scanApp(root)
        const expectedFiles = ['package.json', path]
        expect(dependencyFindings(execution.scan)).toEqual([])
        expect(dependencyExecution(execution.scan)).toMatchObject({
          status: 'executed',
          findings: 0,
          inspected_files: expectedFiles,
        })
        expect(execution.trace.project.input_hashes[path]).toBe(sha256(content))
        expect(securityExitCode({...execution, elapsedMilliseconds: 0}, 'low')).toBe(0)
        const submission = buildSubmission(execution.trace, {cliVersion: '3.99.0', submittedAt: '2026-09-15T00:00:00Z'})
        expect(JSON.stringify(submission)).not.toContain('local>org/renovate-config')
        expect(JSON.stringify(execution.trace)).not.toContain('local>org/renovate-config')
        // The scan's own git calls (ignored-path discovery and project metadata) are the only ones allowed.
        // The temporary directory is outside any repository, so ignored-path discovery stops at its first probe.
        expect(vi.mocked(captureOutputWithExitCode).mock.calls.map(([command, args]) => [command, args])).toEqual([
          ['git', ['rev-parse', '--is-inside-work-tree', '--show-prefix']],
          ['git', ['rev-parse', 'HEAD']],
          ['git', ['status', '--porcelain']],
        ])
        expect(fetch).not.toHaveBeenCalled()
      })
    },
  )

  test('ignores workflow contents entirely, including malformed CI configuration', async () => {
    await inTemporaryDirectory(async (root) => {
      await makeApp(root)
      const initial = await scan(root)
      await writeFiles(root, {
        '.github/workflows/audit.yml': 'jobs: [',
        '.gitlab-ci.yml': 'include: [',
        '.circleci/config.yml': 'jobs: [',
        '.snyk': 'version: v1.25.0',
      })
      const result = await scan(root)
      expect(dependencyFindings(result)).toHaveLength(1)
      expect(dependencyExecution(result)).toMatchObject({status: 'executed', inspected_files: ['package.json']})
      // Workflow files are scanned for secrets (so the scan inputs change) but never feed this check.
      expect(dependencyExecution(result)).toEqual(dependencyExecution(initial))
    })
  })

  async function makeRepository(root: string, files: Record<string, string>, tracked: string[]): Promise<void> {
    await makeApp(root, files)
    git(root, ['init', '-q', '.'])
    git(root, ['add', '-f', '--', 'shopify.app.toml', 'package.json', ...tracked])
    git(root, ['commit', '-qm', 'init'])
  }

  describe('gitignored configuration', () => {
    // Hosted bots read the repository, so a configuration file that never reaches it configures nothing.
    test('does not read an untracked configuration file that git ignores', async () => {
      await inTemporaryDirectory(async (root) => {
        await makeRepository(root, {'.gitignore': '.github/\n', '.github/dependabot.yml': dependabot}, ['.gitignore'])
        const result = await scan(root)
        expect(dependencyFindings(result)).toHaveLength(1)
        expect(dependencyExecution(result)).toMatchObject({status: 'executed', inspected_files: ['package.json']})
        expect(result.scan.file_hashes).not.toHaveProperty('.github/dependabot.yml')
        expect(result.scan.coverage_complete).toBe(true)
      })
    })

    test('reads a force-tracked configuration file that matches .gitignore', async () => {
      await inTemporaryDirectory(async (root) => {
        await makeRepository(root, {'.gitignore': '.github/\n', '.github/dependabot.yml': dependabot}, [
          '.gitignore',
          '.github/dependabot.yml',
        ])
        const result = await scan(root)
        expect(dependencyFindings(result)).toEqual([])
        expect(dependencyExecution(result)).toMatchObject({
          status: 'executed',
          inspected_files: ['package.json', '.github/dependabot.yml'],
        })
        expect(result.scan.file_hashes?.['.github/dependabot.yml']).toBe(sha256(dependabot))
      })
    })

    test('skips an ignored configuration file and still counts a committed one later in the allowlist', async () => {
      await inTemporaryDirectory(async (root) => {
        await makeRepository(
          root,
          {'.gitignore': '.github/dependabot.yml\n', '.github/dependabot.yml': dependabot, 'renovate.json': '{}'},
          ['.gitignore', 'renovate.json'],
        )
        const result = await scan(root)
        expect(dependencyFindings(result)).toEqual([])
        expect(dependencyExecution(result)).toMatchObject({
          status: 'executed',
          inspected_files: ['package.json', 'renovate.json'],
        })
        expect(result.scan.file_hashes).not.toHaveProperty('.github/dependabot.yml')
        expect(result.scan.file_hashes?.['renovate.json']).toBe(sha256('{}'))
      })
    })
  })

  describe('--ignore', () => {
    test('does not read a committed configuration file a pattern excludes', async () => {
      await inTemporaryDirectory(async (root) => {
        await makeRepository(root, {'.github/dependabot.yml': dependabot}, ['.github/dependabot.yml'])
        const result = await scan(root, undefined, {ignorePatterns: ['.github/']})
        expect(dependencyFindings(result)).toHaveLength(1)
        expect(dependencyExecution(result)).toMatchObject({status: 'executed', inspected_files: ['package.json']})
        expect(result.scan.file_hashes).not.toHaveProperty('.github/dependabot.yml')
      })
    })

    test('reads an untracked gitignored configuration file a pattern includes again', async () => {
      await inTemporaryDirectory(async (root) => {
        // The tracked CODEOWNERS keeps `.github/` from being collapsed into a single ignored directory
        // literal, so git reports the configuration file itself and the pattern can include it again.
        await makeRepository(
          root,
          {
            '.gitignore': '.github/dependabot.yml\n',
            '.github/CODEOWNERS': '* @owners\n',
            '.github/dependabot.yml': dependabot,
          },
          ['.gitignore', '.github/CODEOWNERS'],
        )
        const excluded = await scan(root)
        expect(dependencyFindings(excluded)).toHaveLength(1)

        const result = await scan(root, undefined, {ignorePatterns: ['!.github/dependabot.yml']})
        expect(dependencyFindings(result)).toEqual([])
        expect(dependencyExecution(result)).toMatchObject({
          status: 'executed',
          inspected_files: ['package.json', '.github/dependabot.yml'],
        })
        expect(result.scan.file_hashes?.['.github/dependabot.yml']).toBe(sha256(dependabot))
      })
    })
  })

  test('does not treat package.json as a Renovate configuration filename', async () => {
    await inTemporaryDirectory(async (root) => {
      await makeApp(root, {'package.json': '{"dependencies":{"react":"19.0.0"},"renovate":{}}'})
      expect(dependencyFindings(await scan(root))).toHaveLength(1)
    })
  })

  test.each([
    ['.github/dependabot.yml', 'x'.repeat(500_001)],
    ['packages/web/package.json', '{invalid'],
  ])('leaves malformed or rejected input unresolved: %s', async (path, content) => {
    await inTemporaryDirectory(async (root) => {
      await makeApp(root, {[path]: content})
      const result = await scan(root)
      expect(dependencyFindings(result)).toEqual([])
      expect(dependencyExecution(result)).toMatchObject({status: 'unresolved', findings: 0})
      expect(result.scan.coverage_complete).toBe(false)
    })
  })

  test('does not inspect repository-level configuration outside a nested app root', async () => {
    await inTemporaryDirectory(async (repository) => {
      const app = join(repository, 'apps/example')
      await mkdir(join(repository, '.git'))
      await makeApp(app, {'.github/dependabot.yml': dependabot})
      const result = await scan(app)
      expect(dependencyFindings(result)).toEqual([])
      expect(dependencyExecution(result)).toMatchObject({
        status: 'unresolved',
        reason: {message: 'App root is nested below a parent Git repository'},
      })
    })
  })

  test.each(['.github/dependabot.yml', 'renovate.json'])(
    'hashes config changes, additions, and deletions: %s',
    async (path) => {
      await inTemporaryDirectory(async (root) => {
        await makeApp(root)
        const initial = await scan(root)
        const content = path.endsWith('.yml') ? dependabot : '{}'
        await writeFiles(root, {[path]: content})
        const added = await scan(root)
        await writeFile(join(root, path), `${content}\r\n`)
        const changed = await scan(root)
        await unlink(join(root, path))
        const deleted = await scan(root)
        expect(added.scan.file_hashes?.[path]).toBe(sha256(content))
        expect(changed.scan.file_hashes?.[path]).toBe(sha256(`${content}\r\n`))
        expect(new Set([initial.scan.input_hash, added.scan.input_hash, changed.scan.input_hash]).size).toBe(3)
        expect(deleted.scan.input_hash).toBe(initial.scan.input_hash)
      })
    },
  )
})
