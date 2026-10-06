/* eslint-disable no-restricted-imports -- scan directories use real temporary repositories and directories */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {configureRepositoryReader, gatherPaths} from '../scanners/discover.js'
import {createPathRules} from '../scanners/path-rules.js'
import {scan} from '../scanners/index.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mkdir, mkdtemp, realpath, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename, join} from 'node:path'

const temporaryDirectories: string[] = []
const appConfiguration = 'name = "Scan directories"\napplication_url = "https://example.com"\n'
const secret = ['shp', `at_${'0123456789abcdef'.repeat(2)}`].join('')

let restoreGitConfig: (() => void) | undefined

beforeEach(() => {
  restoreGitConfig = isolateGitConfig()
})

afterEach(async () => {
  restoreGitConfig?.()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

/** The real path, which is what the CLI's resolver gives the engine. */
async function makeDirectory(files: Record<string, string> = {}): Promise<string> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'app-security-scan-directories-')))
  temporaryDirectories.push(directory)
  await writeFiles(directory, files)
  return directory
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const fullPath = join(root, path)
      await mkdir(join(fullPath, '..'), {recursive: true})
      await writeFile(fullPath, content)
    }),
  )
}

/** Initializes the repository in `directory` when given, otherwise in a new temporary directory. */
async function makeRepository(files: Record<string, string>, directory?: string): Promise<string> {
  const root = directory ?? (await makeDirectory())
  await mkdir(root, {recursive: true})
  git(root, ['init', '-q', '.'])
  await writeFiles(root, files)
  return root
}

function commitEverything(repository: string): void {
  git(repository, ['add', '-A'])
  git(repository, ['commit', '-qm', 'init'])
}

interface ScanDirectoriesInput {
  appDirectory: string
  scanDirectories: string[]
  requestedScanDirectories?: string[]
  excludePatterns?: string[]
}

async function gather(input: ScanDirectoriesInput) {
  configureRepositoryReader({
    appDirectory: input.appDirectory,
    scanDirectories: input.scanDirectories,
    explicitInputs: new Set(),
  })
  return gatherPaths({
    appDirectory: input.appDirectory,
    scanDirectories: input.scanDirectories,
    requestedScanDirectories: input.requestedScanDirectories ?? input.scanDirectories,
    rules: createPathRules({excludePatterns: input.excludePatterns ?? [], noGitIgnore: false}),
  })
}

function scanAll(input: ScanDirectoriesInput) {
  return scan(
    {
      appDirectory: input.appDirectory,
      scanDirectories: input.scanDirectories,
      requestedScanDirectories: input.requestedScanDirectories ?? input.scanDirectories,
      appConfigFilePath: join(input.appDirectory, 'shopify.app.toml'),
    },
    {excludePatterns: input.excludePatterns ?? []},
  )
}

describe('two repositories', () => {
  async function makeTwoRepositories() {
    const app = await makeRepository({
      '.gitignore': 'local.txt\n',
      'shopify.app.toml': appConfiguration,
      'src/a.ts': 'export const a = true',
      'local.txt': 'ignored by the app repository',
    })
    const backend = await makeRepository({
      '.gitignore': 'dist/\n',
      'src/server.ts': 'export const server = true',
      'dist/out.js': 'ignored by the backend repository',
      'local.txt': 'not ignored by the backend repository',
    })
    return {app, backend}
  }

  test('applies each repository its own ignore rules, with paths relative to the app directory', async () => {
    const {app, backend} = await makeTwoRepositories()
    const backendName = basename(backend)

    const result = await gather({appDirectory: app, scanDirectories: [app, backend]})

    expect(result.paths).toEqual(
      [
        `../${backendName}/.gitignore`,
        `../${backendName}/local.txt`,
        `../${backendName}/src/server.ts`,
        '.gitignore',
        'shopify.app.toml',
        'src/a.ts',
      ].sort(),
    )
    expect(result.ignoredScanDirectories).toEqual([])
  })

  test('matches --exclude against the working directory, whichever repository it is', async () => {
    const {app, backend} = await makeTwoRepositories()
    const backendName = basename(backend)
    const scanDirectories = [app, backend]

    vi.stubEnv('INIT_CWD', app)
    const fromApp = await gather({appDirectory: app, scanDirectories, excludePatterns: [`../${backendName}/src`]})
    vi.stubEnv('INIT_CWD', backend)
    const fromBackend = await gather({appDirectory: app, scanDirectories, excludePatterns: ['src']})

    expect(fromApp.paths).not.toContain(`../${backendName}/src/server.ts`)
    expect(fromApp.paths).toContain('src/a.ts')
    expect(fromBackend.paths).toEqual(fromApp.paths)
  })
})

