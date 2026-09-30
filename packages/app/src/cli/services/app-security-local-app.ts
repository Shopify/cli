import {launchWebProcess} from './dev/processes/web.js'
import {WebConfigurationSchema, WebType} from '../models/app/app.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {AbortError} from '@shopify/cli-kit/node/error'
import {globSync, readFile, fileExists} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {dirname, isSubpath, joinPath} from '@shopify/cli-kit/node/path'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import {Writable} from 'node:stream'

export interface RunningAppSecurityLocalApp {
  url: string
  stop(): Promise<void>
}

interface LocalWebConfiguration {
  directory: string
  roles: WebType[]
  port?: number
  devCommand: string
  preDevCommand?: string
}

const STARTUP_TIMEOUT_MILLISECONDS = 30_000
const STARTUP_POLL_INTERVAL_MILLISECONDS = 200
const MAX_CAPTURED_OUTPUT_CHARACTERS = 16_000
const WEB_DISCOVERY_IGNORES = ['**/node_modules/**', '**/vendor/**', '**/.git/**', '**/build/**', '**/dist/**']

export async function startAppSecurityLocalApp(options: {
  appRoot: string
  configFileName: string
  startupTimeoutMilliseconds?: number
}): Promise<RunningAppSecurityLocalApp> {
  const appConfigurationPath = joinPath(options.appRoot, options.configFileName)
  if (!(await fileExists(appConfigurationPath))) {
    throw new AbortError(`Could not start the app because ${options.configFileName} does not exist.`)
  }
  const appConfiguration = decodeToml(await readFile(appConfigurationPath)) as Record<string, unknown>
  const web = await loadBackendWebConfiguration(options.appRoot, appConfiguration)
  const port = await getAvailableTCPPort(web.port)
  const url = `http://localhost:${port}`
  const abortController = new AbortController()
  const output = new TailBuffer()
  let completed = false
  let processFailure: unknown
  let stopping = false
  const processCompletion = launchWebProcess(
    {stdout: output, stderr: output, abortSignal: abortController.signal},
    {
      port,
      apiKey: stringValue(appConfiguration.client_id) ?? 'app-security-local-client-id',
      apiSecret: process.env.SHOPIFY_API_SECRET ?? 'app-security-local-api-secret',
      hostname: url,
      backendPort: port,
      frontendServerPort: port,
      directory: web.directory,
      devCommand: web.devCommand,
      preDevCommand: web.preDevCommand,
      scopes: appScopes(appConfiguration),
      roles: web.roles,
      portFromConfig: web.port,
    },
  )
    .catch((error: unknown) => {
      if (!stopping) processFailure = error
    })
    .finally(() => {
      completed = true
    })

  try {
    await waitUntilReady({
      url,
      completed: () => completed,
      failure: () => processFailure,
      output,
      timeoutMilliseconds: options.startupTimeoutMilliseconds ?? STARTUP_TIMEOUT_MILLISECONDS,
    })
  } catch (error) {
    stopping = true
    abortController.abort()
    await processCompletion
    throw error
  }

  return {
    url,
    stop: async () => {
      if (completed) return
      stopping = true
      abortController.abort()
      await processCompletion
    },
  }
}

async function loadBackendWebConfiguration(
  appRoot: string,
  appConfiguration: Record<string, unknown>,
): Promise<LocalWebConfiguration> {
  const webDirectories = Array.isArray(appConfiguration.web_directories)
    ? appConfiguration.web_directories.filter((value): value is string => typeof value === 'string')
    : undefined
  const patterns = webDirectories?.length
    ? webDirectories.map((directory) => `${directory}/shopify.web.toml`)
    : ['**/shopify.web.toml']
  const paths = [
    ...new Set(
      patterns.flatMap((pattern) =>
        globSync(pattern, {
          cwd: appRoot,
          absolute: true,
          onlyFiles: true,
          followSymbolicLinks: false,
          ignore: WEB_DISCOVERY_IGNORES,
        }),
      ),
    ),
  ]
  const backendConfigurations: LocalWebConfiguration[] = []
  for (const path of paths.filter((path) => isSubpath(appRoot, path))) {
    // Configuration files are bounded and parsed before their commands are executed.
    // eslint-disable-next-line no-await-in-loop
    const content = decodeToml(await readFile(path))
    const parsed = WebConfigurationSchema.safeParse(content)
    if (!parsed.success) throw new AbortError(`Could not parse web configuration at ${path}.`)
    const roles = 'roles' in parsed.data ? parsed.data.roles : [parsed.data.type]
    if (!roles.includes(WebType.Backend)) continue
    backendConfigurations.push({
      directory: dirname(path),
      roles,
      port: parsed.data.port,
      devCommand: parsed.data.commands.dev,
      preDevCommand: parsed.data.commands.predev,
    })
  }

  if (backendConfigurations.length === 0) {
    throw new AbortError(
      'App Security could not find a backend web process.',
      'Add a backend role and dev command to shopify.web.toml, or pass --probe-url.',
    )
  }
  if (backendConfigurations.length > 1) {
    throw new AbortError(
      'App Security found more than one backend web process.',
      'Pass --probe-url for a separately managed app server.',
    )
  }
  return backendConfigurations[0]!
}

async function waitUntilReady(options: {
  url: string
  completed(): boolean
  failure(): unknown
  output: TailBuffer
  timeoutMilliseconds: number
}): Promise<void> {
  const deadline = Date.now() + options.timeoutMilliseconds
  while (Date.now() < deadline) {
    if (options.failure()) abortLocalAppStart(options.output, options.failure())
    if (options.completed()) abortLocalAppStart(options.output, 'The web process exited before it became ready.')
    // A response of any status proves the HTTP server is accepting requests.
    // eslint-disable-next-line no-await-in-loop
    const ready = await fetch(options.url, {redirect: 'manual'}).then(
      () => true,
      () => false,
    )
    if (ready) return
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL_MILLISECONDS))
  }
  abortLocalAppStart(options.output, `The web process did not become ready within ${options.timeoutMilliseconds}ms.`)
}

function abortLocalAppStart(output: TailBuffer, error: unknown): never {
  const detail = error instanceof Error ? error.message : String(error)
  const logs = output.contents.trim()
  throw new AbortError('App Security could not start the local app.', [detail, logs].filter(Boolean).join('\n\n'))
}

function appScopes(configuration: Record<string, unknown>): string | undefined {
  const accessScopes = configuration.access_scopes
  if (!accessScopes || typeof accessScopes !== 'object') return undefined
  return stringValue((accessScopes as Record<string, unknown>).scopes)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

class TailBuffer extends Writable {
  contents = ''

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.contents = `${this.contents}${chunk.toString()}`.slice(-MAX_CAPTURED_OUTPUT_CHARACTERS)
    callback()
  }
}
