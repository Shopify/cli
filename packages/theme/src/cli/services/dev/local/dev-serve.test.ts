import {devServe, DevServeDeps} from './dev-serve.js'
import {DevServeOptions, LocalDevServerContext} from './types.js'
import {ReloadTransport} from './reload-transport.js'
import {LocalDevServerInstance} from './server.js'
import {ThemeFileWatcher, watchThemeFiles} from './watcher.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {AbortError} from '@shopify/cli-kit/node/error'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../utilities/theme-fs.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utilities/theme-fs.js')>()
  return {
    ...actual,
    hasRequiredThemeDirectories: vi.fn(),
    mountThemeFileSystem: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/system')

const theme = buildTheme({id: 123, name: 'dev-theme', role: 'development'})!

/* Drain a handful of microtask turns so awaited (already-resolved) promises in
   devServe settle before the test pokes the wired-up collaborators. */
async function flushMicrotasks() {
  for (let turn = 0; turn < 5; turn++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve()
  }
}

function baseOptions(overrides: Partial<DevServeOptions> = {}): DevServeOptions {
  return {
    adminSession: {token: 't', storeFqdn: 'store.myshopify.com'},
    directory: 'tmp',
    store: 'store.myshopify.com',
    theme,
    open: false,
    'live-reload': 'local-hot-reload',
    ignore: [],
    only: [],
    noDelete: false,
    ...overrides,
  }
}

/* Captures the context the orchestrator builds and the lifecycle calls. */
function fakeDeps() {
  const closeServer = vi.fn(async () => {})
  const closeWatcher = vi.fn(async () => {})
  const triggerReload = vi.fn()
  let capturedCtx: LocalDevServerContext | undefined
  let onChangeSink: ((event: {type: 'change'; path: string}) => void) | undefined

  const transport: ReloadTransport = {
    handler: vi.fn() as unknown as ReloadTransport['handler'],
    triggerReload,
    clientScript: 'CLIENT',
  }
  const instance: LocalDevServerInstance = {close: closeServer}

  const deps: DevServeDeps = {
    createTransport: () => transport,
    createServer: (ctx) => {
      capturedCtx = ctx
      return {start: async () => instance}
    },
    watch: ((ctx, onChange) => {
      onChangeSink = onChange as typeof onChangeSink
      return {close: closeWatcher} as ThemeFileWatcher
    }) as typeof watchThemeFiles,
  }

  return {
    deps,
    closeServer,
    closeWatcher,
    triggerReload,
    getCtx: () => capturedCtx,
    fireChange: () => onChangeSink?.({type: 'change', path: 'a.liquid'}),
  }
}

describe('devServe', () => {
  beforeEach(() => {
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
    vi.mocked(getAvailableTCPPort).mockResolvedValue(9292)
    vi.mocked(checkPortAvailability).mockResolvedValue(true)
    /* Avoid touching the real TTY during the lifecycle wiring. */
    vi.spyOn(process.stdin, 'on').mockReturnValue(process.stdin)
    vi.spyOn(process.stdin, 'off').mockReturnValue(process.stdin)
    Object.defineProperty(process.stdin, 'isTTY', {value: false, configurable: true})
  })

  test('builds a context with the hello-world renderer and starts server + watcher', async () => {
    // Given
    const {deps, getCtx} = fakeDeps()
    const controller = new AbortController()

    // When
    const promise = devServe(baseOptions({signal: controller.signal}), deps)
    /* Trigger shutdown so the lifecycle promise resolves. */
    controller.abort()
    await promise

    // Then
    const ctx = getCtx()
    expect(ctx).toBeDefined()
    const rendered = await ctx!.renderer.render({path: '/', method: 'GET', headers: {}})
    expect(rendered.body.toLowerCase()).toContain('hello world')
    expect(rendered.body).toContain('CLIENT')
  })

  test('a watcher change triggers a full reload', async () => {
    // Given
    const {deps, triggerReload, fireChange} = fakeDeps()
    const controller = new AbortController()

    // When
    const promise = devServe(baseOptions({signal: controller.signal}), deps)
    /* Let devServe progress past server.start() and watcher wiring (all
       resolved promises in the fakes) before firing a change. */
    await flushMicrotasks()
    fireChange()
    controller.abort()
    await promise

    // Then
    expect(triggerReload).toHaveBeenCalledWith({type: 'full'})
  })

  test('aborting the signal closes the server and watcher', async () => {
    // Given
    const {deps, closeServer, closeWatcher} = fakeDeps()
    const controller = new AbortController()

    // When
    const promise = devServe(baseOptions({signal: controller.signal}), deps)
    controller.abort()
    await promise

    // Then
    expect(closeServer).toHaveBeenCalledOnce()
    expect(closeWatcher).toHaveBeenCalledOnce()
  })

  test('throws AbortError when a requested port is unavailable', async () => {
    // Given
    const {deps} = fakeDeps()
    vi.mocked(checkPortAvailability).mockResolvedValue(false)

    // When / Then
    await expect(devServe(baseOptions({port: 9999}), deps)).rejects.toThrow(AbortError)
  })
})
