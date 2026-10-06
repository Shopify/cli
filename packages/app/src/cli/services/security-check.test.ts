import securityCheck, {resolveSecurityCheckSelection, type SecurityCheckResolution} from './security-check.js'
import {resolveAppSecurityCommands} from './app-security-commands.js'
import {appSecurityArtifactPaths, writeCheckArtifacts} from './app-security-artifacts.js'
import {resolveAppSecuritySelection} from './app-security-selection.js'
import {validAppConfiguration} from './app-security-selection.test-data.js'
import {listAppSecurityFiles} from './app-security-api.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {afterEach, describe, expect, test, vi} from 'vitest'
import type {AppSecurityExecution} from './app-security-api.js'
import type {AppSecuritySelection, AppSecuritySelectionOptions} from './app-security-selection.js'
import type {
  AgentChecks,
  AppSecurityScope,
  DeterministicFindingsDocument,
  ScanResult,
} from './app-security-engine/index.js'

const scan: ScanResult = {
  version: '0.1.0',
  timestamp: '2026-08-24T00:00:00.000Z',
  app: {name: 'Test', type: 'public'},
  detection: {framework: 'none', surface: 'config_only', languages: []},
  capabilities: {
    theme_app_extension: false,
    app_embed: false,
    embedded_app: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: false,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  scan: {
    timestamp: '2026-08-24T00:00:00.000Z',
    security_version: '0.1.0',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_gaps: [],
    checks_executed: [],
  },
  issues: [],
}

const deterministicFindings: DeterministicFindingsDocument = {
  schema_version: 1,
  source: 'deterministic',
  engine: {name: 'shopify-app-security', version: '1.2.3', ruleset: '2026.08.28'},
  generated_at: '2026-08-24T00:00:00.000Z',
  detection: scan.detection,
  coverage: {
    files_scanned: 1,
    files_skipped: [],
    gaps: [],
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    scan_directories: [{directory: '.', origin: 'app_directory'}],
  },
  checks: [],
}

const agentChecks: AgentChecks = {
  schema_version: 1,
  engine: {name: 'shopify-app-security', version: '1.2.3'},
  generated_at: '2026-08-24T00:00:00.000Z',
  checks: [],
  instructions: 'review',
}

const scanExecution: AppSecurityExecution = {
  scan,
  ignoredScanDirectories: [],
  deterministicFindings,
  agentChecks,
  engine: {name: 'shopify-app-security', version: '1.2.3', ruleset: '2026.08.28'},
  elapsedMilliseconds: 12,
}

const artifacts = {
  deterministicFindingsPath: '/tmp/unlinked-app/.shopify/app-security/deterministic-findings.json',
  agentChecksPath: '/tmp/unlinked-app/.shopify/app-security/agent-checks.json',
}

const appDirectory = '/tmp/unlinked-app'

const configSelection: AppSecuritySelection = {
  kind: 'config',
  appDirectory,
  appConfigFilePath: `${appDirectory}/shopify.app.toml`,
  configClientId: 'toml-client-id',
}

const noScope: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

/** The commands `check` generates for `--path` `appDirectory`, run from some other directory. */
function commandsFor(selection: AppSecuritySelection = configSelection, scope: AppSecurityScope = noScope) {
  return resolveAppSecurityCommands(selection, appDirectory, scope)
}

function selectionOptions() {
  return {
    directory: appDirectory,
    withoutAppConfig: false,
    includeDirs: [],
    excludePatterns: [],
    noGitIgnore: false,
    allowPrompts: false,
  }
}

function selectionDependencies(selection: AppSecuritySelection = configSelection) {
  return {resolveSelection: vi.fn(async (_options: AppSecuritySelectionOptions) => selection)}
}

/** A resolution as `resolveSecurityCheckSelection` returns it for the configuration and scope given. */
function resolutionFor(
  selection: AppSecuritySelection = configSelection,
  overrides: Partial<SecurityCheckResolution> = {},
): SecurityCheckResolution {
  return {
    selection,
    resultsKey: 'shopify.app',
    commands: commandsFor(selection),
    scope: noScope,
    includeDirectories: [],
    prompted: false,
    ...overrides,
  }
}

function testDependencies(execution: AppSecurityExecution = scanExecution) {
  return {
    execute: vi.fn(async () => execution),
    listFiles: vi.fn(async () => ({paths: ['shopify.app.toml'], ignoredScanDirectories: [] as string[]})),
    writeArtifacts: vi.fn(async () => artifacts),
    recordMetadata: vi.fn(async () => {}),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveSecurityCheckSelection', () => {
  test('resolves the selection, validating --client-id, and returns its results key, commands and scope', async () => {
    const dependencies = selectionDependencies()

    const resolution = await resolveSecurityCheckSelection(
      {...selectionOptions(), excludePatterns: ['generated'], noGitIgnore: true},
      dependencies,
    )

    expect(dependencies.resolveSelection).toHaveBeenCalledWith({
      path: appDirectory,
      config: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      allowPrompts: false,
      validateClientIdFlag: true,
    })
    expect(resolution).toEqual({
      selection: configSelection,
      resultsKey: 'shopify.app',
      commands: commandsFor(configSelection, {include_dirs: [], excludes: ['generated'], no_git_ignore: true}),
      scope: {include_dirs: [], excludes: ['generated'], no_git_ignore: true},
      includeDirectories: [],
      prompted: false,
    })
    expect(resolution.commands.scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: relativePath(cwd(), appDirectory)},
      {flag: '--exclude', value: 'generated'},
      '--no-git-ignore',
    ])
  })

  test.each([true, false])('lets the selection prompt only when allowed (allowPrompts: %s)', async (allowPrompts) => {
    const dependencies = selectionDependencies()

    await resolveSecurityCheckSelection({...selectionOptions(), allowPrompts}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts}))
  })

  test('forwards the config name and includes --config in generated commands', async () => {
    const staging: AppSecuritySelection = {
      ...configSelection,
      appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`,
    }
    const dependencies = selectionDependencies(staging)

    const resolution = await resolveSecurityCheckSelection({...selectionOptions(), configName: 'staging'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({config: 'staging'}))
    expect(resolution.resultsKey).toBe('shopify.app.staging')
    expect(resolution.commands.scan.args).toContainEqual({flag: '--config', value: 'staging'})
  })

  test('forwards --client-id and --without-app-config, and uses the client ID as the results key', async () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'flag-client-id',
      clientIdSource: 'flag',
    }
    const dependencies = selectionDependencies(selection)

    const resolution = await resolveSecurityCheckSelection(
      {...selectionOptions(), withoutAppConfig: true, clientId: 'flag-client-id'},
      dependencies,
    )

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(
      expect.objectContaining({withoutAppConfig: true, clientId: 'flag-client-id'}),
    )
    expect(resolution.resultsKey).toBe('flag-client-id')
    expect(resolution.prompted).toBe(false)
  })

  test('keeps the scope as typed and repeats each --include-dir before --exclude in the generated commands', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      vi.stubEnv('INIT_CWD', directory)
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const scope = {include_dirs: ['backend', './backend/'], excludes: ['**/generated', '!keep'], no_git_ignore: true}

      const resolution = await resolveSecurityCheckSelection(
        {
          ...selectionOptions(),
          includeDirs: scope.include_dirs,
          excludePatterns: scope.excludes,
          noGitIgnore: true,
        },
        selectionDependencies(),
      )

      expect(resolution.scope).toEqual(scope)
      expect(resolution.includeDirectories).toEqual([backend, backend])
      expect(resolution.commands).toEqual(commandsFor(configSelection, scope))
      expect(resolution.commands.scan.args.slice(-5)).toEqual([
        {flag: '--include-dir', value: 'backend'},
        {flag: '--include-dir', value: './backend/'},
        {flag: '--exclude', value: '**/generated'},
        {flag: '--exclude', value: '!keep'},
        '--no-git-ignore',
      ])
    })
  })

  test('aborts on a wrong --include-dir before resolving the selection', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.stubEnv('INIT_CWD', directory)
      const dependencies = selectionDependencies()

      await expect(
        resolveSecurityCheckSelection({...selectionOptions(), includeDirs: ['missing']}, dependencies),
      ).rejects.toThrow("--include-dir missing: directory doesn't exist.")

      expect(dependencies.resolveSelection).not.toHaveBeenCalled()
    })
  })

  test('reports prompts after the no-TOML prompt flow, and a command that skips them', async () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'picked-client-id',
      clientIdSource: 'picker',
    }

    const resolution = await resolveSecurityCheckSelection(
      {...selectionOptions(), allowPrompts: true},
      selectionDependencies(selection),
    )

    expect(resolution.prompted).toBe(true)
    expect(resolution.commands.scan.args.slice(-2)).toEqual([
      {flag: '--client-id', value: 'picked-client-id'},
      '--without-app-config',
    ])
  })

  test('reports prompts after asking which TOML to scan, and a command that skips them with --config', async () => {
    const selection: AppSecuritySelection = {
      kind: 'config',
      appDirectory,
      appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`,
      configClientId: 'toml-client-id',
      appConfigFilePicked: true,
    }

    const resolution = await resolveSecurityCheckSelection(
      {...selectionOptions(), allowPrompts: true},
      selectionDependencies(selection),
    )

    expect(resolution.prompted).toBe(true)
    expect(resolution.commands.scan.args).toContainEqual({flag: '--config', value: 'staging'})
  })

  test('reports no prompts when a TOML was found', async () => {
    const resolution = await resolveSecurityCheckSelection(
      {...selectionOptions(), allowPrompts: true},
      selectionDependencies(),
    )

    expect(resolution.prompted).toBe(false)
  })
})

