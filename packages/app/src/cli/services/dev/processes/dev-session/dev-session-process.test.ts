import {setupDevSessionProcess, pushUpdatesForDevSession, DevSessionProcessOptions} from './dev-session-process.js'
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
import {getUploadURL, writeManifestToBundle} from '../../../bundle.js'
import {formData} from '@shopify/cli-kit/node/http'
import {describe, expect, test, vi} from 'vitest'
import {AbortSignal, AbortController} from '@shopify/cli-kit/node/abort'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import * as outputContext from '@shopify/cli-kit/node/ui/components'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {firstPartyDev} from '@shopify/cli-kit/node/context/local'
import {SerialBatchProcessor} from '@shopify/cli-kit/node/serial-batch-processor'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/archiver')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('../../../../utilities/app/app-url.js')
vi.mock('node-fetch')
vi.mock('../../../bundle.js')
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()
  return {
    ...original,
    firstPartyDev: vi.fn().mockReturnValue(false),
  }
})

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
  test('creates a new dev session successfully when receiving the app watcher start event', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, developerPlatformClient} = await setup(tmpDir)

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})

      // Then
      await vi.waitFor(() => expect(developerPlatformClient.devSessionCreate).toHaveBeenCalled())
      expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Ready'))
    })
  })

  test('updates use the extension handle as the output prefix', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, app, devSessionStatusManager} = await setup(tmpDir)

      const spyContext = vi.spyOn(outputContext, 'useConcurrentOutputContext')
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})

      const extension = await testUIExtension()
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension}]})

      // Then
      await vi.waitFor(() =>
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated dev preview on test.myshopify.com')),
      )
      expect(spyContext).toHaveBeenCalledWith({outputPrefix: 'test-ui-extension', stripAnsi: false}, expect.anything())

      // In theory this shouldn't be necessary, but vitest doesn't restore spies automatically.
      // eslint-disable-next-line @shopify/cli/no-vi-manual-mock-clear
      vi.restoreAllMocks()
    })
  })

  test('handles user errors from dev session creation', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, appWatcher, developerPlatformClient} = await setup(tmpDir)

      const userErrors = [{message: 'Test error', category: 'test'}]
      developerPlatformClient.devSessionCreate = vi.fn().mockResolvedValue({devSessionCreate: {userErrors}})

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: new AbortSignal()}, options)
      await appWatcher.start({stdout, stderr, signal: new AbortController().signal})

      // Then
      await vi.waitFor(() => {
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error'))
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Test error'))
      })
    })
  })

  test('handles receiving an event before session is ready', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, app, developerPlatformClient} = await setup(tmpDir)

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})
      await flushPromises()

      // Then
      expect(stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Change detected, but dev preview is not ready yet.'),
      )
      expect(developerPlatformClient.devSessionCreate).not.toHaveBeenCalled()
      expect(developerPlatformClient.devSessionUpdate).not.toHaveBeenCalled()
    })
  })

  test('handles user errors from dev session update', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {
        options,
        stdout,
        stderr,
        abortController,
        appWatcher,
        app,
        developerPlatformClient,
        devSessionStatusManager,
      } = await setup(tmpDir)

      const userErrors = [{message: 'Update error', category: 'test'}]
      developerPlatformClient.devSessionUpdate = vi.fn().mockResolvedValue({devSessionUpdate: {userErrors}})

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})

      // Then
      await vi.waitFor(() => {
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error'))
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Update error'))
      })
    })
  })

  test('handles scope changes and displays updated message', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, app, devSessionStatusManager} = await setup(tmpDir)

      vi.mocked(buildAppURLForWeb).mockResolvedValue('https://test.myshopify.com/admin/apps/test')
      const appAccess = await testAppAccessConfigExtension(false, undefined, false)
      const event = {extensionEvents: [{type: 'updated', extension: appAccess}], app}
      const contextSpy = vi.spyOn(outputContext, 'useConcurrentOutputContext')

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', event)

      // Then
      await vi.waitFor(() => {
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated dev preview on test.myshopify.com'))
        expect(stdout.write).toHaveBeenCalledWith(
          expect.stringContaining('Access scopes auto-granted: read_products, write_products'),
        )
      })

      expect(contextSpy).toHaveBeenCalledWith({outputPrefix: 'app-preview', stripAnsi: false}, expect.anything())
      contextSpy.mockRestore()
    })
  })

  test('updates preview URL to appPreviewURL by default (local dev console only for 1P devs)', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - dev console is NOT shown by default (only for 1P devs)
      const {options, stdout, stderr, abortController, appWatcher, devSessionStatusManager} = await setup(tmpDir)

      vi.mocked(firstPartyDev).mockReturnValue(false)
      const extension = await testUIExtension({type: 'ui_extension'})
      const newApp = testAppLinked({allExtensions: [extension]})

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app: newApp, extensionEvents: [{type: 'updated', extension}]})

      // Then
      await vi.waitFor(() => expect(devSessionStatusManager.status.previewURL).toBe(options.appPreviewURL))
    })
  })

  test('updates preview URL to appLocalProxyURL when 1P dev has previewable extensions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - dev console is shown for 1P devs with previewable extensions
      const {options, stdout, stderr, abortController, appWatcher, devSessionStatusManager} = await setup(tmpDir)

      vi.mocked(firstPartyDev).mockReturnValue(true)
      const extension = await testUIExtension({type: 'ui_extension'})
      const newApp = testAppLinked({allExtensions: [extension]})

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app: newApp, extensionEvents: [{type: 'updated', extension}]})

      // Then
      await vi.waitFor(() => expect(devSessionStatusManager.status.previewURL).toBe(options.appLocalProxyURL))
      vi.mocked(firstPartyDev).mockReturnValue(false)
    })
  })

  test('updates preview URL to appPreviewURL when no previewable extensions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, devSessionStatusManager} = await setup(tmpDir)

      const extension = await testFlowActionExtension()
      const newApp = testAppLinked({allExtensions: [extension]})

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app: newApp, extensionEvents: [{type: 'updated', extension}]})

      // Then
      await vi.waitFor(() => expect(devSessionStatusManager.status.previewURL).toBe(options.appPreviewURL))
    })
  })

  test('resets dev session status when calling resetDevSessionStatus', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, devSessionStatusManager} = await setup(tmpDir)

      const extension = await testUIExtension({type: 'ui_extension'})
      const newApp = testAppLinked({allExtensions: [extension]})

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app: newApp, extensionEvents: [{type: 'updated', extension}]})

      // Then
      await vi.waitFor(() => expect(devSessionStatusManager.status.previewURL).toBeDefined())

      // When
      devSessionStatusManager.reset()

      // Then
      expect(devSessionStatusManager.status.isReady).toBe(false)
      expect(devSessionStatusManager.status.previewURL).toBeUndefined()
    })
  })

  test('handles error events from the app watcher', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher} = await setup(tmpDir)

      const testError = new Error('Watcher error')

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      appWatcher.emit('error', testError)
      await flushPromises()

      // Then
      expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error'))
      expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Watcher error'))
    })
  })

  test('sets correct status messages during dev session lifecycle', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, app, devSessionStatusManager} = await setup(tmpDir)

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)

      expect(stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`Preparing dev preview on ${options.storeFqdn}`),
      )

      const statusSpy = vi.spyOn(devSessionStatusManager, 'setMessage')

      // Then - Initial loading state
      expect(devSessionStatusManager.status.statusMessage).toEqual({
        message: 'Preparing dev preview',
        type: 'loading',
      })

      // When - Start the session
      await appWatcher.start({stdout, stderr, signal: abortController.signal})

      // Then - Ready state
      await vi.waitFor(() => expect(statusSpy).toHaveBeenCalledWith('READY'))

      // When - Emit an update event
      const extension = await testUIExtension()
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension}]})

      // Then - Loading state during update
      await vi.waitFor(() => expect(statusSpy).toHaveBeenCalledWith('CHANGE_DETECTED'))
      // Then - Updated state after successful update
      await vi.waitFor(() => expect(statusSpy).toHaveBeenCalledWith('UPDATED'))
      statusSpy.mockRestore()
    })
  })

  test('sets error status message on build error', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, app, devSessionStatusManager} = await setup(tmpDir)

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
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', errorEvent)

      // Then
      await vi.waitFor(() =>
        expect(devSessionStatusManager.status.statusMessage).toEqual({
          message: 'Build error. Please review your code and try again',
          type: 'error',
        }),
      )
    })
  })

  test('sets error status message on remote error', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {
        options,
        stdout,
        stderr,
        abortController,
        appWatcher,
        app,
        developerPlatformClient,
        devSessionStatusManager,
      } = await setup(tmpDir)

      const userErrors = [{message: 'Update error', category: 'test'}]
      developerPlatformClient.devSessionUpdate = vi.fn().mockResolvedValue({devSessionUpdate: {userErrors}})

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})

      // Then
      await vi.waitFor(() =>
        expect(devSessionStatusManager.status.statusMessage).toEqual({
          message: 'Error updating dev preview',
          type: 'error',
        }),
      )
    })
  })

  test('sets validation error status message when error cause is validation-error', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, devSessionStatusManager} = await setup(tmpDir)

      const validationError = new Error('Validation failed')
      ;(validationError as Error & {cause: string}).cause = 'validation-error'

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('error', validationError)

      // Then
      await vi.waitFor(() =>
        expect(devSessionStatusManager.status.statusMessage).toEqual({
          message: 'Validation error in your app configuration',
          type: 'error',
        }),
      )
    })
  })

  test('manifest sent in update payload only includes affected extensions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, developerPlatformClient, devSessionStatusManager} =
        await setup(tmpDir)

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
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {
        app: appWithMultipleExtensions,
        extensionEvents: [{type: 'updated', extension: updatedExtension}],
      })

      // Then
      await vi.waitFor(() =>
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
                uuid: undefined,
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
        }),
      )
    })
  })

  test('writes full manifest to bundle on session update, not just create', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, devSessionStatusManager} = await setup(tmpDir)

      vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

      const updatedExtension = await testUIExtension({handle: 'updated-ext', uid: 'updated-uid'})
      updatedExtension.deployConfig = vi.fn().mockResolvedValue({})
      const existingExtension = await testUIExtension({handle: 'existing-ext', uid: 'existing-uid'})
      existingExtension.deployConfig = vi.fn().mockResolvedValue({})
      const appWithMultipleExtensions = testAppLinked({
        allExtensions: [updatedExtension, existingExtension],
      })

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))

      // Capture manifests at call time (the object is mutated after writeManifestToBundle)
      const capturedManifests: any[] = []
      vi.mocked(writeManifestToBundle).mockImplementation(async (manifest: any) => {
        capturedManifests.push(structuredClone(manifest))
      })

      // Emit UPDATE event with only one extension changed
      appWatcher.emit('all', {
        app: appWithMultipleExtensions,
        extensionEvents: [{type: 'updated', extension: updatedExtension}],
      })

      // Then - writeManifestToBundle should have been called with ALL modules, not just the updated one
      await vi.waitFor(() => expect(capturedManifests).toHaveLength(1))
      const moduleUids = capturedManifests[0].modules.map((mod: any) => mod.uid)
      expect(moduleUids).toContain(updatedExtension.uid)
      expect(moduleUids).toContain(existingExtension.uid)
      expect(moduleUids.length).toBeGreaterThanOrEqual(2)
    })
  })

  test('writes full manifest including new extension on created event', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, devSessionStatusManager} = await setup(tmpDir)

      vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

      const existingExtension = await testUIExtension({handle: 'existing-ext', uid: 'existing-uid'})
      existingExtension.deployConfig = vi.fn().mockResolvedValue({})
      const newExtension = await testUIExtension({handle: 'new-ext', uid: 'new-uid'})
      newExtension.deployConfig = vi.fn().mockResolvedValue({})

      // The app after reload includes both the existing and newly created extension
      const appAfterReload = testAppLinked({
        allExtensions: [existingExtension, newExtension],
      })

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))

      // Capture manifests at call time (the object is mutated after writeManifestToBundle)
      const capturedManifests: any[] = []
      vi.mocked(writeManifestToBundle).mockImplementation(async (manifest: any) => {
        capturedManifests.push(structuredClone(manifest))
      })

      // Emit event with a new extension created mid-dev (simulates generate extension)
      appWatcher.emit('all', {
        app: appAfterReload,
        extensionEvents: [{type: 'created', extension: newExtension}],
      })

      // Then - writeManifestToBundle should include ALL modules (existing + new)
      await vi.waitFor(() => expect(capturedManifests).toHaveLength(1))
      const moduleUids = capturedManifests[0].modules.map((mod: any) => mod.uid)
      expect(moduleUids).toContain(existingExtension.uid)
      expect(moduleUids).toContain(newExtension.uid)
      expect(moduleUids.length).toBeGreaterThanOrEqual(2)
    })
  })

  test('assetsURL is only generated if affected extensions have assets', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, developerPlatformClient, devSessionStatusManager} =
        await setup(tmpDir)

      vi.mocked(formData).mockReturnValue({append: vi.fn(), getHeaders: vi.fn()} as any)

      const extensionWithAssets = await testUIExtension({handle: 'ui-extension-handle', uid: 'ui-extension-uid'})
      extensionWithAssets.deployConfig = vi.fn().mockResolvedValue({})
      const app = testAppLinked({allExtensions: [extensionWithAssets]})

      vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))

      // Mock the asset directory creation AFTER appWatcher.start so it doesn't get deleted
      await mkdir(joinPath(options.appWatcher.buildOutputPath, 'ui-extension-uid'))
      appWatcher.emit('all', {
        app,
        extensionEvents: [{type: 'updated', extension: extensionWithAssets}],
      })

      // Then
      await vi.waitFor(() =>
        expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledWith({
          shopFqdn: 'test.myshopify.com',
          appId: 'app123',
          assetsUrl: 'https://gcs.url',
          manifest: expect.any(Object),
          inheritedModuleUids: [],
        }),
      )
    })
  })

  test('assetsURL is always generated for create, even if there are no assets', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, developerPlatformClient} = await setup(tmpDir)

      vi.mocked(formData).mockReturnValue({append: vi.fn(), getHeaders: vi.fn()} as any)
      vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})

      // Then
      await vi.waitFor(() =>
        expect(developerPlatformClient.devSessionCreate).toHaveBeenCalledWith({
          shopFqdn: 'test.myshopify.com',
          appId: 'app123',
          assetsUrl: 'https://gcs.url',
          websocketUrl: 'wss://test.dev/extensions',
        }),
      )
    })
  })

  test('multiple updates to different extensions are consolidated if a request is in progress', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, developerPlatformClient, devSessionStatusManager} =
        await setup(tmpDir)

      vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

      const extension1 = await testUIExtension({type: 'ui_extension'})
      extension1.uid = 'ext1'
      extension1.handle = 'ext1-handle'
      extension1.deployConfig = vi.fn().mockResolvedValue({config1: 'val1'})

      const extension2 = await testWebhookExtensions()
      extension2.uid = 'ext2'
      extension2.handle = 'ext2-handle'
      extension2.deployConfig = vi.fn().mockResolvedValue({config2: 'val2'})

      const app = testAppLinked({allExtensions: [extension1, extension2]})

      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))

      // First event is processed immediat
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension1}]})

      // second and third event will be queued and processed together in a consolidated event.
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension2}]})
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension1}]})

      await vi.waitFor(() => expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledTimes(2))
      const calls = (developerPlatformClient.devSessionUpdate as any).mock.calls

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
  })

  test('displays SESSION_TAKEOVER warning from devSessionCreate response', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, developerPlatformClient} = await setup(tmpDir)

      developerPlatformClient.devSessionCreate = vi.fn().mockResolvedValue({
        devSessionCreate: {
          userErrors: [],
          warnings: [{message: "You took over another user's session", code: 'SESSION_TAKEOVER'}],
          devSession: {
            websocketUrl: 'wss://test.dev/extensions',
            updatedAt: '2024-01-01T00:00:00Z',
            user: {id: 'user1', email: 'user1@test.com'},
            app: {id: 'app1', key: 'key1'},
          },
        },
      })

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})

      // Then
      await vi.waitFor(() => {
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining("⚠️  You took over another user's session"))
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Ready'))
      })
    })
  })

  test('detects session takeover during update when user ID changes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // The session takeover detection throws an AbortError that propagates as an unhandled
      // rejection through the SerialBatchProcessor (due to a missing await in bundleExtensionsAndUpload).
      // Attach a .catch() to the processing promise to prevent the unhandled rejection.
      const originalEnqueue = SerialBatchProcessor.prototype.enqueue
      const enqueueSpy = vi.spyOn(SerialBatchProcessor.prototype, 'enqueue').mockImplementation(function (
        this: any,
        ...args: [any]
      ) {
        originalEnqueue.apply(this, args)
        this.processingPromise?.catch(() => {})
      })

      // Given
      const {
        options,
        stdout,
        stderr,
        abortController,
        appWatcher,
        app,
        developerPlatformClient,
        devSessionStatusManager,
      } = await setup(tmpDir)

      // Create with initial session state
      developerPlatformClient.devSessionCreate = vi.fn().mockResolvedValue({
        devSessionCreate: {
          userErrors: [],
          devSession: {
            websocketUrl: 'wss://test.dev/extensions',
            updatedAt: '2024-01-01T00:00:00Z',
            user: {id: 'user1', email: 'user1@test.com'},
            app: {id: 'app1', key: 'key1'},
          },
        },
      })

      // Update returns a different user (session takeover)
      developerPlatformClient.devSessionUpdate = vi.fn().mockResolvedValue({
        devSessionUpdate: {
          userErrors: [],
          devSession: {
            websocketUrl: 'wss://test.dev/extensions',
            updatedAt: '2024-01-01T00:01:00Z',
            user: {id: 'user2', email: 'user2@test.com'},
            app: {id: 'app1', key: 'key1'},
          },
        },
      })

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})

      // Then
      await vi.waitFor(() => {
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Another developer'))
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('user2@test.com'))
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('taken ownership of this dev preview'))
      })

      enqueueSpy.mockRestore()
    })
  })

  test('does not detect session takeover when session state matches during update', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {
        options,
        stdout,
        stderr,
        abortController,
        appWatcher,
        app,
        developerPlatformClient,
        devSessionStatusManager,
      } = await setup(tmpDir)

      // Create and update return the same user/websocket
      developerPlatformClient.devSessionCreate = vi.fn().mockResolvedValue({
        devSessionCreate: {
          userErrors: [],
          devSession: {
            websocketUrl: 'wss://test.dev/extensions',
            updatedAt: '2024-01-01T00:00:00Z',
            user: {id: 'user1', email: 'user1@test.com'},
            app: {id: 'app1', key: 'key1'},
          },
        },
      })

      developerPlatformClient.devSessionUpdate = vi.fn().mockResolvedValue({
        devSessionUpdate: {
          userErrors: [],
          devSession: {
            websocketUrl: 'wss://test.dev/extensions',
            updatedAt: '2024-01-01T00:01:00Z',
            user: {id: 'user1', email: 'user1@test.com'},
            app: {id: 'app1', key: 'key1'},
          },
        },
      })

      // When
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: await testWebhookExtensions()}]})

      // Then - Should succeed normally without takeover error
      await vi.waitFor(() =>
        expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated dev preview on test.myshopify.com')),
      )
      expect(stdout.write).not.toHaveBeenCalledWith(expect.stringContaining('Another developer'))
      expect(stdout.write).not.toHaveBeenCalledWith(expect.stringContaining('taken ownership of this dev preview'))
    })
  })

  test('retries failed events along with newly received events', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const {options, stdout, stderr, abortController, appWatcher, developerPlatformClient, devSessionStatusManager} =
        await setup(tmpDir)

      vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')

      // Setup test extensions
      const extension1 = await testUIExtension()
      extension1.uid = 'ext1-uid'
      extension1.handle = 'ext1-handle'
      extension1.deployConfig = vi.fn().mockResolvedValue({config1: 'val1'})

      const extension2 = await testWebhookExtensions()
      extension2.uid = 'ext2-uid'
      extension2.handle = 'ext2-handle'
      extension2.deployConfig = vi.fn().mockResolvedValue({config2: 'val2'})

      const app = testAppLinked({allExtensions: [extension1, extension2]})

      // Mock devSessionUpdate to fail on first call and succeed on second
      developerPlatformClient.devSessionUpdate = vi
        .fn()
        .mockResolvedValueOnce({devSessionUpdate: {userErrors: [{message: 'Simulated failure', category: 'remote'}]}})
        .mockResolvedValueOnce({devSessionUpdate: {userErrors: []}})

      // Start the dev session
      await pushUpdatesForDevSession({stderr, stdout, abortSignal: abortController.signal}, options)
      await appWatcher.start({stdout, stderr, signal: abortController.signal})
      await vi.waitFor(() => expect(devSessionStatusManager.status.isReady).toBe(true))

      // First event (will fail)
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension1}]})

      // Verify the update was attempted and failed
      await vi.waitFor(() => expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledTimes(1))
      expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Simulated failure'))
      expect(devSessionStatusManager.status.statusMessage?.message).toBe('Error updating dev preview')

      // Second event (should include retry of first failed event)
      appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: extension2}]})

      // Verify a second update attempt was made
      await vi.waitFor(() => expect(developerPlatformClient.devSessionUpdate).toHaveBeenCalledTimes(2))

      // Verify the second update attempt included both extensions
      const secondCallPayload = (developerPlatformClient.devSessionUpdate as any).mock.calls[1][0]
      expect(secondCallPayload.manifest.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({uid: 'ext1-uid', handle: 'ext1-handle', config: {config1: 'val1'}}),
          expect.objectContaining({uid: 'ext2-uid', handle: 'ext2-handle', config: {config2: 'val2'}}),
        ]),
      )
      expect(secondCallPayload.manifest.modules.length).toBe(2)

      // Verify success status was set
      expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated dev preview on test.myshopify.com'))
      expect(devSessionStatusManager.status.statusMessage?.message).toBe('Updated')
    })
  })
})

