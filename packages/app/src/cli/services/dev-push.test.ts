import {devPush} from './dev-push.js'
import {renderDevPushResult} from './dev-push/result.js'
import {LoadedAppContextOutput} from './app-context.js'
import {installAppDependencies} from './dependencies.js'
import * as bundle from './bundle.js'
import {setupDevProcesses} from './dev/processes/setup-dev-processes.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
  testUIExtension,
} from '../models/app/app.test-data.js'
import {WebType, CurrentAppConfiguration} from '../models/app/app.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../models/extensions/load-specifications.js'
import {afterEach, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, fileExists, mkdir, readFile, readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {withDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {AbortError, AbortSilentError, handler} from '@shopify/cli-kit/node/error'
import * as ui from '@shopify/cli-kit/node/ui'
import {brotliDecompressSync} from 'node:zlib'
import {Writable} from 'stream'

vi.mock('./dependencies.js')
vi.mock('./dev/processes/setup-dev-processes.js')
vi.mock('@shopify/cli-kit/node/session')

const processEvents: NodeJS.EventEmitter = process

const response = {
  devSessionCreate: {
    devSession: {websocketUrl: null, updatedAt: '2026-10-01T00:00:00Z', app: {id: 'app-id', key: 'public-client-id'}},
    warnings: [],
    userErrors: [],
  },
}

afterEach(() => {
  vi.unstubAllEnvs()
})

async function fixture(directory: string, result: unknown = response) {
  const configuration: CurrentAppConfiguration = {
    name: 'Test app',
    client_id: 'public-client-id',
    application_url: 'https://production.example.com',
    embedded: true,
    access_scopes: {scopes: 'write_products', use_legacy_install_flow: false},
    auth: {redirect_urls: ['https://production.example.com/custom/callback']},
    webhooks: {api_version: '2026-10'},
    app_proxy: {url: 'https://production.example.com/proxy', prefix: 'apps', subpath: 'test'},
  }
  const configPath = joinPath(directory, 'shopify.app.test.toml')
  const configContents = 'application_url = "https://production.example.com"\n'
  await writeFile(configPath, configContents)
  const specifications = await loadLocalExtensionsSpecifications()
  const modules = ['app_home', 'app_access', 'app_proxy'].map(
    (identifier) =>
      new ExtensionInstance({
        configuration: structuredClone(configuration) as never,
        configurationPath: configPath,
        directory,
        specification: specifications.find((specification) => specification.identifier === identifier)!,
      }),
  )
  const app = testAppLinked({
    directory,
    configPath,
    configuration,
    allExtensions: modules,
    webs: [
      {
        directory,
        configuration: {
          roles: [WebType.Backend],
          commands: {dev: 'must-not-run', build: 'must-not-run'},
          auth_callback_path: ['/oauth/callback', '/oauth/complete'],
        },
      },
    ],
  })
  const client = testDeveloperPlatformClient({
    bundleFormat: 'br',
    devSessionCreate: vi.fn().mockResolvedValue(result),
    devSessionDelete: vi.fn(),
    deploy: vi.fn(),
    release: vi.fn(),
    generateSignedUploadUrl: vi
      .fn()
      .mockResolvedValue({assetUrl: 'https://uploads.example.com/signed', userErrors: []}),
  })
  const uploaded = {path: '', tar: ''}
  vi.spyOn(bundle, 'uploadToGCS').mockImplementation(async (_url, path) => {
    uploaded.path = path
    uploaded.tar = brotliDecompressSync(readFileSync(path)).toString('utf8')
  })
  const appContextResult: LoadedAppContextOutput = {
    app,
    project: testProject({directory, usesWorkspaces: true}),
    remoteApp: testOrganizationApp({id: 'app-id', title: 'Test app', apiKey: 'public-client-id'}),
    organization: testOrganization(),
    developerPlatformClient: client,
    specifications: [],
    activeConfig: {} as never,
  }
  return {
    input: {appContextResult, store: testOrganizationStore({shopDomain: 'test-store.myshopify.com'})},
    app,
    client,
    uploaded,
    configContents,
  }
}

test('uploads even a config-only snapshot without a websocket, user Admin authentication, or local servers', async () => {
  vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'service-account-token')
  vi.mocked(ensureAuthenticatedAdmin).mockRejectedValue(new Error('A user session must not be requested'))
  await inTemporaryDirectory(async (directory) => {
    const {input, app, client, uploaded, configContents} = await fixture(directory)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const result = await devPush(input)
        expect(stdout()).toBe('')
        renderDevPushResult(result, 'json')
      })
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        app: {name: 'Test app', clientId: 'public-client-id'},
        storeDomain: 'test-store.myshopify.com',
        appUrl: 'https://production.example.com',
        previewUrl: 'https://admin.shopify.com/store/test-store/apps/public-client-id',
        warnings: [],
      })
      for (const line of stderr().trim().split('\n').filter(Boolean)) expect(() => JSON.parse(line)).not.toThrow()
    })
    expect(uploaded.tar).toContain('manifest.json')
    expect(uploaded.tar).toContain('https://production.example.com')
    expect(client.devSessionCreate).toHaveBeenCalledExactlyOnceWith({
      appId: 'app-id',
      shopFqdn: 'test-store.myshopify.com',
      assetsUrl: 'https://uploads.example.com/signed',
      signal: expect.any(AbortSignal),
    })
    expect(client.deploy).not.toHaveBeenCalled()
    expect(client.release).not.toHaveBeenCalled()
    expect(client.devSessionDelete).not.toHaveBeenCalled()
    expect(setupDevProcesses).not.toHaveBeenCalled()
    expect(ensureAuthenticatedAdmin).not.toHaveBeenCalled()
    expect(installAppDependencies).not.toHaveBeenCalled()
    await expect(fileExists(dirname(uploaded.path))).resolves.toBe(false)
    await expect(readFile(app.configPath)).resolves.toBe(configContents)
  })
})