describe('securityCheck', () => {
  test('scans the selection, records the findings count, writes the artifacts and returns them', async () => {
    const dependencies = testDependencies()
    const resolution = resolutionFor()

    const result = await securityCheck(resolution, {listFiles: false}, dependencies)

    expect(dependencies.execute).toHaveBeenCalledWith({
      appDirectory,
      scanDirectories: [appDirectory],
      requestedScanDirectories: [appDirectory],
      appConfigFilePath: `${appDirectory}/shopify.app.toml`,
      clientId: 'toml-client-id',
      includeDirs: [],
      excludePatterns: [],
      noGitIgnore: false,
    })
    expect(dependencies.recordMetadata).toHaveBeenCalledWith({num_security_findings: 0})
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appDirectory, 'shopify.app', {
      deterministicFindings,
      agentChecks,
    })
    expect(dependencies.listFiles).not.toHaveBeenCalled()
    expect(result).toEqual({
      kind: 'scan',
      resolution,
      scanDirectories: [{directory: appDirectory, origin: 'app_directory'}],
      execution: scanExecution,
      artifacts,
    })
  })

  test('scans with the --client-id override as the effective client ID', async () => {
    const dependencies = testDependencies()

    await securityCheck(
      resolutionFor({...configSelection, clientIdOverride: 'flag-client-id'}),
      {listFiles: false},
      dependencies,
    )

    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
  })

  test('scans without app configuration, with no selected TOML, under the client ID results key', async () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'flag-client-id',
      clientIdSource: 'flag',
    }
    const dependencies = testDependencies()

    await securityCheck(resolutionFor(selection, {resultsKey: 'flag-client-id'}), {listFiles: false}, dependencies)

    expect(dependencies.execute).toHaveBeenCalledWith(
      expect.objectContaining({appConfigFilePath: undefined, clientId: 'flag-client-id'}),
    )
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appDirectory, 'flag-client-id', expect.anything())
  })

  test('scans with the scope of the run, as typed', async () => {
    const dependencies = testDependencies()
    const scope = {include_dirs: ['backend', './backend/'], excludes: ['**/generated', '!keep'], no_git_ignore: true}

    await securityCheck(resolutionFor(configSelection, {scope}), {listFiles: false}, dependencies)

    expect(dependencies.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        includeDirs: ['backend', './backend/'],
        excludePatterns: ['**/generated', '!keep'],
        noGitIgnore: true,
      }),
    )
  })

  test('scans each --include-dir after the app directory and returns it with its origin', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const dependencies = testDependencies()

      const result = await securityCheck(
        resolutionFor(configSelection, {includeDirectories: [backend, backend]}),
        {listFiles: false},
        dependencies,
      )

      expect(dependencies.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scanDirectories: [appDirectory, backend],
          requestedScanDirectories: [appDirectory, backend],
        }),
      )
      expect(result).toMatchObject({
        scanDirectories: [
          {directory: appDirectory, origin: 'app_directory'},
          {directory: backend, origin: 'include_dir'},
        ],
      })
    })
  })

  test('leaves out an --include-dir inside the app directory, but still passes it for the Git ignore warning', async () => {
    await inTemporaryDirectory(async (directory) => {
      const realDirectory = await fileRealPath(directory)
      await mkdir(joinPath(directory, 'vendor'))
      const vendor = await fileRealPath(joinPath(directory, 'vendor'))
      const dependencies = testDependencies()

      await securityCheck(
        resolutionFor({...configSelection, appDirectory: realDirectory}, {includeDirectories: [vendor]}),
        {listFiles: false},
        dependencies,
      )

      expect(dependencies.execute).toHaveBeenCalledWith(
        expect.objectContaining({scanDirectories: [realDirectory], requestedScanDirectories: [realDirectory, vendor]}),
      )
    })
  })

  test('records the number of deterministic issues in the command metadata', async () => {
    const issue = {
      id: 'COMMITTED_SECRET',
      severity: 'high' as const,
      points: -25,
      title: 'Secret',
      message: 'secret',
      location: {file: 'app/routes/index.ts'},
      fix: {automated: false, description: 'remove it'},
    }
    const dependencies = testDependencies({
      ...scanExecution,
      scan: {...scan, issues: [issue, {...issue, location: {file: 'app/routes/other.ts'}}]},
    })

    await securityCheck(resolutionFor(), {listFiles: false}, dependencies)

    expect(dependencies.recordMetadata).toHaveBeenCalledWith({num_security_findings: 2})
  })

  test('does not write artifacts when the scan fails', async () => {
    const dependencies = testDependencies()
    dependencies.execute.mockRejectedValue(new Error('scan failed'))

    await expect(securityCheck(resolutionFor(), {listFiles: false}, dependencies)).rejects.toThrow('scan failed')

    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
  })

  test('re-scanning overwrites the check artifacts and leaves agent findings untouched', async () => {
    await inTemporaryDirectory(async (appRoot) => {
      const paths = appSecurityArtifactPaths(appRoot, 'shopify.app')
      await mkdir(paths.resultsDirectory)
      await writeFile(paths.deterministicFindingsPath, '{"previous": "scan"}\n')
      await writeFile(paths.agentChecksPath, '{"previous": "agent checks"}\n')
      // Not valid findings on purpose: check must not read, validate, or rewrite this file.
      const agentFindings = '{"recorded": "by the agent",  "kept": "byte for byte"}'
      await writeFile(paths.agentFindingsPath, agentFindings)
      const rescanFindings: DeterministicFindingsDocument = {
        ...deterministicFindings,
        generated_at: '2026-09-01T00:00:00.000Z',
      }

      const result = await securityCheck(
        resolutionFor({...configSelection, appDirectory: appRoot, appConfigFilePath: `${appRoot}/shopify.app.toml`}),
        {listFiles: false},
        {
          ...testDependencies({...scanExecution, deterministicFindings: rescanFindings}),
          writeArtifacts: writeCheckArtifacts,
        },
      )

      expect(JSON.parse(await readFile(paths.deterministicFindingsPath))).toEqual(rescanFindings)
      expect(JSON.parse(await readFile(paths.agentChecksPath))).toEqual(agentChecks)
      await expect(readFile(paths.agentFindingsPath)).resolves.toBe(agentFindings)
      expect(result).toMatchObject({
        artifacts: {deterministicFindingsPath: paths.deterministicFindingsPath, agentChecksPath: paths.agentChecksPath},
      })
    })
  })
})