async function setup(tmpDir: string) {
  vi.mocked(formData).mockReturnValue({append: vi.fn(), getHeaders: vi.fn()} as any)
  vi.mocked(getUploadURL).mockResolvedValue('https://gcs.url')
  const stdout = {write: vi.fn()} as any
  const stderr = {write: vi.fn()} as any
  const developerPlatformClient = testDeveloperPlatformClient()
  const app = testAppLinked({directory: tmpDir})
  app.manifest = vi.fn().mockResolvedValue({
    name: 'App',
    handle: '',
    modules: [],
  })

  const buildOutputPath = joinPath(tmpDir, '.shopify', 'dev-bundle')
  await mkdir(buildOutputPath)
  const appWatcher = new AppEventWatcher(app, undefined, buildOutputPath)
  // Disable initial build as we are mocking extensions and don't want to deal with esbuild/build failures
  const originalStart = appWatcher.start.bind(appWatcher)
  appWatcher.start = (options?: any) => originalStart(options, false)

  const abortController = new AbortController()
  const devSessionStatusManager = new DevSessionStatusManager()
  const options: DevSessionProcessOptions = {
    app,
    apiKey: 'test-api-key',
    developerPlatformClient,
    appWatcher,
    storeFqdn: 'test.myshopify.com',
    url: 'https://test.dev',
    appId: 'app123',
    organizationId: 'org123',
    appPreviewURL: 'https://test.preview.url',
    appLocalProxyURL: 'https://test.local.url',
    devSessionStatusManager,
  }
  return {
    options,
    stdout,
    stderr,
    developerPlatformClient,
    appWatcher,
    app,
    abortController,
    devSessionStatusManager,
  }
}