test('reuses dev URL rewriting in the uploaded manifest without rewriting TOML', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, app, uploaded, configContents} = await fixture(directory)
    await devPush({...input, url: 'https://preview.example.com'})
    expect(app.configuration.application_url).toBe('https://preview.example.com')
    expect(app.configuration.auth?.redirect_urls).toEqual([
      'https://preview.example.com/oauth/callback',
      'https://preview.example.com/oauth/complete',
    ])
    expect(app.configuration.app_proxy?.url).toBe('https://preview.example.com/proxy')
    expect(uploaded.tar).toContain('https://preview.example.com/oauth/callback')
    expect(uploaded.tar).toContain('https://preview.example.com/proxy')
    expect(uploaded.tar).not.toContain('https://production.example.com')
    await expect(readFile(app.configPath)).resolves.toBe(configContents)
  })
})

test('uses the existing default callback paths when the web configuration has no override', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, app} = await fixture(directory)
    app.webs = []
    await devPush({...input, url: 'https://preview.example.com'})
    expect(app.configuration.auth?.redirect_urls).toEqual([
      'https://preview.example.com/auth/callback',
      'https://preview.example.com/auth/shopify/callback',
      'https://preview.example.com/api/auth/callback',
    ])
  })
})

test('matches app dev by not running deploy-only validation', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, app, client} = await fixture(directory)
    const preDeployValidation = vi.spyOn(app, 'preDeployValidation').mockRejectedValue(new AbortError('Deploy only'))

    await expect(devPush(input)).resolves.toMatchObject({status: 'success'})

    expect(preDeployValidation).not.toHaveBeenCalled()
    expect(client.devSessionCreate).toHaveBeenCalledOnce()
  })
})

test.each([
  {skipDependenciesInstallation: false, installs: true},
  {skipDependenciesInstallation: true, installs: false},
])('installs dependencies outside workspaces unless skipped: %o', async ({skipDependenciesInstallation, installs}) => {
  await inTemporaryDirectory(async (directory) => {
    const {input} = await fixture(directory)
    const project = testProject({directory, usesWorkspaces: false})

    await devPush({...input, appContextResult: {...input.appContextResult, project}, skipDependenciesInstallation})

    if (installs) expect(installAppDependencies).toHaveBeenCalledWith(project, {signal: expect.any(AbortSignal)})
    else expect(installAppDependencies).not.toHaveBeenCalled()
  })
})

test('builds extension assets once into the uploaded snapshot', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, app, uploaded} = await fixture(directory)
    const extension = await testUIExtension({type: 'web_pixel_extension', directory: joinPath(directory, 'extension')})
    const build = vi.spyOn(extension, 'buildForBundle').mockImplementation(async (options, bundleDirectory) => {
      expect(options.environment).toBe('development')
      expect(options.appURL).toBe('https://preview.example.com')
      await mkdir(joinPath(bundleDirectory, extension.uid))
      await writeFile(joinPath(bundleDirectory, extension.uid, 'index.js'), 'snapshot-assets')
    })
    app.realExtensions.push(extension)
    await devPush({...input, url: 'https://preview.example.com'})
    expect(build).toHaveBeenCalledOnce()
    expect(uploaded.tar).toContain('snapshot-assets')
    await expect(fileExists(dirname(uploaded.path))).resolves.toBe(false)
  })
})

