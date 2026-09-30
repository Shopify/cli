import {reserveFilesystem} from './filesystem.js'
import {runInBash} from './process.js'
import {seedStoredState} from './state.js'
import {test as baseTest, inject} from 'vitest'
import {mkdtemp, mkdir, readFile, readdir, readlink, realpath, rm, writeFile, chmod} from 'node:fs/promises'
import {tmpdir} from 'node:os'
// Native paths keep the worker independent of CLI singleton state.
// eslint-disable-next-line no-restricted-imports
import {basename, dirname, isAbsolute, join, relative, resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import type {StoredState} from './state.js'
import type {TerminalOptions} from './process.js'
import type {CommandEvent, CommandState, RequestFixture, SubprocessFixture} from './protocol.js'

export const now = Date.parse('2029-12-01T00:00:00Z')
export const clientId = 'synthetic-client-id'
export const appManagementUrl = 'https://app.shopify.com/app_management/unstable/graphql.json'
export const businessPlatformUrl = 'https://destinations.shopifysvc.com/destinations/api/2020-07/graphql'
export const appAudience = '7ee65a63608843c577db8b23c4d7316ea0a01bd2f7594f8a9c06ea668c1b775c'
export const businessAudience = '32ff8ee5-82b8-4d93-9f8a-c6997cefb7dc'

async function compactV8Coverage(directory: string, scopePath?: string) {
  const scopeFiles = scopePath
    ? new Set(
        (JSON.parse(await readFile(scopePath, 'utf8')) as {files: string[]}).files.map((path) =>
          resolve(fileURLToPath(new URL('../../', import.meta.url)), path),
        ),
      )
    : undefined

  const coverageFiles = (await readdir(directory, {withFileTypes: true})).filter(
    (entry) => entry.isFile() && /^coverage-.*\.json$/.test(entry.name),
  )
  await Promise.all(
    coverageFiles.map(async (entry) => {
      const path = join(directory, entry.name)
      const report = JSON.parse(await readFile(path, 'utf8')) as {
        result: {url: string}[]
        'source-map-cache'?: Record<string, {data?: {sources?: string[]}}>
      }
      const sourceMapCache = report['source-map-cache'] ?? {}
      report.result = report.result.filter(({url}) => {
        if (!url.startsWith('file:')) return false
        const generatedPath = fileURLToPath(url)
        if (scopeFiles) {
          const sources = sourceMapCache[url]?.data?.sources ?? []
          return sources.some((source) => source.startsWith('file:') && scopeFiles.has(fileURLToPath(source)))
        }
        return generatedPath.includes(`${sep}packages${sep}cli${sep}dist${sep}`)
      })
      delete report['source-map-cache']
      await writeFile(path, JSON.stringify(report))
    }),
  )
}

export function specification(identifier: string, experience = 'configuration', jsonSchema?: object) {
  return {
    identifier,
    externalIdentifier: identifier,
    name: identifier,
    experience,
    features: [],
    uidStrategy: {
      __typename: experience === 'configuration' ? 'UidStrategiesStatic' : 'UidStrategiesClientProvided',
      appModuleLimit: 50,
      isClientProvided: experience !== 'configuration',
    },
    validationSchema: jsonSchema ? {jsonSchema: JSON.stringify(jsonSchema)} : null,
  }
}
function session() {
  const expiresAt = '2031-01-01T00:00:00Z'
  return {
    identity: {
      accessToken: 'synthetic-identity-token',
      refreshToken: 'synthetic-refresh-token',
      expiresAt,
      userId: 'synthetic-user',
      alias: 'fixture',
      scopes: [
        'openid',
        ...[
          'shop.admin.graphql',
          'shop.admin.themes',
          'partners.collaborator-relationships.readonly',
          'shop.storefront-renderer.devtools',
          'partners.app.cli.access',
          'destinations.readonly',
          'organization.store-management',
          'organization.on-demand-user-access',
          'organization.apps.manage',
        ].map((scope) => `https://api.shopify.com/auth/${scope}`),
      ],
    },
    applications: {
      [appAudience]: {
        accessToken: 'synthetic-app-token',
        expiresAt,
        scopes: ['https://api.shopify.com/auth/organization.apps.manage'],
      },
      [businessAudience]: {
        accessToken: 'synthetic-business-token',
        expiresAt,
        scopes: ['https://api.shopify.com/auth/destinations.readonly'],
      },
    },
  }
}
function resolveStorePath(root: string, store: string) {
  const name = `${store}-nodejs`
  if (process.platform === 'darwin') return join(root, 'home/Library/Preferences', name, 'config.json')
  if (process.platform === 'win32') return join(root, 'appdata', name, 'Config/config.json')
  return join(root, 'config', name, 'config.json')
}
interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  events: CommandEvent[]
  requests: CommandEvent[]
  before: Record<string, string>
  after: Record<string, string>
  rootBefore: Record<string, string>
  rootAfter: Record<string, string>
  terminalOutput: string
  answeredPrompts: string[]
  timedOut: boolean
  terminatedAfterStdout: boolean
}