describe('a library outside any repository', () => {
  test('gathers every file in it, since no repository has ignore rules for it', async () => {
    const app = await makeRepository({
      'shopify.app.toml': appConfiguration,
      'src/a.ts': 'export const a = true',
    })
    const library = await makeDirectory({
      'index.ts': 'export const library = true',
      'node_modules/dependency/index.js': 'module.exports = {}',
    })
    const libraryName = basename(library)

    const result = await gather({appDirectory: app, scanDirectories: [app, library]})

    expect(result.paths).toEqual(
      [
        `../${libraryName}/index.ts`,
        `../${libraryName}/node_modules/dependency/index.js`,
        'shopify.app.toml',
        'src/a.ts',
      ].sort(),
    )
  })
})

describe('a scan directory inside another one', () => {
  test('is gathered once, by the walk of the outer directory', async () => {
    const app = await makeRepository({'shopify.app.toml': appConfiguration, 'lib/index.ts': 'export const lib = true'})

    const result = await gather({
      appDirectory: app,
      scanDirectories: [app],
      requestedScanDirectories: [app, join(app, 'lib')],
    })

    expect(result.paths).toEqual(['lib/index.ts', 'shopify.app.toml'])
    expect(result.ignoredScanDirectories).toEqual([])
  })

  test('still gets the ignored-scan-directory warning, although the outer walk prunes it', async () => {
    const app = await makeRepository({
      '.gitignore': 'vendor/\n',
      'shopify.app.toml': appConfiguration,
      'src/a.ts': 'export const a = true',
    })
    const sdk = await makeRepository({'sdk.ts': 'export const sdk = true'}, join(app, 'vendor', 'sdk'))

    const result = await gather({
      appDirectory: app,
      scanDirectories: [app],
      requestedScanDirectories: [app, sdk],
    })

    expect(result.paths).toEqual(['.gitignore', 'shopify.app.toml', 'src/a.ts'])
    expect(result.ignoredScanDirectories).toEqual([sdk])
  })

  test('gathers an app directory that sits inside the only scan directory, with ../ paths', async () => {
    const monorepo = await makeRepository({
      'app/shopify.app.toml': appConfiguration,
      'app/src/a.ts': 'export const a = true',
      'backend/server.ts': 'export const server = true',
    })

    const result = await gather({appDirectory: join(monorepo, 'app'), scanDirectories: [monorepo]})

    expect(result.paths).toEqual(['../backend/server.ts', 'shopify.app.toml', 'src/a.ts'])
  })
})