test.each([new AbortError('Build failed'), new AbortSilentError()])(
  'does not upload or create a preview after a failed or interrupted build',
  async (failure) => {
    await inTemporaryDirectory(async (directory) => {
      const {input, app, client} = await fixture(directory)
      let buildDirectory = ''
      vi.spyOn(app.realExtensions[0]!, 'buildForBundle').mockImplementation(async (_options, directory) => {
        buildDirectory = directory
        throw failure
      })
      await expect(devPush(input)).rejects.toBe(failure)
      expect(client.generateSignedUploadUrl).not.toHaveBeenCalled()
      expect(client.devSessionCreate).not.toHaveBeenCalled()
      await expect(fileExists(buildDirectory)).resolves.toBe(false)
    })
  },
)

test('does not create a preview when uploading the bundle fails', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, client} = await fixture(directory)
    vi.mocked(bundle.uploadToGCS).mockRejectedValueOnce(new AbortError('Upload failed'))
    await expect(devPush(input)).rejects.toThrow('Upload failed')
    expect(client.devSessionCreate).not.toHaveBeenCalled()
  })
})

test('retains upstream validation errors without deleting any preview', async () => {
  await inTemporaryDirectory(async (directory) => {
    const userErrors = [{message: 'Invalid configuration', field: ['application_url'], category: 'validation', on: {}}]
    const {input, client} = await fixture(directory, {devSessionCreate: {userErrors}})
    await expect(devPush(input)).rejects.toMatchObject({
      message: 'Failed to create the dev preview: Invalid configuration',
      details: {userErrors},
    })
    expect(client.devSessionDelete).not.toHaveBeenCalled()
  })
})

test.each([null, {}, {devSessionCreate: {}}, {devSessionCreate: {userErrors: [{message: null}]}}])(
  'rejects malformed preview responses: %j',
  async (result) => {
    await inTemporaryDirectory(async (directory) => {
      const {input} = await fixture(directory, result)
      await expect(devPush(input)).rejects.toThrow('server returned an invalid response')
    })
  },
)

test('requires a created dev session before reporting success', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input} = await fixture(directory, {devSessionCreate: {userErrors: [], devSession: null}})
    await expect(devPush(input)).rejects.toThrow('server returned no dev session')
  })
})

test('reports server warnings in one successful JSON result without GraphQL metadata', async () => {
  await inTemporaryDirectory(async (directory) => {
    const warnings = [
      {code: 'SESSION_TAKEOVER', message: 'Another preview was replaced', __typename: 'DevSessionWarning'},
    ]
    const {input} = await fixture(directory, {devSessionCreate: {...response.devSessionCreate, warnings}})
    await withCapturedStandardStreams(async ({stdout}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        renderDevPushResult(await devPush(input), 'json')
      })
      expect(JSON.parse(stdout()).warnings).toEqual([
        {code: 'SESSION_TAKEOVER', message: 'Another preview was replaced'},
      ])
    })
  })
})

test('refuses a locally running app dev session before building or mutating the remote preview', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, client} = await fixture(directory)
    await withDevInstance({command: 'app dev', directory, key: 'shopify.app.test.toml'}, async () => {
      await expect(devPush(input)).rejects.toThrow('already has a running dev session')
      expect(client.generateSignedUploadUrl).not.toHaveBeenCalled()
      expect(client.devSessionCreate).not.toHaveBeenCalled()
      expect(client.devSessionDelete).not.toHaveBeenCalled()
    })
  })
})

test('SIGINT aborts a build, waits for it, cleans its bundle, and emits a fatal JSON result', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, app, client} = await fixture(directory)
    let buildDirectory = ''
    let builderStopped = false
    const listeners = process.listenerCount('shopify:signal')
    vi.spyOn(app.realExtensions[0]!, 'buildForBundle').mockImplementation(async ({signal}, directory) => {
      buildDirectory = directory
      const stopped = new Promise<void>((resolve) => signal!.addEventListener('abort', () => resolve(), {once: true}))
      expect(processEvents.emit('shopify:signal', 'SIGINT')).toBe(true)
      await stopped
      await expect(fileExists(directory)).resolves.toBe(true)
      builderStopped = true
      signal!.throwIfAborted()
    })
    await withCapturedStandardStreams(async ({stdout}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        await devPush(input).catch(async (error: unknown) => {
          expect(error).toMatchObject({code: 'dev_push_cancelled', oclif: {exit: 130}})
          await handler(error)
        })
      })
      expect(JSON.parse(stdout())).toEqual({
        error: {type: 'abort', code: 'dev_push_cancelled', message: 'Dev preview push cancelled.'},
      })
    })
    expect(builderStopped).toBe(true)
    await expect(fileExists(buildDirectory)).resolves.toBe(false)
    expect(client.generateSignedUploadUrl).not.toHaveBeenCalled()
    expect(client.devSessionCreate).not.toHaveBeenCalled()
    expect(process.listenerCount('shopify:signal')).toBe(listeners)
  })
})

