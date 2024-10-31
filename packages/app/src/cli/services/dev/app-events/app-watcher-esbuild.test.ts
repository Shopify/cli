import {DevAppWatcherOptions, ESBuildContextManager} from './app-watcher-esbuild.js'
import {AppEvent, EventType} from './app-event-watcher.js'
import {testApp, testUIExtension} from '../../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@luckycatfactory/esbuild-graphql-loader', () => ({
  default: {
    default: () => {
      return {name: 'graphql-loader', setup: vi.fn()}
    },
  },
}))

const extension1 = await testUIExtension({type: 'ui_extension', handle: 'h1', directory: '/extensions/ui_extension_1'})
const extension2 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_2'})

describe('app-watcher-esbuild', () => {
  test('creating contexts', async () => {
    // Given
    const options: DevAppWatcherOptions = {
      dotEnvVariables: {key: 'value'},
      url: 'http://localhost:3000',
      outputPath: '/path/to/output',
    }
    const manager = new ESBuildContextManager(options)
    const extensions = [extension1, extension2]

    // When
    await manager.createContexts(extensions)

    // Then
    expect(manager.contexts).toHaveProperty('h1')
    expect(manager.contexts).toHaveProperty('test-ui-extension')
  })

  test('deleting contexts', async () => {
    // Given
    const options: DevAppWatcherOptions = {
      dotEnvVariables: {key: 'value'},
      url: 'http://localhost:3000',
      outputPath: '/path/to/output',
    }
    const manager = new ESBuildContextManager(options)
    const extensions = [extension1, extension2]
    await manager.createContexts(extensions)

    // When
    await manager.deleteContexts([extension1])

    // Then
    expect(manager.contexts).not.toHaveProperty('h1')
    expect(manager.contexts).toHaveProperty('test-ui-extension')
  })

  test('updating contexts with an app event', async () => {
    // Given
    const options: DevAppWatcherOptions = {
      dotEnvVariables: {key: 'value'},
      url: 'http://localhost:3000',
      outputPath: '/path/to/output',
    }
    const manager = new ESBuildContextManager(options)
    await manager.createContexts([extension2])

    const appEvent: AppEvent = {
      app: testApp(),
      path: '',
      startTime: [0, 0],
      extensionEvents: [
        {type: EventType.Created, extension: extension1},
        {type: EventType.Deleted, extension: extension2},
      ],
    }

    // When
    await manager.updateContexts(appEvent)

    // Then
    expect(manager.contexts).toHaveProperty('h1')
    expect(manager.contexts).not.toHaveProperty('test-ui-extension')
  })
})