describe('an excluded scan directory', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function makeAppAndDirectory(directory: string) {
    const root = await makeDirectory({
      'app/shopify.app.toml': appConfiguration,
      'app/src/a.ts': 'export const a = true',
      [`${directory}/shopify.app.toml`]: 'name = "Other"\n',
      [`${directory}/server.ts`]: 'export const server = true',
    })
    return {root, app: join(root, 'app'), directory: join(root, directory)}
  }

  test('gathers nothing from a scan directory that --exclude matches', async () => {
    const {app, directory} = await makeAppAndDirectory('backend')
    vi.stubEnv('INIT_CWD', app)

    const result = await gather({appDirectory: app, scanDirectories: [app, directory], excludePatterns: ['../backend']})

    expect(result.paths).toEqual(['shopify.app.toml', 'src/a.ts'])
    expect(result.otherAppDirectories).toEqual([])
  })

  test('gathers nothing from a scan directory inside an excluded directory', async () => {
    const {app, directory} = await makeAppAndDirectory('shared/sdk')
    vi.stubEnv('INIT_CWD', app)

    const result = await gather({appDirectory: app, scanDirectories: [app, directory], excludePatterns: ['../shared']})

    expect(result.paths).toEqual(['shopify.app.toml', 'src/a.ts'])
  })

  test('includes the app directory, which --exclude can match when the working directory is above it', async () => {
    const {root, app, directory} = await makeAppAndDirectory('backend')
    vi.stubEnv('INIT_CWD', root)

    const result = await gather({appDirectory: app, scanDirectories: [app, directory], excludePatterns: ['app']})

    expect(result.paths).toEqual(['../backend/server.ts', '../backend/shopify.app.toml'])
  })

  test('includes the app directory when the working directory is the app directory and --exclude names it', async () => {
    const {app, directory} = await makeAppAndDirectory('backend')
    vi.stubEnv('INIT_CWD', app)

    const fromDot = await gather({appDirectory: app, scanDirectories: [app, directory], excludePatterns: ['.']})
    const fromParent = await gather({appDirectory: app, scanDirectories: [app, directory], excludePatterns: ['../app']})

    expect(fromDot.paths).toEqual(['../backend/server.ts', '../backend/shopify.app.toml'])
    expect(fromParent.paths).toEqual(fromDot.paths)
  })

  test('gathers none of its tracked files and gets no ignored-scan-directory warning', async () => {
    const repository = await makeRepository({
      '.gitignore': 'app/\n',
      'app/shopify.app.toml': appConfiguration,
      'app/src/a.ts': 'export const a = true',
    })
    git(repository, ['add', '-f', '.gitignore', 'app/shopify.app.toml', 'app/src/a.ts'])
    git(repository, ['commit', '-qm', 'init'])
    const app = join(repository, 'app')
    vi.stubEnv('INIT_CWD', repository)

    const excluded = await gather({appDirectory: app, scanDirectories: [app], excludePatterns: ['app']})
    const included = await gather({appDirectory: app, scanDirectories: [app]})

    expect(excluded.paths).toEqual([])
    expect(excluded.ignoredScanDirectories).toEqual([])
    expect(included.paths).toEqual(['shopify.app.toml', 'src/a.ts'])
    expect(included.ignoredScanDirectories).toEqual([app])
  })
})