test('SIGTERM during dependency installation stops the installer before building or uploading', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, app, client} = await fixture(directory)
    input.appContextResult.project = testProject({directory, usesWorkspaces: false})
    const build = vi.spyOn(app.realExtensions[0]!, 'buildForBundle')
    let installerStopped = false
    vi.mocked(installAppDependencies).mockImplementation(async (_project, {signal} = {}) => {
      const stopped = new Promise<void>((resolve) => signal!.addEventListener('abort', () => resolve(), {once: true}))
      expect(processEvents.emit('shopify:signal', 'SIGTERM')).toBe(true)
      await stopped
      installerStopped = true
    })

    await expect(devPush(input)).rejects.toMatchObject({code: 'dev_push_cancelled', oclif: {exit: 143}})

    expect(installerStopped).toBe(true)
    expect(build).not.toHaveBeenCalled()
    expect(client.generateSignedUploadUrl).not.toHaveBeenCalled()
    expect(client.devSessionCreate).not.toHaveBeenCalled()
  })
})

test('SIGTERM during signed-URL acquisition prevents upload and creation', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, client} = await fixture(directory)
    const listeners = process.listenerCount('shopify:signal')
    vi.mocked(client.generateSignedUploadUrl).mockImplementation(async () => {
      expect(processEvents.emit('shopify:signal', 'SIGTERM')).toBe(true)
      return {assetUrl: 'https://uploads.example.com/signed', userErrors: []}
    })
    await expect(devPush(input)).rejects.toMatchObject({code: 'dev_push_cancelled', oclif: {exit: 143}})
    expect(bundle.uploadToGCS).not.toHaveBeenCalled()
    expect(client.devSessionCreate).not.toHaveBeenCalled()
    expect(process.listenerCount('shopify:signal')).toBe(listeners)
  })
})

test('SIGINT cancels an upload before creation and releases its temporary files', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, client} = await fixture(directory)
    let bundlePath = ''
    vi.mocked(bundle.uploadToGCS).mockImplementation(async (_url, path, signal) => {
      bundlePath = path
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(processEvents.emit('shopify:signal', 'SIGINT')).toBe(true)
      signal!.throwIfAborted()
    })
    await expect(devPush(input)).rejects.toMatchObject({code: 'dev_push_cancelled', oclif: {exit: 130}})
    await expect(fileExists(dirname(bundlePath))).resolves.toBe(false)
    expect(client.devSessionCreate).not.toHaveBeenCalled()
  })
})

test('cancellation of an in-flight creation reports the uncertain remote outcome without deleting it', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, client, uploaded} = await fixture(directory)
    vi.mocked(client.devSessionCreate).mockImplementation(async ({signal}) => {
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(processEvents.emit('shopify:signal', 'SIGINT')).toBe(true)
      signal!.throwIfAborted()
      return response
    })
    await expect(devPush(input)).rejects.toMatchObject({
      message: 'Dev preview push cancelled. The preview may already have been updated.',
      code: 'dev_push_cancelled',
      oclif: {exit: 130},
    })
    expect(client.devSessionDelete).not.toHaveBeenCalled()
    await expect(fileExists(dirname(uploaded.path))).resolves.toBe(false)
  })
})

test('waits for an owned build when the terminal UI closes before it finishes', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {input, app, client} = await fixture(directory)
    let buildDirectory = ''
    let builderStopped = false
    vi.spyOn(app.realExtensions[0]!, 'buildForBundle').mockImplementation(async ({signal}, directory) => {
      buildDirectory = directory
      await new Promise<void>((resolve) => signal!.addEventListener('abort', () => resolve(), {once: true}))
      await expect(fileExists(directory)).resolves.toBe(true)
      builderStopped = true
    })
    vi.spyOn(ui, 'renderConcurrent').mockImplementation(async ({processes, abortSignal}) => {
      const output = new Writable({write: (_chunk, _encoding, next) => next()})
      // The runner closes early, but devPush still owns and awaits this promise.
      processes[0]!.action(output, output, abortSignal!).catch(() => {})
      output.end()
    })
    await expect(devPush(input)).rejects.toMatchObject({code: 'dev_push_cancelled', oclif: {exit: 130}})
    expect(builderStopped).toBe(true)
    await expect(fileExists(buildDirectory)).resolves.toBe(false)
    expect(client.devSessionCreate).not.toHaveBeenCalled()
  })
})