describe('securityCheck --list-files', () => {
  test('gathers the files and returns them without scanning or writing anything', async () => {
    const dependencies = testDependencies()
    dependencies.listFiles.mockResolvedValue({
      paths: ['../backend/server.ts', 'app/routes/index.ts', 'shopify.app.toml'],
      ignoredScanDirectories: [appDirectory],
    })
    const resolution = resolutionFor()

    const result = await securityCheck(resolution, {listFiles: true}, dependencies)

    expect(result).toEqual({
      kind: 'file-list',
      resolution,
      paths: ['../backend/server.ts', 'app/routes/index.ts', 'shopify.app.toml'],
      ignoredScanDirectories: [appDirectory],
    })
    expect(dependencies.execute).not.toHaveBeenCalled()
    expect(dependencies.recordMetadata).not.toHaveBeenCalled()
    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
  })

  test('gathers with the scan directories and the scope of the run', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const dependencies = testDependencies()

      await securityCheck(
        resolutionFor(configSelection, {
          scope: {include_dirs: ['backend'], excludes: ['generated'], no_git_ignore: true},
          includeDirectories: [backend],
        }),
        {listFiles: true},
        dependencies,
      )

      expect(dependencies.listFiles).toHaveBeenCalledWith({
        appDirectory,
        scanDirectories: [appDirectory, backend],
        requestedScanDirectories: [appDirectory, backend],
        appConfigFilePath: `${appDirectory}/shopify.app.toml`,
        clientId: 'toml-client-id',
        includeDirs: ['backend'],
        excludePatterns: ['generated'],
        noGitIgnore: true,
      })
    })
  })

  test('gathers the real files, relative to the app directory, and writes no results', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await fileRealPath(directory)
      await mkdir(joinPath(appRoot, 'app'))
      await mkdir(joinPath(appRoot, 'generated'))
      await writeFile(joinPath(appRoot, 'shopify.app.toml'), validAppConfiguration())
      await writeFile(joinPath(appRoot, 'app', 'index.ts'), 'export {}\n')
      await writeFile(joinPath(appRoot, 'generated', 'out.ts'), 'export {}\n')
      vi.stubEnv('INIT_CWD', appRoot)

      const resolution = await resolveSecurityCheckSelection({
        ...selectionOptions(),
        directory: appRoot,
        excludePatterns: ['**/generated'],
      })
      const result = await securityCheck(
        resolution,
        {listFiles: true},
        {...testDependencies(), listFiles: listAppSecurityFiles},
      )

      // Outside a repository, the `.shopify` files that resolving the selection writes are gathered too.
      expect(result).toMatchObject({
        paths: ['.shopify/.gitignore', '.shopify/project.json', 'app/index.ts', 'shopify.app.toml'],
      })
      expect(resolution.resultsKey).toBe('shopify.app')
      await expect(fileExists(joinPath(appRoot, '.shopify', 'app-security'))).resolves.toBe(false)
    })
  })
})