interface RuntimeConfiguration {
  environment?: Record<string, string | undefined>
  cwd?: string
  clock?: 'frozen' | 'advancing'
  requestLimit?: number
  loopbackPorts?: number[]
}

type NetworkOverride = {operation: string} & Partial<Omit<RequestFixture, 'method' | 'url' | 'operation'>>

export class CommandFixture {
  readonly projectPath: string

  readonly user = session()

  readonly remote = {
    app: {
      id: 'gid://shopify/App/456',
      key: clientId,
      organizationId: '123',
      activeRoot: {grantedShopifyApprovalScopes: [], clientCredentials: {secrets: [{key: 'synthetic-app-secret'}]}},
      activeRelease: {
        id: 'gid://shopify/AppRelease/789',
        version: {
          name: 'Remote fixture',
          appModules: [] as {
            uuid: string
            userIdentifier: string
            handle: string
            config: Record<string, unknown>
            specification: {
              identifier: string
              externalIdentifier: string
              name: string
              experience: string
              managementExperience: string
            }
          }[],
        },
      },
    },
    specifications: ['branding', 'app_home', 'app_access'].map((id) => specification(id)),
  }

  readonly networkMocks: RequestFixture[]

  environment: Record<string, string | undefined> = {}

  subprocesses: SubprocessFixture[] = []

  clock: 'frozen' | 'advancing' | undefined

  requestLimit = 24

  loopbackPorts: number[] = []

  private readonly kitStorePath: string

  private readonly appStorePath: string

  private invocations = 0

  private reservedName?: string
  private reservationAttempted = false

  private runtimeCwd?: string
  private checkSourceUnchanged?: () => Promise<void>

  constructor(readonly root: string) {
    this.projectPath = join(root, 'project')
    this.kitStorePath = resolveStorePath(root, 'shopify-cli-kit')
    this.appStorePath = resolveStorePath(root, 'shopify-cli-app')
    this.networkMocks = [
      {
        method: 'POST',
        url: businessPlatformUrl,
        operation: 'UserInfo',
        variables: {},
        headers: {Authorization: 'Bearer synthetic-business-token'},
        responses: [
          {
            body: {
              data: {
                currentUserAccount: {
                  uuid: 'synthetic-user',
                  email: 'fixture@example.test',
                  organizations: {nodes: [{name: 'Fixture organization'}]},
                },
              },
            },
          },
        ],
      },
      {
        method: 'POST',
        url: appManagementUrl,
        operation: 'ActiveAppReleaseFromApiKey',
        variables: {apiKey: clientId},
        headers: {Authorization: 'Bearer synthetic-app-token'},
        responses: [{body: {data: {app: this.remote.app}}}],
      },
      {
        method: 'POST',
        url: businessPlatformUrl,
        operation: 'FindOrganization',
        variables: {organizationId: Buffer.from('gid://organization/Organization/123').toString('base64')},
        headers: {Authorization: 'Bearer synthetic-business-token'},
        responses: [{body: {data: {currentUserAccount: {organization: {id: '123', name: 'Fixture organization'}}}}}],
      },
      {
        method: 'POST',
        url: appManagementUrl,
        operation: 'fetchSpecifications',
        variables: {organizationId: 'gid://shopify/Organization/123'},
        headers: {Authorization: 'Bearer synthetic-app-token'},
        responses: [{body: {data: {specifications: this.remote.specifications}}}],
      },
    ]
  }

