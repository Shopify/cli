import {setupDevSessionProcess, pushUpdatesForDevSession} from './dev-session.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'
import {buildAppURLForWeb} from '../../../utilities/app/app-url.js'
import {
  testAppAccessConfigExtension,
  testAppLinked,
  testDeveloperPlatformClient,
  testUIExtension,
  testWebhookExtensions,
} from '../../../models/app/app.test-data.js'
import {formData} from '@shopify/cli-kit/node/http'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {flushPromises} from '@shopify/cli-kit/node/promises'
import {writeFile} from '@shopify/cli-kit/node/fs'
import * as outputContext from '@shopify/cli-kit/node/ui/components'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/archiver')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('../../../utilities/app/app-url.js')
vi.mock('node-fetch')

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
    }

    // When
    const process = await setupDevSessionProcess(options)

    // Then
    expect(process).toEqual({
      type: 'dev-session',
      prefix: 'dev-session',
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

  beforeEach(() => {
    vi.mocked(formData).mockReturnValue({append: vi.fn(), getHeaders: vi.fn()} as any)
    vi.mocked(writeFile).mockResolvedValue(undefined)
    stdout = {write: vi.fn()}
    stderr = {write: vi.fn()}
    developerPlatformClient = testDeveloperPlatformClient()
    app = testAppLinked()
    appWatcher = new AppEventWatcher(app)

    options = {
      developerPlatformClient,
      appWatcher,
      storeFqdn: 'test.myshopify.com',
      appId: 'app123',
      organizationId: 'org123',
    }
  })

  test('creates a new dev session successfully when receiving the app watcher start event', async () => {
    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: new AbortSignal()}, options)
    await appWatcher.start()
    await flushPromises()

    // Then
    expect(developerPlatformClient.devSessionCreate).toHaveBeenCalled()
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Ready'))
  })

  test('updates use the extension handle as the output prefix', async () => {
    // When

    const spyContext = vi.spyOn(outputContext, 'useConcurrentOutputContext')
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: new AbortSignal()}, options)
    await appWatcher.start()
    await flushPromises()

    const extension = await testUIExtension()
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension}]})
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated'))
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
    await appWatcher.start()
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: new AbortSignal()}, options)
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error'))
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Test error'))
  })

  test('handles receiving an event before session is ready', async () => {
    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: new AbortSignal()}, options)
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: testWebhookExtensions()}]})
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('Change detected, but dev session is not ready yet.'),
    )
    expect(developerPlatformClient.devSessionCreate).not.toHaveBeenCalled()
    expect(developerPlatformClient.devSessionUpdate).not.toHaveBeenCalled()
  })

  test('handles user errors from dev session update', async () => {
    // Given
    const userErrors = [{message: 'Update error', category: 'test'}]
    developerPlatformClient.devSessionUpdate = vi.fn().mockResolvedValue({devSessionUpdate: {userErrors}})

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: new AbortSignal()}, options)
    await appWatcher.start()
    await flushPromises()
    appWatcher.emit('all', {app, extensionEvents: [{type: 'updated', extension: testWebhookExtensions()}]})
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Error'))
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Update error'))
  })

  test('handles scope changes and displays action required message', async () => {
    // Given
    vi.mocked(buildAppURLForWeb).mockResolvedValue('https://test.myshopify.com/admin/apps/test')
    const appAccess = await testAppAccessConfigExtension()
    const event = {extensionEvents: [{type: 'updated', extension: appAccess}], app}
    const contextSpy = vi.spyOn(outputContext, 'useConcurrentOutputContext')

    // When
    await pushUpdatesForDevSession({stderr, stdout, abortSignal: new AbortSignal()}, options)
    await appWatcher.start()
    await flushPromises()
    appWatcher.emit('all', event)
    await flushPromises()

    // Then
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Updated'))
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Action required'))
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining('Scopes updated'))
    expect(contextSpy).toHaveBeenCalledWith({outputPrefix: 'dev-session', stripAnsi: false}, expect.anything())
  })
})