describe('reading across scan directories', () => {
  test('reads a file in an include directory and reports its path relative to the app directory', async () => {
    const app = await makeRepository({'shopify.app.toml': appConfiguration})
    const library = await makeRepository({'.env': `SHOPIFY_API_SECRET=${secret}\n`})

    const result = await scanAll({appDirectory: app, scanDirectories: [app, library]})

    const issue = result.issues.find((candidate) => candidate.id === 'COMMITTED_SECRET')
    expect(issue?.location.file).toBe(`../${basename(library)}/.env`)
    expect(result.scan.files_skipped_count).toBe(0)
  })

  test('lists a symbolic link in an include directory at its own location and refuses one that leaves it', async () => {
    const app = await makeRepository({'shopify.app.toml': appConfiguration})
    const library = await makeDirectory({'index.ts': 'export const library = true'})
    const outside = await makeDirectory({'leak.ts': 'export const leaked = true'})
    await symlink(join(outside, 'leak.ts'), join(library, 'link.ts'))
    const libraryName = basename(library)

    const gathered = await gather({appDirectory: app, scanDirectories: [app, library]})
    expect(gathered.paths).toEqual([`../${libraryName}/index.ts`, `../${libraryName}/link.ts`, 'shopify.app.toml'])

    const result = await scanAll({appDirectory: app, scanDirectories: [app, library]})
    expect(result.scan.files_skipped).toContainEqual(
      expect.objectContaining({
        path: `../${libraryName}/link.ts`,
        reason: 'unreadable',
        detail: `../${libraryName}/link.ts resolves outside the scan directory`,
      }),
    )
    expect(JSON.stringify(result)).not.toContain(outside)
  })

  test('refuses a symbolic link into another scan directory, since the boundary is the directory containing it', async () => {
    const app = await makeRepository({'shopify.app.toml': appConfiguration, 'src/a.ts': 'export const a = true'})
    const library = await makeDirectory({'index.ts': 'export const library = true'})
    await symlink(join(app, 'src', 'a.ts'), join(library, 'to-app.ts'))
    const libraryName = basename(library)

    const result = await scanAll({appDirectory: app, scanDirectories: [app, library]})

    expect(result.scan.files_skipped).toContainEqual(
      expect.objectContaining({
        path: `../${libraryName}/to-app.ts`,
        detail: `../${libraryName}/to-app.ts resolves outside the scan directory`,
      }),
    )
  })

  test('gathers a symbolic-linked include directory under its real path', async () => {
    const app = await makeRepository({'shopify.app.toml': appConfiguration})
    const library = await makeDirectory({'index.ts': 'export const library = true'})
    const links = await makeDirectory()
    await symlink(library, join(links, 'alias'))

    // The resolver hands the engine real paths, so the link's name never appears.
    const result = await gather({appDirectory: app, scanDirectories: [app, await realpath(join(links, 'alias'))]})

    expect(result.paths).toEqual([`../${basename(library)}/index.ts`, 'shopify.app.toml'])
  })
})

describe('the secret scan in a second repository', () => {
  test('uses the repository that owns the file, so a tracked secret is reported as tracked', async () => {
    const app = await makeRepository({'shopify.app.toml': appConfiguration})
    commitEverything(app)
    const library = await makeRepository({'.env': `SHOPIFY_API_SECRET=${secret}\n`})
    commitEverything(library)
    const libraryName = basename(library)

    const result = await scanAll({appDirectory: app, scanDirectories: [app, library]})

    const issue = result.issues.find((candidate) => candidate.id === 'COMMITTED_SECRET')
    expect(issue).toMatchObject({
      location: {file: `../${libraryName}/.env`},
      title: 'Environment file with secrets is tracked by git',
      pattern_id: 'environment-file:tracked',
    })
    expect(issue?.message).toContain(`../${libraryName}/.env IS TRACKED BY GIT`)
  })

  test('uses the ignore rules of the repository that owns the file, not the app repository', async () => {
    const app = await makeRepository({'.gitignore': '.env\n', 'shopify.app.toml': appConfiguration})
    commitEverything(app)
    const library = await makeRepository({'.env': `SHOPIFY_API_SECRET=${secret}\n`})

    const result = await scanAll({appDirectory: app, scanDirectories: [app, library]})

    const issue = result.issues.find((candidate) => candidate.id === 'COMMITTED_SECRET')
    expect(issue).toMatchObject({
      location: {file: `../${basename(library)}/.env`},
      title: 'Environment file with secrets is not ignored by git',
    })
  })

  test('reports a secret in a library outside any repository as unconfirmed', async () => {
    const app = await makeRepository({'shopify.app.toml': appConfiguration})
    const library = await makeDirectory({'.env': `SHOPIFY_API_SECRET=${secret}\n`})

    const result = await scanAll({appDirectory: app, scanDirectories: [app, library]})

    const issue = result.issues.find((candidate) => candidate.id === 'COMMITTED_SECRET')
    expect(issue).toMatchObject({
      location: {file: `../${basename(library)}/.env`},
      title: 'Environment file with secrets could not be confirmed as ignored',
    })
  })
})