  async initialize() {
    await this.seedState({
      authentication: {
        currentSessionId: 'synthetic-user',
        sessions: {'accounts.shopify.com': {'synthetic-user': this.user}},
      },
      cliPreferences: {autoUpgradeEnabled: false},
      caches: {'npm-package-@shopify/cli': {value: '4.8.0', timestamp: now}},
    })
    await this.writeFileAt(this.appStorePath, '{}')
    // An unresolved fixture package must never fall through to host installations.
    await this.writeFileAt(
      join(this.root, 'node_modules/@shopify/ui-extensions/package.json'),
      JSON.stringify({name: '@shopify/ui-extensions', exports: {}}),
    )
    const shim = join(this.root, 'bin/shopify')
    await this.writeFileAt(
      shim,
      '#!/usr/bin/env bash\nexec "$CLI_TEST_NODE" --import "$CLI_TEST_PRELOAD" "$CLI_TEST_ENTRYPOINT" "$@"\n',
    )
    await chmod(shim, 0o755)
    await Promise.all(
      ['home', 'tmp', 'oclif/config', 'oclif/cache', 'oclif/data'].map((path) =>
        mkdir(join(this.root, path), {recursive: true}),
      ),
    )
  }

  async reserve(name: string) {
    if (this.reservationAttempted)
      throw new Error('Reserve one filesystem scenario per test; repeated commands reuse its temporary copy')
    this.reservationAttempted = true
    this.checkSourceUnchanged = await reserveFilesystem({
      fixturesRoot: fileURLToPath(new URL('../fixtures/app-information/', import.meta.url)),
      destination: this.root,
      name,
    })
    this.reservedName = name
  }

  async dispose() {
    try {
      await this.checkSourceUnchanged?.()
    } finally {
      await rm(this.root, {recursive: true, force: true})
    }
  }

  path(path = '') {
    this.requireReservation()
    const resolved = resolve(this.projectPath, path)
    this.requireSandboxPath(resolved)
    return resolved
  }

  async writeFile(path: string, contents: string | Uint8Array) {
    await this.writeFileAt(this.path(path), contents)
  }

  async writeFileAt(path: string, contents: string | Uint8Array) {
    this.requireSandboxPath(path)
    await mkdir(dirname(path), {recursive: true})
    await writeFile(path, contents)
  }

  async removeFile(path: string) {
    await rm(this.path(path), {recursive: true, force: true})
  }

  async readFile(path: string) {
    return readFile(this.path(path), 'utf8')
  }

  storePath(store: 'app' | 'cli-kit') {
    return store === 'app' ? this.appStorePath : this.kitStorePath
  }

  async readStore(store: 'app' | 'cli-kit'): Promise<Record<string, unknown>> {
    return JSON.parse(await readFile(this.storePath(store), 'utf8'))
  }

  async seedState(state: StoredState) {
    await seedStoredState({project: this.projectPath, app: this.appStorePath, cliKit: this.kitStorePath}, state)
  }

  configure(options: RuntimeConfiguration) {
    Object.assign(this.environment, options.environment)
    if (options.cwd !== undefined) this.runtimeCwd = options.cwd
    if (options.clock !== undefined) this.clock = options.clock
    if (options.requestLimit !== undefined) this.requestLimit = options.requestLimit
    if (options.loopbackPorts !== undefined) this.loopbackPorts = [...options.loopbackPorts]
  }

