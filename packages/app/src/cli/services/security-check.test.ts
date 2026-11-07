import securityCheck from './security-check.js'
import {resolveAppSecurityCommands} from './app-security-commands.js'
import {appSecurityArtifactPaths, writeCheckArtifacts} from './app-security-artifacts.js'
import {resolveAppSecuritySelection} from './app-security-selection.js'
import {validAppConfiguration} from './app-security-selection.test-data.js'
import {
  agentChecks,
  committedSecretIssue,
  deterministicFindings,
  scanExecution,
  scan,
} from './security-check.test-data.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {afterEach, describe, expect, test, vi} from 'vitest'
import type {AppSecurityExecution} from './app-security-api.js'
import type {
  AppSecuritySelection,
  AppSecuritySelectionOptions,
  DeclinedAppSecuritySelection,
} from './app-security-selection.js'
import type {AppSecurityScope, DeterministicFindingsDocument} from './app-security-engine/index.js'

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

const scanDirectories = [{directory: appDirectory, origin: 'app_directory' as const}]

const noScope: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

/** The commands `check` generates for `--path` `appDirectory`, run from some other directory. */
function commandsFor(selection: AppSecuritySelection = configSelection, scope: AppSecurityScope = noScope) {
  return resolveAppSecurityCommands(selection, appDirectory, scope)
}

