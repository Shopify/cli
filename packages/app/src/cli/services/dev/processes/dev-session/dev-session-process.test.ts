import {setupDevSessionProcess, pushUpdatesForDevSession} from './dev-session-process.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../../../models/app/app.js'
import {AppEventWatcher} from '../../app-events/app-event-watcher.js'
import {buildAppURLForWeb} from '../../../../utilities/app/app-url.js'
import {
  testAppAccessConfigExtension,
  testAppLinked,
  testDeveloperPlatformClient,
  testFlowActionExtension,
  testThemeExtensions,
  testUIExtension,
  testWebhookExtensions,
} from '../../../../models/app/app.test-data.js'
import {getUploadURL} from '../../../bundle.js'
import {formData} from '@shopify/cli-kit/node/http'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import {AbortSignal, AbortController} from '@shopify/cli-kit/node/abort'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import * as outputContext from '@shopify/cli-kit/node/ui/components'
import {readdir} from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/archiver')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('../../../../utilities/app/app-url.js')
vi.mock('node-fetch')
vi.mock('../../../bundle.js')

describe('setupDevSessionProcess', () => {
  test('returns a dev session process with correct configuration', async () => {
    // Given
    const options = {
      app: {} as AppLinkedInterface,
      apiKey: 'test-api-key',
      developerPlatformClient: {} as DeveloperPlatformClient,
      storeFqdn: 'test.myshopify.com',
      url: 'https://test.dev',
      organizationId: 'org123',
      appId: 'app123',
      appWatcher: {} as AppEventWatcher,
      appPreviewURL: 'https://test.preview.url',
      appLocalProxyURL: 'https://test.local.url',
      devSessionStatusManager: new DevSessionStatusManager(),
    }

    // When
    const process = await setupDevSessionProcess(options)

    // Then
    expect(process).toEqual({
      type: 'dev-session',
      prefix: 'app-preview',
      function: pushUpdatesForDevSession,
      options: {
        app: options.app,
        apiKey: options.apiKey,
        developerPlatformClient: options.developerPlatformClient,
        storeFqdn: options.storeFqdn,
        url: options.url,
        organizationId: options.organizationId,
        appId: options.appId,
        appWatcher: options.appWatcher,
        appPreviewURL: options.appPreviewURL,
        appLocalProxyURL: options.appLocalProxyURL,
        devSessionStatusManager: options.devSessionStatusManager,
      },
    })
  })
})

