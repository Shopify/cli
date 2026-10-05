/* eslint-disable no-restricted-imports -- layouts are real temporary repositories and directories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import securityCheck from '../../security-check.js'
import {mergeScanDirectories, resolveIncludeDirectories} from '../../app-security-selection.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mkdir, mkdtemp, realpath, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join, resolve} from 'node:path'

type FileSpec = string | readonly [path: string, content: string]

interface Layout {
  /** Directories relative to the temporary directory, in the order they are initialized as repositories. */
  repositories: string[]
  files: FileSpec[]
  /** Files that are force-added and committed in `repository`; paths are relative to it. */
  committed?: {repository: string; paths: string[]}
}

/** Flags as typed on the command line. Paths are relative to the scenario's working directory. */
interface CheckFlags {
  path?: string
  config?: string
  clientId?: string
  withoutAppConfig?: boolean
  includeDirs?: string[]
  excludes?: string[]
  noGitIgnore?: boolean
  json?: boolean
}

/** `topLevelKeys` come first, since top-level keys must precede tables. */
function toml(path: string, clientId = 'client-app', topLevelKeys = ''): FileSpec {
  return [
    path,
    `${topLevelKeys}name = "test-app"
client_id = "${clientId}"
application_url = "https://example.com"
embedded = true

[auth]
redirect_urls = ["https://example.com/callback"]

[webhooks]
api_version = "2024-01"
`,
  ]
}

function ignoreFile(path: string, ...patterns: string[]): FileSpec {
  return [path, `${patterns.join('\n')}\n`]
}

async function buildLayout(root: string, layout: Layout): Promise<void> {
  for (const repository of layout.repositories) {
    // eslint-disable-next-line no-await-in-loop
    await mkdir(join(root, repository), {recursive: true})
    git(join(root, repository), ['init', '-q', '.'])
  }
  for (const file of layout.files) {
    const [path, content] = typeof file === 'string' ? [file, 'placeholder\n'] : file
    // eslint-disable-next-line no-await-in-loop
    await mkdir(dirname(join(root, path)), {recursive: true})
    // eslint-disable-next-line no-await-in-loop
    await writeFile(join(root, path), content)
  }
  if (layout.committed) {
    const repository = join(root, layout.committed.repository)
    git(repository, ['add', '-f', '--', ...layout.committed.paths])
    git(repository, ['commit', '-qm', 'init'])
  }
}

/** `T` is the real path of a fresh temporary directory that holds the layout. */
async function inLayout(layout: Layout, run: (temporaryDirectory: string) => Promise<void>): Promise<void> {
  const restoreGitConfig = isolateGitConfig()
  const temporaryDirectory = await realpath(await mkdtemp(join(tmpdir(), 'app-security-layout-')))
  try {
    await buildLayout(temporaryDirectory, layout)
    await run(temporaryDirectory)
  } finally {
    restoreGitConfig()
    await rm(temporaryDirectory, {recursive: true, force: true})
  }
}

/** Runs `check --list-files` from `workingDirectory` (relative to `T`), the way the command calls the service. */
async function checkListFiles(temporaryDirectory: string, workingDirectory: string, flags: CheckFlags = {}) {
  const absoluteWorkingDirectory = resolve(temporaryDirectory, workingDirectory)
  vi.stubEnv('INIT_CWD', absoluteWorkingDirectory)
  const directory = resolve(absoluteWorkingDirectory, flags.path ?? '.')

  return withCapturedStandardStreams(async ({stdout, stderr}) => {
    const resolution = await securityCheck({
      directory,
      configName: flags.config,
      clientId: flags.clientId,
      withoutAppConfig: flags.withoutAppConfig ?? false,
      includeDirs: flags.includeDirs ?? [],
      excludePatterns: flags.excludes ?? [],
      noGitIgnore: flags.noGitIgnore ?? false,
      listFiles: true,
      json: flags.json ?? false,
      verbose: false,
      blocking: 'none',
      yes: false,
      skipInstructions: false,
    })
    return {resolution, stdout: stdout(), stderr: stderr()}
  })
}

function listedPaths(stdout: string): string[] {
  return stdout.split('\n').slice(0, -1)
}