function stagingSelection(): AppSecuritySelection {
  return {
    kind: 'config',
    appDirectory,
    appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`,
    configClientId: 'toml-client-id',
  }
}

function testDependencies(
  execution: AppSecurityExecution = scanExecution,
  selection: AppSecuritySelection | DeclinedAppSecuritySelection = configSelection,
) {
  return {
    resolveSelection: vi.fn(async () => selection),
    execute: vi.fn(async () => execution),
    listFiles: vi.fn(async () => ({
      paths: ['shopify.app.toml'],
      ignoredScanDirectories: [] as string[],
      otherAppDirectories: [] as string[],
    })),
    writeArtifacts: vi.fn(async () => artifacts),
    canPrompt: vi.fn(() => false),
    recordMetadata: vi.fn(async () => {}),
  }
}

function testOptions() {
  return {
    directory: appDirectory,
    withoutAppConfig: false,
    blocking: 'none' as const,
    includeDirs: [],
    excludePatterns: [],
    noGitIgnore: false,
    listFiles: false,
  }
}

describe('securityCheck', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('executes, writes artifacts, then returns the scan', async () => {
    const dependencies = testDependencies()

    const check = await securityCheck({...testOptions(), blocking: 'high'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith({
      path: appDirectory,
      config: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      allowPrompts: false,
      validateClientIdFlag: true,
    })
    expect(dependencies.execute).toHaveBeenCalledWith({
      appDirectory,
      scanDirectories: [appDirectory],
      requestedScanDirectories: [appDirectory],
      appConfigDirectories: [],
      appConfigFilePath: `${appDirectory}/shopify.app.toml`,
      clientId: 'toml-client-id',
      includeDirs: [],
      excludePatterns: [],
      noGitIgnore: false,
    })
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appDirectory, 'shopify.app', {
      deterministicFindings,
      agentChecks,
    })
    expect(check).toEqual({
      kind: 'scanned',
      selection: configSelection,
      resultsKey: 'shopify.app',
      commands: commandsFor(),
      scope: noScope,
      scanDirectories,
      execution: scanExecution,
      artifacts,
      blocking: {level: 'high', blockedChecks: 0},
    })
  })

  test('forwards the config name and includes --config in generated commands', async () => {
    const dependencies = testDependencies(scanExecution, stagingSelection())

    const check = await securityCheck({...testOptions(), configName: 'staging'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({config: 'staging'}))
    expect(dependencies.execute).toHaveBeenCalledWith(
      expect.objectContaining({appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`}),
    )
    expect(check).toMatchObject({commands: commandsFor(stagingSelection())})
  })

  test('scans with the --client-id override as the effective client ID', async () => {
    const dependencies = testDependencies(scanExecution, {...configSelection, clientIdOverride: 'flag-client-id'})

    await securityCheck({...testOptions(), clientId: 'flag-client-id'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
  })

  test('forwards the scope flags to the scan and repeats them in generated commands', async () => {
    const dependencies = testDependencies()
    const excludePatterns = ['generated', '../shared/**']

    const check = await securityCheck({...testOptions(), excludePatterns, noGitIgnore: true}, dependencies)

    const scope = {include_dirs: [], excludes: excludePatterns, no_git_ignore: true}
    const commands = commandsFor(configSelection, scope)
    expect(commands.scan.args).toContainEqual({flag: '--exclude', value: 'generated'})
    expect(commands.scan.args).toContain('--no-git-ignore')
    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({excludePatterns, noGitIgnore: true}))
    expect(check).toMatchObject({commands, scope})
  })

  test('scans each --include-dir after the app directory, reports it, and repeats it before --exclude', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      vi.stubEnv('INIT_CWD', directory)
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const dependencies = testDependencies()
      const options = {...testOptions(), includeDirs: ['backend', './backend'], excludePatterns: ['generated']}

      const check = await securityCheck(options, dependencies)

      expect(dependencies.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scanDirectories: [appDirectory, backend],
          requestedScanDirectories: [appDirectory, backend],
        }),
      )
      const scope = {include_dirs: ['backend', './backend'], excludes: ['generated'], no_git_ignore: false}
      const commands = commandsFor(configSelection, scope)
      expect(commands.scan.args.slice(-3)).toEqual([
        {flag: '--include-dir', value: 'backend'},
        {flag: '--include-dir', value: './backend'},
        {flag: '--exclude', value: 'generated'},
      ])
      expect(check).toMatchObject({
        commands,
        scope,
        scanDirectories: [
          {directory: appDirectory, origin: 'app_directory'},
          {directory: backend, origin: 'include_dir'},
        ],
      })
    })
  })

  test('scans the app configuration directories of the selection after the include directories, without repeating them in generated commands', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      vi.stubEnv('INIT_CWD', directory)
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const sharedTheme = '/tmp/shared/theme'
      const dependencies = testDependencies(scanExecution, {...configSelection, appConfigDirectories: [sharedTheme]})

      const check = await securityCheck({...testOptions(), includeDirs: ['backend']}, dependencies)

      expect(dependencies.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scanDirectories: [appDirectory, backend, sharedTheme],
          requestedScanDirectories: [appDirectory, backend, sharedTheme],
          appConfigDirectories: [sharedTheme],
        }),
      )
      expect(check).toMatchObject({
        scanDirectories: [
          {directory: appDirectory, origin: 'app_directory'},
          {directory: backend, origin: 'include_dir'},
          {directory: sharedTheme, origin: 'app_config_directory'},
        ],
        commands: commandsFor(configSelection, {include_dirs: ['backend'], excludes: [], no_git_ignore: false}),
      })
    })
  })

  test('leaves out an --include-dir inside the app directory, but still passes it for the Git ignore warning', async () => {
    await inTemporaryDirectory(async (directory) => {
      const realDirectory = await fileRealPath(directory)
      await mkdir(joinPath(directory, 'vendor'))
      vi.stubEnv('INIT_CWD', directory)
      const dependencies = testDependencies(scanExecution, {...configSelection, appDirectory: realDirectory})

      await securityCheck({...testOptions(), includeDirs: ['vendor']}, dependencies)

      expect(dependencies.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scanDirectories: [realDirectory],
          requestedScanDirectories: [realDirectory, await fileRealPath(joinPath(directory, 'vendor'))],
        }),
      )
    })
  })

  test('aborts on a wrong --include-dir before resolving the selection or scanning', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.stubEnv('INIT_CWD', directory)
      const dependencies = testDependencies()

      await expect(securityCheck({...testOptions(), includeDirs: ['missing']}, dependencies)).rejects.toThrow(
        "--include-dir missing: directory doesn't exist.",
      )

      expect(dependencies.resolveSelection).not.toHaveBeenCalled()
      expect(dependencies.execute).not.toHaveBeenCalled()
    })
  })

  test('returns the scan directories that Git ignores and the directories that hold another app configuration', async () => {
    const execution = {
      ...scanExecution,
      ignoredScanDirectories: [joinPath(appDirectory, 'vendor')],
      otherAppDirectories: [joinPath(appDirectory, 'apps', 'child')],
    }
    const dependencies = testDependencies(execution)

    const check = await securityCheck(testOptions(), dependencies)

    expect(check).toMatchObject({kind: 'scanned', execution})
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
      const dependencies = {
        ...testDependencies(
          {...scanExecution, deterministicFindings: rescanFindings},
          {...configSelection, appDirectory: appRoot, appConfigFilePath: `${appRoot}/shopify.app.toml`},
        ),
        writeArtifacts: writeCheckArtifacts,
        canPrompt: vi.fn(() => true),
      }

      const check = await securityCheck({...testOptions(), directory: appRoot}, dependencies)

      expect(JSON.parse(await readFile(paths.deterministicFindingsPath))).toEqual(rescanFindings)
      expect(JSON.parse(await readFile(paths.agentChecksPath))).toEqual(agentChecks)
      await expect(readFile(paths.agentFindingsPath)).resolves.toBe(agentFindings)
      expect(check).toMatchObject({
        kind: 'scanned',
        artifacts: {deterministicFindingsPath: paths.deterministicFindingsPath, agentChecksPath: paths.agentChecksPath},
        blocking: {level: 'none', blockedChecks: 0},
      })
    })
  })

  test('allows prompts only in an interactive terminal', async () => {
    const interactive = testDependencies()
    interactive.canPrompt.mockReturnValue(true)
    await securityCheck(testOptions(), interactive)
    expect(interactive.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts: true}))

    const nonInteractive = testDependencies()
    await securityCheck(testOptions(), nonInteractive)
    expect(nonInteractive.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts: false}))
  })

  test('scans without app configuration, with no selected TOML and the client ID from the flag', async () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'flag-client-id',
      clientIdSource: 'flag',
    }
    const dependencies = testDependencies(scanExecution, selection)
    dependencies.canPrompt.mockReturnValue(true)
    const onSelectionPrompted = vi.fn()

    const check = await securityCheck(
      {...testOptions(), withoutAppConfig: true, clientId: 'flag-client-id', onSelectionPrompted},
      dependencies,
    )

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(
      expect.objectContaining({withoutAppConfig: true, clientId: 'flag-client-id'}),
    )
    expect(dependencies.execute).toHaveBeenCalledWith({
      appDirectory,
      scanDirectories: [appDirectory],
      requestedScanDirectories: [appDirectory],
      appConfigDirectories: [],
      appConfigFilePath: undefined,
      clientId: 'flag-client-id',
      includeDirs: [],
      excludePatterns: [],
      noGitIgnore: false,
    })
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appDirectory, 'flag-client-id', expect.anything())
    expect(onSelectionPrompted).not.toHaveBeenCalled()
    expect(check).toMatchObject({commands: commandsFor(selection)})
  })

  test('passes the generated check command on after the no-TOML prompt flow, before scanning', async () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'picked-client-id',
      clientIdSource: 'picker',
    }
    const dependencies = testDependencies(scanExecution, selection)
    dependencies.canPrompt.mockReturnValue(true)
    const onSelectionPrompted = vi.fn()

    await securityCheck({...testOptions(), onSelectionPrompted}, dependencies)

    const commands = commandsFor(selection)
    expect(commands.scan.args.slice(-2)).toEqual([
      {flag: '--client-id', value: 'picked-client-id'},
      '--without-app-config',
    ])
    expect(onSelectionPrompted).toHaveBeenCalledExactlyOnceWith(commands)
    expect(onSelectionPrompted.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.execute.mock.invocationCallOrder[0]!,
    )
  })

  test('passes the generated check command, with --config, on after asking which TOML to scan', async () => {
    const selection: AppSecuritySelection = {
      kind: 'config',
      appDirectory,
      appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`,
      configClientId: 'toml-client-id',
      appConfigFilePicked: true,
    }
    const dependencies = testDependencies(scanExecution, selection)
    dependencies.canPrompt.mockReturnValue(true)
    const onSelectionPrompted = vi.fn()

    await securityCheck({...testOptions(), onSelectionPrompted}, dependencies)

    const commands = commandsFor(selection)
    expect(commands.scan.args).toContainEqual({flag: '--config', value: 'staging'})
    expect(onSelectionPrompted).toHaveBeenCalledExactlyOnceWith(commands)
  })

  test('does not pass the generated check command on when a TOML was found', async () => {
    const dependencies = testDependencies()
    const onSelectionPrompted = vi.fn()

    await securityCheck({...testOptions(), onSelectionPrompted}, dependencies)

    expect(onSelectionPrompted).not.toHaveBeenCalled()
  })

  test('returns a cancellation, without scanning or writing anything, when scanning without app configuration is declined', async () => {
    const dependencies = testDependencies(scanExecution, {kind: 'declined'})
    dependencies.canPrompt.mockReturnValue(true)
    const onSelectionPrompted = vi.fn()

    const check = await securityCheck({...testOptions(), onSelectionPrompted}, dependencies)

    expect(check).toEqual({kind: 'cancelled'})
    expect(onSelectionPrompted).not.toHaveBeenCalled()
    expect(dependencies.execute).not.toHaveBeenCalled()
    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
    expect(dependencies.recordMetadata).not.toHaveBeenCalled()
  })

  test('does not write artifacts when the scan fails', async () => {
    const dependencies = testDependencies()
    dependencies.execute.mockRejectedValue(new Error('scan failed'))

    await expect(securityCheck(testOptions(), dependencies)).rejects.toThrow('scan failed')

    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
  })

  test('counts the checks that breach --blocking', async () => {
    const dependencies = testDependencies({...scanExecution, scan: {...scan, issues: [committedSecretIssue]}})

    const check = await securityCheck({...testOptions(), blocking: 'high'}, dependencies)

    expect(check).toMatchObject({blocking: {level: 'high', blockedChecks: 1}})
  })

  test('records the number of deterministic issues in the command metadata', async () => {
    const dependencies = testDependencies({
      ...scanExecution,
      scan: {
        ...scan,
        issues: [committedSecretIssue, {...committedSecretIssue, location: {file: 'app/routes/other.ts'}}],
      },
    })

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.recordMetadata).toHaveBeenCalledWith({num_security_findings: 2})
  })

  test('records zero findings when the scan finds no issues', async () => {
    const dependencies = testDependencies()

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.recordMetadata).toHaveBeenCalledWith({num_security_findings: 0})
  })

  test('counts no blocked checks when no finding reaches the blocking level', async () => {
    const dependencies = testDependencies()

    const check = await securityCheck({...testOptions(), blocking: 'low'}, dependencies)

    expect(check).toMatchObject({blocking: {level: 'low', blockedChecks: 0}})
  })
})

describe('securityCheck --list-files', () => {
  const listFilesOptions = {...testOptions(), listFiles: true}

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns each gathered path and does nothing else', async () => {
    const dependencies = testDependencies()
    const listing = {
      paths: ['../backend/server.ts', 'app/routes/index.ts', 'shopify.app.toml'],
      ignoredScanDirectories: [joinPath(appDirectory, 'vendor')],
      otherAppDirectories: [joinPath(appDirectory, 'apps', 'child')],
    }
    dependencies.listFiles.mockResolvedValue(listing)
    const onSelectionPrompted = vi.fn()

    const check = await securityCheck({...listFilesOptions, onSelectionPrompted}, dependencies)

    expect(check).toEqual({
      kind: 'listed',
      selection: configSelection,
      resultsKey: 'shopify.app',
      commands: commandsFor(),
      scope: noScope,
      scanDirectories,
      ...listing,
    })
    expect(dependencies.execute).not.toHaveBeenCalled()
    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
    expect(dependencies.recordMetadata).not.toHaveBeenCalled()
    expect(onSelectionPrompted).not.toHaveBeenCalled()
  })

  test('resolves without prompts, even in an interactive terminal', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck(listFilesOptions, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts: false}))
  })

  test('gathers with the scan directories and the scope of the run, and ignores --client-id', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      vi.stubEnv('INIT_CWD', directory)
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const dependencies = testDependencies()

      await securityCheck(
        {
          ...listFilesOptions,
          clientId: 'ignored-client-id',
          includeDirs: ['backend'],
          excludePatterns: ['generated'],
          noGitIgnore: true,
        },
        dependencies,
      )

      expect(dependencies.listFiles).toHaveBeenCalledWith({
        appDirectory,
        scanDirectories: [appDirectory, backend],
        requestedScanDirectories: [appDirectory, backend],
        appConfigDirectories: [],
        appConfigFilePath: `${appDirectory}/shopify.app.toml`,
        clientId: 'toml-client-id',
        includeDirs: ['backend'],
        excludePatterns: ['generated'],
        noGitIgnore: true,
      })
    })
  })

  test('returns the selection, the results key and the generated check command', async () => {
    const dependencies = testDependencies()

    const check = await securityCheck(
      {...listFilesOptions, includeDirs: [], excludePatterns: ['generated'], noGitIgnore: true},
      dependencies,
    )

    expect(check).toMatchObject({
      selection: configSelection,
      resultsKey: 'shopify.app',
      commands: {
        scan: {
          args: [
            'app',
            'security',
            'check',
            {flag: '--path', value: relativePath(cwd(), appDirectory)},
            {flag: '--exclude', value: 'generated'},
            '--no-git-ignore',
          ],
        },
      },
    })
  })

  test('lists the real files and writes no results', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await fileRealPath(directory)
      await mkdir(joinPath(appRoot, 'app'))
      await mkdir(joinPath(appRoot, 'generated'))
      await writeFile(joinPath(appRoot, 'shopify.app.toml'), validAppConfiguration())
      await writeFile(joinPath(appRoot, 'app', 'index.ts'), 'export {}\n')
      await writeFile(joinPath(appRoot, 'generated', 'out.ts'), 'export {}\n')
      vi.stubEnv('INIT_CWD', appRoot)

      const check = await securityCheck({...listFilesOptions, directory: appRoot, excludePatterns: ['**/generated']})

      // Outside a repository, the `.shopify` files that resolving the selection writes are gathered too.
      expect(check).toMatchObject({
        kind: 'listed',
        resultsKey: 'shopify.app',
        paths: ['.shopify/.gitignore', '.shopify/project.json', 'app/index.ts', 'shopify.app.toml'],
      })
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
        const dependencies = {...testDependencies(), resolveSelection: resolveSelectionWith(lookUpApp)}

        await securityCheck({...testOptions(), directory: appRoot, clientId: 'flag-client-id', listFiles}, dependencies)

        expect(lookUpApp).toHaveBeenCalledWith('flag-client-id')
        if (listFiles) {
          expect(dependencies.listFiles).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
        } else {
          expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appRoot, 'flag-client-id', expect.anything())
        }
      })
    },
  )

  test.each([false, true])(
    'aborts on an unknown --client-id before gathering files or writing results (--list-files: %s)',
    async (listFiles) => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const dependencies = {
          ...testDependencies(),
          writeArtifacts: writeCheckArtifacts,
          resolveSelection: resolveSelectionWith(async () => {
            throw unknownClientId
          }),
        }

        await expect(
          securityCheck({...testOptions(), directory: appRoot, clientId: 'unknown-client-id', listFiles}, dependencies),
        ).rejects.toBe(unknownClientId)

        expect(dependencies.listFiles).not.toHaveBeenCalled()
        expect(dependencies.execute).not.toHaveBeenCalled()
        expect(dependencies.recordMetadata).not.toHaveBeenCalled()
        await expect(fileExists(joinPath(appRoot, '.shopify', 'app-security'))).resolves.toBe(false)
      })
    },
  )

  test('does not look up the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const lookUpApp = vi.fn(async (_clientId: string) => {})

      await securityCheck(
        {...testOptions(), directory: appRoot},
        {...testDependencies(), resolveSelection: resolveSelectionWith(lookUpApp)},
      )

      expect(lookUpApp).not.toHaveBeenCalled()
    })
  })
})