describe('pushUpdatesForDevSession', () => {
  let stdout: any
  let stderr: any
  let options: any
  let developerPlatformClient: any
  let appWatcher: AppEventWatcher
  let app: AppLinkedInterface
  let abortController: AbortController
  let devSessionStatusManager: DevSessionStatusManager

  beforeEach(() => {
    vi.mocked(formData).mockReturnValue({append: vi.fn(), getHeaders: vi.fn()} as any)
    stdout = {write: vi.fn()}
    stderr = {write: vi.fn()}
    developerPlatformClient = testDeveloperPlatformClient()
    app = testAppLinked()
    appWatcher = new AppEventWatcher(app)
    abortController = new AbortController()
    devSessionStatusManager = new DevSessionStatusManager()
    options = {
      developerPlatformClient,
      appWatcher,
      storeFqdn: 'test.myshopify.com',
      appId: 'app123',
      organizationId: 'org123',
      appPreviewURL: 'https://test.preview.url',
      appLocalProxyURL: 'https://test.local.url',
      devSessionStatusManager,
    }
  })

  afterEach(() => {
    abortController.abort()
  })

  test('creates a new dev session successfully when receiving the app watcher start event', async () => {
    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()

    // Then
    expect(developerPlatformClient.devSessionCreate).toHaveBeenCalled()
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Ready'))
  })

  test('updates use the extension handle as the output prefix', async () => {
    // When

    const spyContext = vi.spyOn(outputContext, 'useConcurrentOutputContext')
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()

    const extension = await testUIExtension()
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension}]})
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated app preview on test.myshopify.com'))
    expect(spyContext).toHaveBeenCalledWith({outputPrefix: 'test-ui-extension', stripAnsi: false}, expect.anything())

    // In theory this shouldn't be necessary, but vitest doesn't restore spies automatically.
    // eslint-disable-next-line @shopify/cli/no-vi-manual-mock-clear
    vi.restoreAllMocks()
  })

  test('handles user errors from dev session creation', async () => {
    // Given
    const userErrors = [{message: 'Test error', category: 'test'}]
    developerPlatformClient.devSessionCreate = vi.fn().mockResolvedValue({devSessionCreate: {userErrors}})

    // When
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: new AbortSignal()}, options)
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error'))
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Test error'))
  })

  test('handles receiving an event before session is ready', async () => {
    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('Change detected, but app preview is not ready yet.'),
    )
    expect(developerPlatformClient.devSessionCreate).not.toHaveBeenCalled()
    expect(developerPlatformClient.devSessionUpdate).not.toHaveBeenCalled()
  })

  test('handles user errors from dev session update', async () => {
    // Given
    const userErrors = [{message: 'Update error', category: 'test'}]
    developerPlatformClient.devSessionUpdate = vi.fn().mockResolvedValue({devSessionUpdate: {userErrors}})

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error'))
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Update error'))
  })

  test('handles scope changes and displays updated message', async () => {
    // Given
    vi.mocked(buildAppURLForWeb).mockResolvedValue('https://test.myshopify.com/admin/apps/test')
    const appAccess = await testAppAccessConfigExtension()
    const event = {extensionEvents: [{type: 'updated', extension: appAccess}], app}
    const contextSpy = vi.spyOn(outputContext, 'useConcurrentOutputContext')

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', event)
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated app preview on test.myshopify.com'))
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('Access scopes auto-granted: read_products, write_products'),
    )

    expect(contextSpy).toHaveBeenCalledWith({outputPrefix: 'app-preview', stripAnsi: false}, expect.anything())
    contextSpy.mockRestore()
  })

  test('update is retried if there is an error', async () => {
    // Given
    developerPlatformClient.devSessionUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error('Test error'))
      .mockResolvedValueOnce({devSessionUpdate: {userErrors: []}})

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})
    await flushPromises()

    // Then
    expect(developerPlatformClient.refreshToken).toHaveBeenCalledOnce()
    expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledTimes(2)
  })

  test('updates preview URL when extension is previewable', async () => {
    // Given
    const extension = await testUIExtension({type: 'ui_extension'})
    const newApp = testAppLinked({allExtensions: [extension]})

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', {app: newApp, extensionEvents: [{type: 'updated', extension}]})
    await flushPromises()

    // Then
    expect(devSessionStatusManager.status.previewURL).toBe(options.appLocalProxyURL)
  })

  test('updates preview URL to appPreviewURL when no previewable extensions', async () => {
    // Given
    const extension = await testFlowActionExtension()
    const newApp = testAppLinked({allExtensions: [extension]})

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', {app: newApp, extensionEvents: [{type: 'updated', extension}]})
    await flushPromises()

    // Then
    expect(devSessionStatusManager.status.previewURL).toBe(options.appPreviewURL)
  })

  test('resets dev session status when calling resetDevSessionStatus', async () => {
    // Given
    const extension = await testUIExtension({type: 'ui_extension'})
    const newApp = testAppLinked({allExtensions: [extension]})

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', {app: newApp, extensionEvents: [{type: 'updated', extension}]})
    await flushPromises()

    // Then
    expect(devSessionStatusManager.status.isReady).toBe(true)
    expect(devSessionStatusManager.status.previewURL).toBeDefined()

    // When
    devSessionStatusManager.reset()

    // Then
    expect(devSessionStatusManager.status.isReady).toBe(false)
    expect(devSessionStatusManager.status.previewURL).toBeUndefined()
  })

  test('handles error events from the app watcher', async () => {
    // Given
    const testError = new Error('Watcher error')

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    appWatcher.emit('error', testError)
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error'))
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Watcher error'))
  })

  test('sets correct status messages during dev session lifecycle', async () => {
    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)

    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining(`Preparing app preview on ${options.storeFqdn}`))

    const statusSpy = vi.spyOn(devSessionStatusManager, 'setMessage')

    // Then - Initial loading state
    expect(devSessionStatusManager.status.statusMessage).toEqual({
      message: 'Preparing app preview',
      type: 'loading',
    })

    // When - Start the session
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()

    // Then - Ready state
    expect(statusSpy).toHaveBeenCalledWith('READY')

    // When - Emit an update event
    const extension = await testUIExtension()
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension}]})
    await flushPromises()

    // Then - Loading state during update
    expect(statusSpy).toHaveBeenCalledWith('CHANGE_DETECTED')
    // Then - Updated state after successful update
    expect(statusSpy).toHaveBeenCalledWith('UPDATED')
    statusSpy.mockRestore()
  })

  test('sets error status message on build error', async () => {
    // Given
    const extension = await testUIExtension()
    const errorEvent = {
      app,
      extensionEvents: [
        {
          type: 'updated',
          extension,
          buildResult: {status: 'error'},
        },
      ],
    }

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', errorEvent)
    await flushPromises()

    // Then
    expect(devSessionStatusManager.status.statusMessage).toEqual({
      message: 'Build error. Please review your code and try again',
      type: 'error',
    })
  })

  test('sets error status message on remote error', async () => {
    // Given
    const userErrors = [{message: 'Update error', category: 'test'}]
    developerPlatformClient.devSessionUpdate = vi.fn().mockResolvedValue({devSessionUpdate: {userErrors}})

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})
    await flushPromises()

    // Then
    expect(devSessionStatusManager.status.statusMessage).toEqual({
      message: 'Error updating app preview',
      type: 'error',
    })
  })

  test('sets validation error status message when error cause is validation-error', async () => {
    // Given
    const validationError = new Error('Validation failed')
    validationError.cause = 'validation-error'

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('error', validationError)
    await flushPromises()

    // Then
    expect(devSessionStatusManager.status.statusMessage).toEqual({
      message: 'Validation error in your app configuration',
      type: 'error',
    })
  })

  test('manifest sent in update payload only includes affected extensions', async () => {
    // Given
    vi.mocked(readdir).mockResolvedValue(['assets', 'assets/updated-extension'])
    vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

    const updatedExtension = await testUIExtension()
    updatedExtension.deployConfig = vi.fn().mockResolvedValue({})
    const unaffectedExtension = await testThemeExtensions()
    const appWithMultipleExtensions = testAppLinked({
      allExtensions: [updatedExtension, unaffectedExtension],
    })

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', {
      app: appWithMultipleExtensions,
      extensionEvents: [{type: 'updated', extension: updatedExtension}],
    })
    await flushPromises()

    // Then
    expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledWith({
      shopFqdn: 'test.myshopify.com',
      appId: 'app123',
      // Assets URL is empty because the affected extension has no assets
      assetsUrl: undefined,
      manifest: {
        name: 'App',
        handle: '',
        modules: [
          {
            uid: 'test-ui-extension-uid',
            assets: 'test-ui-extension-uid',
            handle: updatedExtension.handle,
            type: updatedExtension.externalType,
            target: updatedExtension.contextValue,
            config: {},
          },
        ],
      },
      // The unaffected extension is listed in inheritedModuleUids
      inheritedModuleUids: [unaffectedExtension.uid],
    })
  })

  test('assetsURL is only generated if affected extensions have assets', async () => {
    // Given
    vi.mocked(formData).mockReturnValue({append: vi.fn(), getHeaders: vi.fn()} as any)
    // Mock readdir to return that a folder for the extension assets exists
    vi.mocked(readdir).mockResolvedValue(['other-folders', 'ui-extension-uid'])
    vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

    const extensionWithAssets = await testUIExtension({handle: 'ui-extension-handle', uid: 'ui-extension-uid'})
    extensionWithAssets.deployConfig = vi.fn().mockResolvedValue({})
    const app = testAppLinked({allExtensions: [extensionWithAssets]})

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()
    appWatcher.emit('all', {
      app,
      extensionEvents: [{type: 'updated', extension: extensionWithAssets}],
    })
    await flushPromises()

    // Then
    expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledWith({
      shopFqdn: 'test.myshopify.com',
      appId: 'app123',
      assetsUrl: 'https://gcs.url',
      manifest: expect.any(Object),
      inheritedModuleUids: [],
    })
  })

  test('assetsURL is always generated for create, even if there are no assets', async () => {
    // Given
    vi.mocked(formData).mockReturnValue({append: vi.fn(), getHeaders: vi.fn()} as any)
    vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()

    // Then
    expect(developerPlatformClient.devSessionCreate).toHaveBeenCalledWith({
      shopFqdn: 'test.myshopify.com',
      appId: 'app123',
      assetsUrl: 'https://gcs.url',
      manifest: expect.any(Object),
      inheritedModuleUids: [],
    })
  })

  test('multiple updates to different extensions are consolidated if a request is in progress', async () => {
    vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')
    vi.mocked(readdir).mockResolvedValue([])

    const extension1 = await testUIExtension({type: 'ui_extension'})
    extension1.uid = 'ext1'
    extension1.handle = 'ext1-handle'
    extension1.deployConfig = vi.fn().mockResolvedValue({config1: 'val1'})

    const extension2 = await testWebhookExtensions()
    extension2.uid = 'ext2'
    extension2.handle = 'ext2-handle'
    extension2.deployConfig = vi.fn().mockResolvedValue({config2: 'val2'})

    app = testAppLinked({allExtensions: [extension1, extension2]})

    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await options.appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()

    // First event is processed immediat
    options.appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension1}]})

    // second and third event will be queued and processed together in a consolidated event.
    options.appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension2}]})
    options.appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension1}]})

    await flushPromises()

    expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledTimes(2)
    const calls = developerPlatformClient.devSessionUpdate.mock.calls

    // First call only has the first event
    const manifestModules = calls[0][0].manifest.modules
    expect(manifestModules).toEqual(
      expect.arrayContaining([expect.objectContaining({uid: 'ext1', config: {config1: 'val1'}})]),
    )
    expect(manifestModules.length).toBe(1)

    // Second call has the second and third event
    const manifestModules2 = calls[1][0].manifest.modules
    expect(manifestModules2).toEqual(
      expect.arrayContaining([
        expect.objectContaining({uid: 'ext1', config: {config1: 'val1'}}),
        expect.objectContaining({uid: 'ext2', config: {config2: 'val2'}}),
      ]),
    )
    expect(manifestModules2.length).toBe(2)
  })

  test('retries failed events along with newly received events', async () => {
    vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')
    vi.mocked(readdir).mockResolvedValue([])
    // Setup test extensions
    const extension1 = await testUIExtension()
    extension1.uid = 'ext1-uid'
    extension1.handle = 'ext1-handle'
    extension1.deployConfig = vi.fn().mockResolvedValue({config1: 'val1'})

    const extension2 = await testWebhookExtensions()
    extension2.uid = 'ext2-uid'
    extension2.handle = 'ext2-handle'
    extension2.deployConfig = vi.fn().mockResolvedValue({config2: 'val2'})

    app = testAppLinked({allExtensions: [extension1, extension2]})

    // Mock devSessionUpdate to fail on first call and succeed on second
    developerPlatformClient.devSessionUpdate = vi
      .fn()
      .mockResolvedValueOnce({devSessionUpdate: {userErrors: [{message: 'Simulated failure', category: 'remote'}]}})
      .mockResolvedValueOnce({devSessionUpdate: {userErrors: []}})

    // Start the dev session
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
    await appWatcher.start({stdout, stderr, signal: abortController.signal})
    await flushPromises()

    // First event (will fail)
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension1}]})
    await flushPromises()

    // Verify the update was attempted and failed
    expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledTimes(1)
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Simulated failure'))
    expect(devSessionStatusManager.status.statusMessage?.message).toBe('Error updating app preview')

    // Second event (should include retry of first failed event)
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension2}]})
    await flushPromises()

    // Verify a second update attempt was made
    expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledTimes(2)

    // Verify the second update attempt included both extensions
    const secondCallPayload = developerPlatformClient.devSessionUpdate.mock.calls[1][0]
    expect(secondCallPayload.manifest.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({uid: 'ext1-uid', handle: 'ext1-handle', config: {config1: 'val1'}}),
        expect.objectContaining({uid: 'ext2-uid', handle: 'ext2-handle', config: {config2: 'val2'}}),
      ]),
    )
    expect(secondCallPayload.manifest.modules.length).toBe(2)

    // Verify success status was set
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated app preview on test.myshopify.com'))
    expect(devSessionStatusManager.status.statusMessage?.message).toBe('Updated')
  })
})