/** The warning box's text with its styling and frame removed, so a wrapped line reads as one sentence. */
function warningText(stderr: string): string {
  return unstyled(stderr)
    .replaceAll(/[│╭╮╰╯─]/g, ' ')
    .replaceAll(/\s+/g, ' ')
}

function withoutGitDirectories(paths: string[]): {paths: string[]; removed: string[]} {
  const isInsideGitDirectory = (path: string) => path.split('/').includes('.git')
  return {paths: paths.filter((path) => !isInsideGitDirectory(path)), removed: paths.filter(isInsideGitDirectory)}
}

const FLAGS_WITH_VALUES = new Set(['--path', '--config', '--client-id', '--include-dir', '--exclude'])

/** The generated `check` command's args, written like the command line: `checkArgs('--path', 'app')`. */
function checkArgs(...tokens: string[]) {
  const rest = tokens.flatMap((token, index): (string | {flag: string; value: string})[] => {
    if (FLAGS_WITH_VALUES.has(token)) return [{flag: token, value: tokens[index + 1] ?? ''}]
    return FLAGS_WITH_VALUES.has(tokens[index - 1] ?? '') ? [] : [token]
  })
  return ['app', 'security', 'check', ...rest]
}

type Resolution = Awaited<ReturnType<typeof checkListFiles>>['resolution']

function expectConfigSelection(
  resolution: Resolution,
  expected: {appDirectory: string; tomlFileName: string; resultsKey: string},
) {
  expect(resolution.selection).toMatchObject({
    kind: 'config',
    appDirectory: expected.appDirectory,
    appConfigFilePath: joinPath(expected.appDirectory, expected.tomlFileName),
  })
  expect(resolution.resultsKey).toBe(expected.resultsKey)
}

