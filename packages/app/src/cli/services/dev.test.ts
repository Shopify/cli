import {devNonPreviewableExtensionTarget} from './dev.js'
import {setupConfigWatcher, setupNonPreviewableExtensionBundler} from './dev/extension/bundler.js'
import {testApp, testUIExtension} from '../models/app/app.test-data.js'
import {loadLocalUIExtensionsSpecifications} from '../models/extensions/specifications.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {Writable} from 'node:stream'

vi.mock('./dev/extension/bundler.js')

describe('devNonPreviewableExtensionTarget()', () => {
  test('calls setupNonPreviewableExtensionBundler and setupConfigWatcher on each extension', async () => {
    const abortController = new AbortController()
    const stdout = new Writable()
    const stderr = new Writable()
    const extension1 = await testUIExtension({
      devUUID: '1',
      directory: 'directory/path/1',
    })

    const extension2 = await testUIExtension({
      devUUID: '2',
      directory: 'directory/path/2',
    })

    const app = testApp()
    const extensions = [extension1, extension2]
    const remoteExtensions = {} as any
    remoteExtensions[extension1.localIdentifier] = 'mock-registration-id-1'
    remoteExtensions[extension2.localIdentifier] = 'mock-registration-id-2'
    const specifications = await loadLocalUIExtensionsSpecifications()

    const process = devNonPreviewableExtensionTarget({
      extensions,
      app,
      url: 'mock-url',
      token: 'mock-token',
      apiKey: 'mock-api-key',
      remoteExtensions,
      specifications,
    })

    await process.action(stdout, stderr, abortController.signal)

    extensions.forEach((ext) => {
      expect(setupNonPreviewableExtensionBundler).toHaveBeenCalledWith({
        extension: ext,
        token: 'mock-token',
        apiKey: 'mock-api-key',
        registrationId: remoteExtensions[ext.localIdentifier],
        stdout,
        stderr,
        signal: abortController.signal,
        app,
        url: 'mock-url',
      })

      expect(setupConfigWatcher).toHaveBeenCalledWith({
        extension: ext,
        token: 'mock-token',
        apiKey: 'mock-api-key',
        registrationId: remoteExtensions[ext.localIdentifier],
        stdout,
        stderr,
        signal: abortController.signal,
        specifications,
      })
    })
  })
})