  mockNetwork(...mocks: (RequestFixture | NetworkOverride)[]) {
    for (const mock of mocks) {
      if ('url' in mock) {
        const duplicate = this.networkMocks.some(
          (existing) =>
            existing.method === mock.method &&
            existing.url === mock.url &&
            existing.operation === mock.operation &&
            isDeepStrictEqual(existing.variables, mock.variables) &&
            isDeepStrictEqual(existing.form, mock.form) &&
            isDeepStrictEqual(existing.headers, mock.headers),
        )
        if (duplicate) throw new Error(`Duplicate network matcher: ${mock.method} ${mock.url}`)
        this.networkMocks.push(mock)
      } else {
        // Operation-only setup is an explicit override of one existing GraphQL mock.
        const matches = this.networkMocks.filter((request) => request.operation === mock.operation)
        if (matches.length !== 1) throw new Error(`Expected one existing network mock for ${mock.operation}`)
        Object.assign(matches[0]!, mock)
      }
    }
  }

  mockSubprocess(...mocks: SubprocessFixture[]) {
    this.subprocesses.push(...mocks)
  }

  mockTokenExchange(audience: string, token: string) {
    this.mockNetwork({
      method: 'POST',
      url: 'https://accounts.shopify.com/oauth/token',
      form: {grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange', audience},
      responses: [{body: {access_token: token, expires_in: 3600, scope: this.user.identity.scopes.join(' ')}}],
    })
  }

  async snapshot(root = this.projectPath) {
    const files: Record<string, string> = {}
    const walk = async (directory: string): Promise<void> => {
      const entries = await readdir(directory, {withFileTypes: true})
      await Promise.all(
        entries.map(async (entry) => {
          if (directory === this.root && ['state.json', 'trace.jsonl', 'bin', 'node_modules'].includes(entry.name))
            return
          const path = join(directory, entry.name)
          const key = relative(root, path).split(sep).join('/')
          if (entry.isDirectory()) await walk(path)
          else if (entry.isFile()) files[key] = (await readFile(path)).toString('base64')
          else if (entry.isSymbolicLink()) files[key] = `symlink:${await readlink(path)}`
        }),
      )
    }
    await walk(root)
    return files
  }

  async runShopifyCommand(
    argv: string[],
    options: {
      cwd?: string
      stdin?: string
      timeoutMs?: number
      terminal?: TerminalOptions
      allowTimeout?: boolean
      terminateAfterStdout?: (stdout: string) => boolean
    } = {},
  ): Promise<CommandResult> {
    this.requireReservation()
    const coverageRoot = process.env.SHOPIFY_TEST_COVERAGE_DIR
    const coverageDirectory = coverageRoot
      ? resolve(coverageRoot, basename(this.root), String(this.invocations++))
      : undefined
    if (coverageDirectory) await mkdir(coverageDirectory, {recursive: true})
    const state: CommandState = {
      now,
      requests: this.networkMocks,
      requestLimit: this.requestLimit,
      clock: this.clock ?? (options.terminal ? 'advancing' : 'frozen'),
      subprocesses: [...this.subprocesses],
      loopbackPorts: this.loopbackPorts,
    }
    if (options.terminal) {
      // The interactive notification worker is a scripted child, not a real fetcher.
      state.subprocesses.push({
        command: process.execPath,
        args: [inject('cliEntrypoint'), 'notifications', 'list', '--ignore-errors'],
      })
    }
    const statePath = join(this.root, 'state.json')
    const tracePath = join(this.root, 'trace.jsonl')
    await writeFile(statePath, JSON.stringify(state))
    await writeFile(tracePath, '')
    const before = await this.snapshot()
    const rootBefore = await this.snapshot(this.root)
    const env: Record<string, string | undefined> = {
      HOME: join(this.root, 'home'),
      USERPROFILE: join(this.root, 'home'),
      APPDATA: join(this.root, 'appdata'),
      LOCALAPPDATA: join(this.root, 'localappdata'),
      XDG_CONFIG_HOME: join(this.root, 'config'),
      XDG_CACHE_HOME: join(this.root, 'cache'),
      XDG_DATA_HOME: join(this.root, 'data'),
      XDG_STATE_HOME: join(this.root, 'state'),
      TMPDIR: join(this.root, 'tmp'),
      TMP: join(this.root, 'tmp'),
      TEMP: join(this.root, 'tmp'),
      SHOPIFY_CONFIG_DIR: join(this.root, 'oclif/config'),
      SHOPIFY_CACHE_DIR: join(this.root, 'oclif/cache'),
      SHOPIFY_DATA_DIR: join(this.root, 'oclif/data'),
      PATH: [join(this.root, 'bin'), dirname(process.execPath), '/usr/bin', '/bin'].join(
        process.platform === 'win32' ? ';' : ':',
      ),
      SystemRoot: process.env.SystemRoot,
      SHELL: '/bin/bash',
      CI: options.terminal ? undefined : '1',
      TERM: options.terminal ? 'xterm-256color' : 'dumb',
      FORCE_COLOR: '0',
      FORCE_HYPERLINK: '0',
      SHOPIFY_CLI_COLUMNS: '160',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      TZ: 'UTC',
      NODE_ENV: 'production',
      NODE_DISABLE_COMPILE_CACHE: '1',
      NODE_V8_COVERAGE: coverageDirectory,
      // DEBUG='' enables every MSW logger; keep harness diagnostics out of CLI streams.
      LOG_LEVEL: 'silent',
      SHOPIFY_CLI_NO_ANALYTICS: '1',
      OPT_OUT_INSTRUMENTATION: '1',
      OCLIF_DISABLE_RC: '1',
      SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY: '1',
      SHOPIFY_CLI_MAX_REQUEST_TIME_FOR_NETWORK_CALLS: '1000',
      ...this.environment,
      CLI_TEST_SUBPROCESS: inject('subprocessStub'),
      CLI_TEST_STATE: statePath,
      CLI_TEST_TRACE: tracePath,
      CLI_TEST_NODE: process.execPath,
      CLI_TEST_PRELOAD: inject('commandPreload'),
      CLI_TEST_ENTRYPOINT: inject('cliEntrypoint'),
    }
    // Arguments never become shell source. This really runs `shopify app info` in
    // bash, through bin/run.js and all normal Oclif/bootstrap/lifecycle code.
    const execution = await runInBash({
      env,
      argv,
      cwd: options.cwd ?? this.runtimeCwd ?? this.projectPath,
      timeoutMs: options.timeoutMs ?? 12000,
      terminal: options.terminal,
      stdin: options.stdin,
      terminateAfterStdout: options.terminateAfterStdout,
    })
    if (coverageDirectory) await compactV8Coverage(coverageDirectory, process.env.SHOPIFY_TEST_COVERAGE_SCOPE)
    const events: CommandEvent[] = (await readFile(tracePath, 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    const diagnostics = execution.stderr + execution.terminalOutput
    if (execution.signal && !execution.timedOut && !execution.terminatedAfterStdout)
      throw new Error(`CLI terminated by ${execution.signal}.\n${diagnostics}`)
    if (execution.timedOut && !options.allowTimeout) throw new Error(`Command exceeded its deadline.\n${diagnostics}`)
    if (!events.some((event) => event.type === 'ready'))
      throw new Error(`Command interceptor did not start.\n${diagnostics}`)
    const violations = events.filter((event) => event.type === 'violation')
    if (violations.length) throw new Error(`Forbidden command activity: ${JSON.stringify(violations)}\n${diagnostics}`)
    return {
      ...execution,
      events,
      requests: events.filter((event) => event.type === 'request'),
      before,
      after: await this.snapshot(),
      rootBefore,
      rootAfter: await this.snapshot(this.root),
    }
  }

  private requireReservation() {
    if (this.reservedName === undefined)
      throw new Error('Call fixture.reserve(name) before accessing project files or running a command')
  }

  private requireSandboxPath(path: string) {
    const offset = relative(this.root, resolve(path))
    if (isAbsolute(offset) || offset === '..' || offset.startsWith(`..${sep}`))
      throw new Error(`Fixture path escapes its temporary sandbox: ${path}`)
  }
}

export const test = baseTest.extend<{fixture: CommandFixture}>({
  fixture: async ({task}, use) => {
    const root = await realpath(await mkdtemp(join(tmpdir(), `app-info-${task.id}-`)))
    const fixture = new CommandFixture(root)
    try {
      await fixture.initialize()
      await use(fixture)
    } finally {
      await fixture.dispose()
    }
  },
})