async function expectNoTomlFound(attempt: Promise<unknown>, directory: string) {
  const error = await attempt.then(
    () => undefined,
    (thrown: unknown) => thrown,
  )
  expect(error).toBeInstanceOf(AbortError)
  expect((error as AbortError).message).toBe(`No app configuration found at or above ${directory}.`)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

const appWithExtension: Layout = {
  repositories: ['app'],
  files: [toml('app/shopify.app.toml'), 'app/app/routes/webhooks.tsx', 'app/extensions/checkout-ui/src/Checkout.tsx'],
}

const projectWithLibrary: Layout = {
  repositories: ['my-project', 'my-shopify-library'],
  files: [
    'my-project/package.json',
    'my-project/app/routes/webhooks.ts',
    toml('my-project/extensions/shopify.app.toml'),
    toml('my-project/extensions/shopify.app.production.toml', 'client-production'),
    'my-project/extensions/checkout-ui/src/Checkout.tsx',
    'my-shopify-library/src/session.ts',
  ],
}

const setupMcpDirectory = 'world/areas/apps/setup-mcp'
const setupMcp: Layout = {
  repositories: ['world'],
  files: [
    `${setupMcpDirectory}/package.json`,
    `${setupMcpDirectory}/server/src/index.ts`,
    `${setupMcpDirectory}/shared/util.ts`,
    `${setupMcpDirectory}/microsoft/index.ts`,
    toml(`${setupMcpDirectory}/connectors/shopify.app.toml`),
    toml(`${setupMcpDirectory}/connectors/shopify.app.shopify-claude-connector-app.toml`, 'client-claude'),
    toml(`${setupMcpDirectory}/connectors/shopify.app.connector-a.toml`),
    toml(`${setupMcpDirectory}/connectors/shopify.app.connector-b.toml`),
  ],
}

const packagesDirectory = 'world/areas/apps/shopify-app-packages'
const multiAppRoot: Layout = {
  repositories: ['world'],
  files: [
    `${packagesDirectory}/packages/php/src/Client.php`,
    toml(`${packagesDirectory}/templates/django/shopify.app.django-app.toml`),
    toml(`${packagesDirectory}/templates/laravel/shopify.app.toml`),
    toml(`${packagesDirectory}/templates/laravel/shopify.app.laravel.toml`),
    `${packagesDirectory}/templates/laravel/composer.json`,
    `${packagesDirectory}/templates/laravel/app/Http/Kernel.php`,
  ],
}

const twoRepositories: Layout = {
  repositories: ['app', 'backend'],
  files: [
    toml('app/shopify.app.toml'),
    'app/extensions/checkout-ui/src/Checkout.tsx',
    'backend/src/server.ts',
    'backend/src/admin/index.ts',
  ],
}

const libraryOutsideRepository: Layout = {
  repositories: ['tale', 'shopkit'],
  files: [toml('tale/shopify.app.toml'), 'tale/cmd/server/main.go', 'shopkit/go.mod', 'shopkit/auth/hmac.go'],
}

describe('layout catalogue: check --list-files', () => {
  test('1. toml-at-root', async () => {
    await inLayout(appWithExtension, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app')

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        'app/routes/webhooks.tsx',
        'extensions/checkout-ui/src/Checkout.tsx',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(checkArgs())
    })
  })

  test('2. toml-at-root-from-subdirectory', async () => {
    await inLayout(appWithExtension, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app/app/routes')

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        'app/routes/webhooks.tsx',
        'extensions/checkout-ui/src/Checkout.tsx',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(checkArgs())
    })
  })

  test('3. toml-in-subdir-with-library', async () => {
    await inLayout(projectWithLibrary, async (root) => {
      const flags = {
        path: 'extensions',
        config: 'production',
        includeDirs: ['.', '../my-shopify-library'],
      }
      const {resolution, stdout} = await checkListFiles(root, 'my-project', flags)

      const appDirectory = join(root, 'my-project/extensions')
      expectConfigSelection(resolution, {
        appDirectory,
        tomlFileName: 'shopify.app.production.toml',
        resultsKey: 'shopify.app.production',
      })
      const {scanDirectories} = mergeScanDirectories(appDirectory, await resolveIncludeDirectories(flags.includeDirs))
      expect(
        scanDirectories.map(({directory, origin}) => ({directory: relativePath(appDirectory, directory), origin})),
      ).toEqual([
        {directory: '..', origin: 'include_dir'},
        {directory: '../../my-shopify-library', origin: 'include_dir'},
      ])
      expect(listedPaths(stdout)).toEqual([
        '../../my-shopify-library/src/session.ts',
        '../app/routes/webhooks.ts',
        '../package.json',
        'checkout-ui/src/Checkout.tsx',
        'shopify.app.production.toml',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs(
          '--path',
          'extensions',
          '--config',
          'production',
          '--include-dir',
          '.',
          '--include-dir',
          '../my-shopify-library',
        ),
      )

      await expectNoTomlFound(checkListFiles(root, 'my-project'), join(root, 'my-project'))
    })
  })

  test('4. toml-in-subdir-from-toml-directory', async () => {
    await inLayout(projectWithLibrary, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'my-project/extensions', {
        config: 'production',
        includeDirs: ['..', '../../my-shopify-library'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'my-project/extensions'),
        tomlFileName: 'shopify.app.production.toml',
        resultsKey: 'shopify.app.production',
      })
      expect(listedPaths(stdout)).toEqual([
        '../../my-shopify-library/src/session.ts',
        '../app/routes/webhooks.ts',
        '../package.json',
        'checkout-ui/src/Checkout.tsx',
        'shopify.app.production.toml',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--config', 'production', '--include-dir', '..', '--include-dir', '../../my-shopify-library'),
      )
    })
  })

  test('5. toml-in-subdir-no-git', async () => {
    await inLayout({...projectWithLibrary, repositories: []}, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'my-project', {
        path: 'extensions',
        config: 'production',
        includeDirs: ['.', '../my-shopify-library'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'my-project/extensions'),
        tomlFileName: 'shopify.app.production.toml',
        resultsKey: 'shopify.app.production',
      })
      expect(listedPaths(stdout)).toEqual([
        '../../my-shopify-library/src/session.ts',
        '../app/routes/webhooks.ts',
        '../package.json',
        '.shopify/.gitignore',
        '.shopify/project.json',
        'checkout-ui/src/Checkout.tsx',
        'shopify.app.production.toml',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs(
          '--path',
          'extensions',
          '--config',
          'production',
          '--include-dir',
          '.',
          '--include-dir',
          '../my-shopify-library',
        ),
      )
    })
  })

  test('6. setup-mcp', async () => {
    await inLayout(setupMcp, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, setupMcpDirectory, {
        path: 'connectors',
        config: 'shopify-claude-connector-app',
        includeDirs: ['.'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, setupMcpDirectory, 'connectors'),
        tomlFileName: 'shopify.app.shopify-claude-connector-app.toml',
        resultsKey: 'shopify.app.shopify-claude-connector-app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../microsoft/index.ts',
        '../package.json',
        '../server/src/index.ts',
        '../shared/util.ts',
        'shopify.app.connector-a.toml',
        'shopify.app.connector-b.toml',
        'shopify.app.shopify-claude-connector-app.toml',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--path', 'connectors', '--config', 'shopify-claude-connector-app', '--include-dir', '.'),
      )
    })
  })

  test('7. setup-mcp-from-connectors', async () => {
    await inLayout(setupMcp, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, `${setupMcpDirectory}/connectors`, {
        config: 'shopify-claude-connector-app',
        includeDirs: ['..'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, setupMcpDirectory, 'connectors'),
        tomlFileName: 'shopify.app.shopify-claude-connector-app.toml',
        resultsKey: 'shopify.app.shopify-claude-connector-app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../microsoft/index.ts',
        '../package.json',
        '../server/src/index.ts',
        '../shared/util.ts',
        'shopify.app.connector-a.toml',
        'shopify.app.connector-b.toml',
        'shopify.app.shopify-claude-connector-app.toml',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--config', 'shopify-claude-connector-app', '--include-dir', '..'),
      )
    })
  })

  test('8. multi-app-root', async () => {
    await inLayout(multiAppRoot, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, packagesDirectory, {
        path: 'templates/laravel',
        includeDirs: ['packages/php'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, packagesDirectory, 'templates/laravel'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../../packages/php/src/Client.php',
        'app/Http/Kernel.php',
        'composer.json',
        'shopify.app.laravel.toml',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--path', 'templates/laravel', '--include-dir', 'packages/php'),
      )

      await expectNoTomlFound(checkListFiles(root, packagesDirectory), join(root, packagesDirectory))
    })
  })

  test('9. multi-app-root-from-monorepo', async () => {
    await inLayout(multiAppRoot, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, packagesDirectory, {
        path: 'templates/laravel',
        includeDirs: ['.'],
        excludes: ['templates/django'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, packagesDirectory, 'templates/laravel'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../../packages/php/src/Client.php',
        'app/Http/Kernel.php',
        'composer.json',
        'shopify.app.laravel.toml',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--path', 'templates/laravel', '--include-dir', '.', '--exclude', 'templates/django'),
      )
    })
  })

  test('10. no-toml-backend', async () => {
    await inLayout(
      {repositories: ['backend'], files: ['backend/src/server.ts', 'backend/src/admin/index.ts']},
      async (root) => {
        const {resolution, stdout} = await checkListFiles(root, 'backend', {
          withoutAppConfig: true,
          clientId: 'client-backend',
        })

        expect(resolution.selection).toMatchObject({
          kind: 'no-config',
          appDirectory: join(root, 'backend'),
          clientId: 'client-backend',
          clientIdSource: 'flag',
        })
        expect(resolution.resultsKey).toBe('client-backend')
        expect(listedPaths(stdout)).toEqual(['src/admin/index.ts', 'src/server.ts'])
        expect(resolution.commands.scan.args).toEqual(
          checkArgs('--client-id', 'client-backend', '--without-app-config'),
        )

        await expectNoTomlFound(checkListFiles(root, 'backend'), join(root, 'backend'))
        await expectNoTomlFound(checkListFiles(root, 'backend', {clientId: 'client-backend'}), join(root, 'backend'))
      },
    )
  })

  test('11. two-repos-from-app', async () => {
    await inLayout(twoRepositories, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app', {includeDirs: ['../backend']})

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../backend/src/admin/index.ts',
        '../backend/src/server.ts',
        'extensions/checkout-ui/src/Checkout.tsx',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(checkArgs('--include-dir', '../backend'))
    })
  })

  test('12. two-repos-from-backend', async () => {
    await inLayout(twoRepositories, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'backend', {path: '../app', includeDirs: ['.']})

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../backend/src/admin/index.ts',
        '../backend/src/server.ts',
        'extensions/checkout-ui/src/Checkout.tsx',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(checkArgs('--path', '../app', '--include-dir', '.'))
    })
  })

  test('13. no-toml-beside-other-app', async () => {
    const layout: Layout = {
      repositories: ['mono'],
      files: [
        'mono/backend/src/server.ts',
        'mono/shared/auth.ts',
        toml('mono/storefront-app/shopify.app.toml'),
        'mono/storefront-app/app/routes/index.tsx',
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'mono', {
        withoutAppConfig: true,
        clientId: 'client-backend',
        excludes: ['storefront-app'],
      })

      expect(resolution.selection).toMatchObject({kind: 'no-config', appDirectory: join(root, 'mono')})
      expect(resolution.resultsKey).toBe('client-backend')
      expect(listedPaths(stdout)).toEqual(['backend/src/server.ts', 'shared/auth.ts'])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--client-id', 'client-backend', '--without-app-config', '--exclude', 'storefront-app'),
      )
    })
  })

  test('14. library-outside-repo', async () => {
    await inLayout(libraryOutsideRepository, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'tale', {includeDirs: ['../shopkit']})

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'tale'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../shopkit/auth/hmac.go',
        '../shopkit/go.mod',
        'cmd/server/main.go',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(checkArgs('--include-dir', '../shopkit'))
    })
  })

  test('15. library-outside-repo-from-library', async () => {
    await inLayout(libraryOutsideRepository, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'shopkit', {path: '../tale', includeDirs: ['.']})

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'tale'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../shopkit/auth/hmac.go',
        '../shopkit/go.mod',
        'cmd/server/main.go',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(checkArgs('--path', '../tale', '--include-dir', '.'))
    })
  })

  test('16. workers-outside-toml-directory', async () => {
    const layout: Layout = {
      repositories: ['checkout-links'],
      files: [
        toml('checkout-links/app/shopify.app.toml'),
        'checkout-links/app/app/routes/index.tsx',
        'checkout-links/workers/api/src/index.ts',
        'checkout-links/workers/webhooks/src/index.ts',
        'checkout-links/marketing/index.html',
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'checkout-links', {
        path: 'app',
        includeDirs: ['.'],
        excludes: ['marketing'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'checkout-links/app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual([
        '../workers/api/src/index.ts',
        '../workers/webhooks/src/index.ts',
        'app/routes/index.tsx',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--path', 'app', '--include-dir', '.', '--exclude', 'marketing'),
      )
    })
  })

  test('17. home-directory', async () => {
    const layout: Layout = {
      repositories: ['my-project'],
      files: [
        '.aws/credentials',
        '.ssh/id_ed25519',
        'my-project/app/routes/webhooks.ts',
        toml('my-project/extensions/shopify.app.toml'),
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, '.', {
        path: 'my-project/extensions',
        includeDirs: ['my-project'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'my-project/extensions'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual(['../app/routes/webhooks.ts', 'shopify.app.toml'])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--path', 'my-project/extensions', '--include-dir', 'my-project'),
      )

      await expectNoTomlFound(checkListFiles(root, '.'), root)
      await expectNoTomlFound(checkListFiles(root, '.', {path: 'my-project'}), join(root, 'my-project'))
    })
  })

  test('18. stray-toml-in-parent', async () => {
    const layout: Layout = {
      repositories: ['src/my-project'],
      files: [
        toml('src/shopify.app.toml', 'client-stray'),
        'src/other-project/index.ts',
        'src/my-project/app/routes/webhooks.ts',
        toml('src/my-project/extensions/shopify.app.toml'),
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'src/my-project', {
        path: 'extensions',
        includeDirs: ['.'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'src/my-project/extensions'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual(['../app/routes/webhooks.ts', 'shopify.app.toml'])
      expect(resolution.commands.scan.args).toEqual(checkArgs('--path', 'extensions', '--include-dir', '.'))

      const walkedUp = await checkListFiles(root, 'src/my-project')
      expect(walkedUp.resolution.selection).toMatchObject({
        kind: 'config',
        appDirectory: join(root, 'src'),
        appConfigFilePath: joinPath(root, 'src/shopify.app.toml'),
      })
    })
  })

  test('19. gitignored-build-output', async () => {
    const layout: Layout = {
      repositories: ['app'],
      files: [
        ignoreFile('app/.gitignore', 'runtime/', 'local-data/'),
        toml('app/shopify.app.toml'),
        'app/src/server.ts',
        'app/runtime/server.js',
        'app/local-data/dump.sql',
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app', {noGitIgnore: true, excludes: ['local-data']})

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      const {paths, removed} = withoutGitDirectories(listedPaths(stdout))
      expect(removed.length).toBeGreaterThan(0)
      expect(paths).toEqual([
        '.gitignore',
        '.shopify/.gitignore',
        '.shopify/project.json',
        'runtime/server.js',
        'shopify.app.toml',
        'src/server.ts',
      ])
      expect(resolution.commands.scan.args).toEqual(checkArgs('--exclude', 'local-data', '--no-git-ignore'))

      const withDefaults = await checkListFiles(root, 'app')
      expect(listedPaths(withDefaults.stdout)).toEqual(['.gitignore', 'shopify.app.toml', 'src/server.ts'])
    })
  })

  test('20. build-only-with-dist', async () => {
    const layout: Layout = {
      repositories: ['app'],
      files: [
        ignoreFile('app/.gitignore', 'dist/'),
        toml('app/shopify.app.toml'),
        'app/src/server.ts',
        'app/dist/server.js',
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app', {noGitIgnore: true, excludes: ['src']})

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      const {paths, removed} = withoutGitDirectories(listedPaths(stdout))
      expect(removed.length).toBeGreaterThan(0)
      expect(paths).toEqual([
        '.gitignore',
        '.shopify/.gitignore',
        '.shopify/project.json',
        'dist/server.js',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(checkArgs('--exclude', 'src', '--no-git-ignore'))
    })
  })

  test('21. two-repos-with-different-ignore-needs', async () => {
    const layout: Layout = {
      repositories: ['app', 'backend'],
      files: [
        ignoreFile('app/.gitignore', 'local-data/'),
        toml('app/shopify.app.toml'),
        'app/local-data/dump.sql',
        ignoreFile('backend/.gitignore', 'runtime/'),
        'backend/runtime/server.js',
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app', {
        includeDirs: ['../backend'],
        noGitIgnore: true,
        excludes: ['local-data'],
      })

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      const {paths, removed} = withoutGitDirectories(listedPaths(stdout))
      expect(removed.length).toBeGreaterThan(0)
      expect(paths).toEqual([
        '../backend/.gitignore',
        '../backend/runtime/server.js',
        '.gitignore',
        '.shopify/.gitignore',
        '.shopify/project.json',
        'shopify.app.toml',
      ])
      expect(resolution.commands.scan.args).toEqual(
        checkArgs('--include-dir', '../backend', '--exclude', 'local-data', '--no-git-ignore'),
      )
    })
  })

  test('22. node-modules-not-ignored', async () => {
    const layout: Layout = {
      repositories: ['app'],
      files: [toml('app/shopify.app.toml'), 'app/src/a.ts', 'app/node_modules/x/index.js'],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app')

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual(['node_modules/x/index.js', 'shopify.app.toml', 'src/a.ts'])
    })
  })

  test('23. nested-repository', async () => {
    const layout: Layout = {
      repositories: ['app', 'app/lib'],
      files: [
        toml('app/shopify.app.toml'),
        ignoreFile('app/lib/.gitignore', 'node_modules/'),
        'app/lib/index.ts',
        'app/lib/node_modules/x/index.js',
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app')

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual(['lib/.gitignore', 'lib/index.ts', 'shopify.app.toml'])
    })
  })

  test('24. nested-repository-ignored-by-outer', async () => {
    const layout: Layout = {
      repositories: ['app', 'app/vendor/sdk'],
      files: [
        ignoreFile('app/.gitignore', 'vendor/'),
        toml('app/shopify.app.toml'),
        'app/src/a.ts',
        'app/vendor/sdk/sdk.ts',
      ],
    }
    await inLayout(layout, async (root) => {
      const expectedPaths = ['.gitignore', 'shopify.app.toml', 'src/a.ts']

      const plain = await checkListFiles(root, 'app')
      expectConfigSelection(plain.resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(plain.stdout)).toEqual(expectedPaths)
      expect(plain.stderr).not.toContain('ignored by Git')

      const included = await checkListFiles(root, 'app', {includeDirs: ['vendor/sdk']})
      expect(listedPaths(included.stdout)).toEqual(expectedPaths)
      expect(warningText(included.stderr)).toContain(
        'vendor/sdk is ignored by Git, so only the files Git tracks in it are scanned.',
      )
    })
  })

  test('25. ignored-app-directory', async () => {
    const layout: Layout = {
      repositories: ['mono'],
      files: [
        ignoreFile('mono/.gitignore', 'apps/'),
        toml('mono/apps/app/shopify.app.toml'),
        'mono/apps/app/src/a.ts',
        'mono/apps/app/src/tracked.ts',
      ],
      committed: {repository: 'mono', paths: ['apps/app/src/tracked.ts']},
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout, stderr} = await checkListFiles(root, 'mono/apps/app')

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'mono/apps/app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual(['shopify.app.toml', 'src/tracked.ts'])
      expect(warningText(stderr)).toContain('. is ignored by Git, so only the files Git tracks in it are scanned.')
    })
  })

  test('26. exclude-cannot-remove-selected-toml', async () => {
    const layout: Layout = {
      repositories: ['app'],
      files: [toml('app/shopify.app.toml'), 'app/src/a.ts'],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout} = await checkListFiles(root, 'app', {excludes: ['shopify.app.toml', 'src']})

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      expect(listedPaths(stdout)).toEqual(['shopify.app.toml'])
    })
  })

  test('27. list-files-json', async () => {
    await inLayout(twoRepositories, async (root) => {
      const {stdout} = await checkListFiles(root, 'app', {includeDirs: ['../backend'], json: true})

      expect(JSON.parse(stdout)).toEqual({
        files: [
          '../backend/src/admin/index.ts',
          '../backend/src/server.ts',
          'extensions/checkout-ui/src/Checkout.tsx',
          'shopify.app.toml',
        ],
      })
    })
  })

  test('28. extension-and-web-directories-outside-the-app', async () => {
    const layout: Layout = {
      repositories: ['monorepo'],
      files: [
        toml(
          'monorepo/app/shopify.app.toml',
          'client-app',
          'extension_directories = ["../shared-extensions/*"]\nweb_directories = ["../backend"]\n',
        ),
        'monorepo/app/app/routes/index.tsx',
        ['monorepo/shared-extensions/theme/shopify.extension.toml', 'name = "theme"\ntype = "theme"\n'],
        'monorepo/shared-extensions/theme/blocks/banner.liquid',
        'monorepo/shared-extensions/README.md',
        ['monorepo/backend/shopify.web.toml', 'name = "backend"\nroles = ["backend"]\n\n[commands]\ndev = "dev"\n'],
        'monorepo/backend/src/server.ts',
      ],
    }
    await inLayout(layout, async (root) => {
      const {resolution, stdout, stderr} = await checkListFiles(root, 'monorepo/app')

      expectConfigSelection(resolution, {
        appDirectory: join(root, 'monorepo/app'),
        tomlFileName: 'shopify.app.toml',
        resultsKey: 'shopify.app',
      })
      // Each matched TOML's directory is scanned, not every directory the glob starts from.
      expect(listedPaths(stdout)).toEqual([
        '../backend/shopify.web.toml',
        '../backend/src/server.ts',
        '../shared-extensions/theme/blocks/banner.liquid',
        '../shared-extensions/theme/shopify.extension.toml',
        'app/routes/index.tsx',
        'shopify.app.toml',
      ])
      expect(warningText(stderr)).not.toContain("another app's configuration")
      expect(resolution.commands.scan.args).toEqual(checkArgs())
    })
  })
})