describe('securityCheck --client-id lookup', () => {
  const unknownClientId = new AbortError('No app with client ID unknown-client-id found')

  /** The real selection resolver, with the client ID lookup replaced. */
  function resolveSelectionWith(lookUpApp: (clientId: string) => Promise<void>) {
    return (options: AppSecuritySelectionOptions) =>
      resolveAppSecuritySelection(options, {
        confirmScanWithoutAppConfig: async () => true,
        pickClientId: async () => 'picked-client-id',
        pickConfigFile: async () => 'shopify.app.toml',
        lookUpApp,
      })
  }

  async function createApp(directory: string): Promise<string> {
    const appRoot = await fileRealPath(directory)
    await writeFile(joinPath(appRoot, 'shopify.app.toml'), validAppConfiguration('toml-client-id'))
    vi.stubEnv('INIT_CWD', appRoot)
    return appRoot
  }

  test.each([false, true])(
    'looks up --client-id and proceeds when it is found (--list-files: %s)',
    async (listFiles) => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const lookUpApp = vi.fn(async (_clientId: string) => {})
        const dependencies = testDependencies()

        const resolution = await resolveSecurityCheckSelection(
          {...selectionOptions(), directory: appRoot, clientId: 'flag-client-id'},
          {resolveSelection: resolveSelectionWith(lookUpApp)},
        )
        await securityCheck(resolution, {listFiles}, dependencies)

        expect(lookUpApp).toHaveBeenCalledWith('flag-client-id')
        if (listFiles) {
          expect(dependencies.listFiles).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
        } else {
          expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appRoot, 'flag-client-id', expect.anything())
        }
      })
    },
  )

  test('aborts on an unknown --client-id before anything is gathered or written', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)

      await expect(
        resolveSecurityCheckSelection(
          {...selectionOptions(), directory: appRoot, clientId: 'unknown-client-id'},
          {
            resolveSelection: resolveSelectionWith(async () => {
              throw unknownClientId
            }),
          },
        ),
      ).rejects.toBe(unknownClientId)

      await expect(fileExists(joinPath(appRoot, '.shopify', 'app-security'))).resolves.toBe(false)
    })
  })

  test('does not look up the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const lookUpApp = vi.fn(async (_clientId: string) => {})

      await resolveSecurityCheckSelection(
        {...selectionOptions(), directory: appRoot},
        {resolveSelection: resolveSelectionWith(lookUpApp)},
      )

      expect(lookUpApp).not.toHaveBeenCalled()
    })
  })
})
