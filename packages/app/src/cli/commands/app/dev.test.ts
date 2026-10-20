import Dev from './dev.js'
import DevClean from './dev/clean.js'
import {devClean} from '../../services/dev-clean.js'
import {dev} from '../../services/dev.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {getTunnelMode} from '../../services/dev/tunnel-mode.js'
import {appDevJsonOutputSchema} from '../../services/dev/types.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {isInputDisabled} from '@shopify/cli-kit/node/no-input'
import {
  acquireDevInstance,
  DEV_INSTANCE_ALREADY_RUNNING_CODE,
  readDevInstance,
} from '@shopify/cli-kit/node/dev-instance'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/dev.js')
vi.mock('../../services/dev-clean.js')
vi.mock('../../services/app-context.js')
vi.mock('../../services/store-context.js')
vi.mock('../../services/dev/tunnel-mode.js')
vi.mock('../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/metadata')

describe('app dev command', () => {
  beforeEach(() => {
    vi.mocked(dev).mockReset()
    vi.mocked(linkedAppContext).mockReset()
    vi.mocked(storeContext).mockReset()
    vi.mocked(getTunnelMode).mockReset()
    vi.mocked(checkFolderIsValidApp).mockReset()
    vi.mocked(addPublicMetadata).mockReset()
  })

  function mockAppAndStore(directory: string) {
    const appContextResult = {
      app: testAppLinked({directory}),
      remoteApp: testOrganizationApp(),
      organization: testOrganization(),
      project: testProject(),
      activeConfig: {} as never,
      specifications: [],
      developerPlatformClient: testDeveloperPlatformClient(),
    } as Awaited<ReturnType<typeof linkedAppContext>>
    const store = testOrganizationStore({shopDomain: 'dev-store.myshopify.com'})

    vi.mocked(linkedAppContext).mockResolvedValue(appContextResult)
    vi.mocked(storeContext).mockResolvedValue(store)
    vi.mocked(devClean).mockResolvedValue({
      status: 'success',
      app: {name: appContextResult.remoteApp.title, clientId: appContextResult.remoteApp.apiKey},
      storeHostname: store.shopDomain,
    })

    return {store}
  }

  test('declares its streaming schema and retains inherited flags', () => {
    expect(Dev.jsonOutputSchema).toBe(appDevJsonOutputSchema)
    expect(Dev.flags.json.char).toBe('j')
    expect(Dev.flags.json.env).toBe('SHOPIFY_FLAG_JSON')
    expect(Dev.baseFlags).toHaveProperty('json-schema')
    expect(Dev.baseFlags).toHaveProperty('auth-alias')
    expect(Dev.descriptionForHelp()).toContain('AppDevEvent')
  })

  test.each([
    {timestamp: '2026-10-20T09:00:00Z', level: 'info', message: 'Starting dev'},
    {timestamp: '2026-10-20T09:00:00Z', operation: 'app-dev-preview', status: 'updated', message: 'Updated'},
  ] as const)('the stream schema accepts records without type and rejects extra type fields: %j', (entry) => {
    expect(JSON.parse(appDevJsonOutputSchema.encode(entry))).toEqual(entry)
    expect(() => appDevJsonOutputSchema.validate({...entry, type: 'diagnostic'})).toThrow()
  })

  test.each(['--json', '-j', 'env'])('%s streams shared events on stdout without a final result', async (source) => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})
      if (source === 'env') vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      vi.mocked(dev).mockImplementation(async ({devInstance}) => {
        outputInfo('Starting dev')
        emitCommandEvent({type: 'progress', operation: 'app-dev-preview', status: 'updated', message: 'Updated'})
        await devInstance?.log({source: 'web', message: 'Server ready'})
        await devInstance?.log({source: 'app dev', level: 'error', message: 'Build error'})
      })
      try {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await Dev.run(
            ['--path', tmp, '--store', store.shopDomain, ...(source.startsWith('-') ? [source] : [])],
            import.meta.url,
          )
          const events = stdout()
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
          events.forEach((event) => {
            expect(() => Dev.jsonOutputSchema.validate(event)).not.toThrow()
            expect(event).not.toHaveProperty('type')
          })
          expect(events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({level: 'info', message: 'Starting dev'}),
              expect.objectContaining({status: 'updated', operation: 'app-dev-preview', message: 'Updated'}),
              expect.objectContaining({level: 'info', message: 'web: Server ready'}),
              expect.objectContaining({level: 'error', message: 'Build error'}),
            ]),
          )
          expect(stderr()).toBe('')
        })
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })

  test.each([false, true])('JSON preserves the input policy with no-input=%s', async (noInput) => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})
      vi.stubEnv('CI', '')
      vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', noInput ? '1' : '0')
      const stdinIsTTY = process.stdin.isTTY
      const stderrIsTTY = process.stderr.isTTY
      Object.defineProperty(process.stdin, 'isTTY', {value: true, configurable: true})
      Object.defineProperty(process.stderr, 'isTTY', {value: true, configurable: true})
      vi.mocked(linkedAppContext).mockImplementation(async () => {
        expect(isInputDisabled()).toBe(noInput)
        expect(terminalSupportsPrompting()).toBe(!noInput)
        throw new AbortError('Input policy checked')
      })
      try {
        await withCapturedStandardStreams(async ({stdout}) => {
          await expect(Dev.run(['--path', tmp, '--json'], import.meta.url)).rejects.toThrow()
          expect(JSON.parse(stdout().trim().split('\n').at(-1)!)).toMatchObject({
            error: {type: 'abort', message: 'Input policy checked'},
          })
        })
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', {value: stdinIsTTY, configurable: true})
        Object.defineProperty(process.stderr, 'isTTY', {value: stderrIsTTY, configurable: true})
        vi.unstubAllEnvs()
      }
    })
  })

  test('a runtime failure ends the JSONL stream with the shared fatal error', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})
      vi.mocked(dev).mockImplementation(async () => {
        outputInfo('Starting dev')
        throw new AbortError('Tunnel stopped')
      })
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(Dev.run(['--path', tmp, '--store', store.shopDomain, '--json'], import.meta.url)).rejects.toThrow()
        expect(
          stdout()
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
            .slice(-2),
        ).toEqual([
          expect.objectContaining({level: 'info', message: 'Starting dev'}),
          {error: {type: 'abort', message: 'Tunnel stopped'}},
        ])
        expect(stderr()).toBe('')
      })
      await expect(
        readDevInstance({command: 'app dev', directory: tmp, key: 'shopify.app.toml'}),
      ).resolves.toBeUndefined()
    })
  })

  test.each([
    ['app dev', Dev, dev],
    ['app dev clean', DevClean, devClean],
  ])('%s accepts --config together with --client-id', async (_name, command, service) => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})

      await command.run(
        ['--path', tmp, '--store', store.shopDomain, '--config', 'prod', '--client-id', 'a-different-app'],
        import.meta.url,
      )

      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: tmp,
        clientId: 'a-different-app',
        forceRelink: false,
        userProvidedConfigName: 'prod',
      })
      expect(service).toHaveBeenCalled()
    })
  })

  test.each([
    ['app dev', Dev],
    ['app dev clean', DevClean],
  ])('%s still rejects --reset together with --config', async (_name, command) => {
    await inTemporaryDirectory(async (tmp) => {
      await expect(command.run(['--path', tmp, '--config', 'prod', '--reset'], import.meta.url)).rejects.toThrow()

      expect(linkedAppContext).not.toHaveBeenCalled()
      expect(dev).not.toHaveBeenCalled()
      expect(devClean).not.toHaveBeenCalled()
    })
  })

  test('does not require --use-localhost when --install-mkcert is not passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})

      await Dev.run(['--path', tmp, '--store', store.shopDomain], import.meta.url)

      expect(getTunnelMode).toHaveBeenCalledWith({
        useLocalhost: false,
        tunnelUrl: undefined,
        localhostPort: undefined,
      })
      expect(storeContext).toHaveBeenCalledWith(expect.objectContaining({storeCreationMode: 'selection-option'}))
      expect(dev).toHaveBeenCalledWith(
        expect.objectContaining({installMkcert: undefined, unsafeValidation: false, tunnel: {mode: 'auto'}}),
      )
    })
  })

  test('passes --unsafe-validation to dev', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})

      await Dev.run(['--path', tmp, '--store', store.shopDomain, '--unsafe-validation'], import.meta.url)

      expect(dev).toHaveBeenCalledWith(expect.objectContaining({unsafeValidation: true}))
    })
  })

  // `generateCertificate()` only shows the "generate it now?" prompt when `installMkcert` is nullish, so an
  // omitted --install-mkcert must stay undefined rather than being collapsed into an explicit `false`.
  test('leaves installMkcert undefined with --use-localhost so the certificate prompt is reached', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'use-localhost', requestedPort: 3458, actualPort: 3458})

      await Dev.run(['--path', tmp, '--store', store.shopDomain, '--use-localhost'], import.meta.url)

      expect(dev).toHaveBeenCalledWith(expect.objectContaining({installMkcert: undefined}))
    })
  })

  test('sets installMkcert to true when --install-mkcert is passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'use-localhost', requestedPort: 3458, actualPort: 3458})

      await Dev.run(
        ['--path', tmp, '--store', store.shopDomain, '--use-localhost', '--install-mkcert'],
        import.meta.url,
      )

      expect(dev).toHaveBeenCalledWith(expect.objectContaining({installMkcert: true}))
    })
  })

  test.each([false, true])('requires --use-localhost when --install-mkcert is passed, json=%s', async (json) => {
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout}) => {
        await expect(
          Dev.run(['--path', tmp, '--install-mkcert', ...(json ? ['--json'] : [])], import.meta.url),
        ).rejects.toThrow()
        if (json) expect(JSON.parse(stdout().trim().split('\n').at(-1)!)).toHaveProperty('error.type', 'abort')
      })

      expect(dev).not.toHaveBeenCalled()
      expect(devClean).not.toHaveBeenCalled()
    })
  })
  test('records the running instance while dev runs and releases it afterwards', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})
      const identity = {command: 'app dev', directory: tmp, key: 'shopify.app.toml'}
      let instanceWhileRunning: Awaited<ReturnType<typeof readDevInstance>>
      vi.mocked(dev).mockImplementation(async () => {
        instanceWhileRunning = await readDevInstance(identity)
      })

      await Dev.run(['--path', tmp, '--store', store.shopDomain], import.meta.url)

      expect(instanceWhileRunning).toMatchObject({command: 'app dev', key: 'shopify.app.toml', pid: process.pid})
      expect(dev).toHaveBeenCalledWith(expect.objectContaining({devInstance: expect.any(Object)}))
      await expect(readDevInstance(identity)).resolves.toBeUndefined()
    })
  })

  test.each([false, true])(
    'refuses to start when app dev is already running for the same configuration, json=%s',
    async (json) => {
      await inTemporaryDirectory(async (tmp) => {
        const {store} = mockAppAndStore(tmp)
        vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})
        const running = await acquireDevInstance({command: 'app dev', directory: tmp, key: 'shopify.app.toml'})

        // The command's error handler renders the AbortError and exits.
        await withCapturedStandardStreams(async ({stdout}) => {
          await expect(
            Dev.run(['--path', tmp, '--store', store.shopDomain, ...(json ? ['--json'] : [])], import.meta.url),
          ).rejects.toThrow()
          if (json)
            expect(JSON.parse(stdout().trim().split('\n').at(-1)!)).toMatchObject({
              error: {
                type: 'abort',
                code: DEV_INSTANCE_ALREADY_RUNNING_CODE,
                details: {instance: running.info},
              },
            })
        })
        await expect(
          acquireDevInstance({command: 'app dev', directory: tmp, key: 'shopify.app.toml'}),
        ).rejects.toMatchObject({code: DEV_INSTANCE_ALREADY_RUNNING_CODE, details: {instance: running.info}})

        expect(storeContext).not.toHaveBeenCalled()
        expect(dev).not.toHaveBeenCalled()
        await running.release()
      })
    },
  )
})
