import {DevAppWatcherOptions, ESBuildContextManager} from './app-watcher-esbuild.js'
import {AppEvent, EventType} from './app-event-watcher.js'
import {testAppLinked, testUIExtension} from '../../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

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
  const options: DevAppWatcherOptions = {
    dotEnvVariables: {key: 'value'},
    url: 'http://localhost:3000',
    outputPath: '/path/to/output',
  }

  test('creating contexts', async () => {
    // Given
    const manager = new ESBuildContextManager(options)
    const extensions = [extension1, extension2]

    // When
    await manager.createContexts(extensions)

    // Then
    expect(manager.contexts).toHaveProperty('h1')
    expect(manager.contexts).toHaveProperty('test-ui-extension')
  })

  test('creating multiple contexts for the same extension', async () => {
    // Given
    const options: DevAppWatcherOptions = {
      dotEnvVariables: {key: 'value'},
      url: 'http://localhost:3000',
      outputPath: '/path/to/output',
    }
    const manager = new ESBuildContextManager(options)
    const extension = await testUIExtension({
      configuration: {
        ...extension2.configuration,
        handle: 'conditional-extension',
        extension_points: [
          {
            target: 'target1',
            module: 'module1',
            should_render: {
              module: 'shouldRenderModule1',
            },
            build_manifest: {
              assets: {
                main: {
                  module: 'module1',
                  filepath: '/conditional-extension.js',
                },
                should_render: {
                  module: 'shouldRenderModule1',
                  filepath: '/conditional-extension-conditions.js',
                },
              },
            },
          },
        ],
      },
    })

    // When
    await manager.createContexts([extension])

    // Then
    expect(manager.contexts).toHaveProperty('conditional-extension')
    expect(manager.contexts['conditional-extension']).toHaveLength(2)
  })

  test('deleting contexts', async () => {
    // Given
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
    const manager = new ESBuildContextManager(options)
    await manager.createContexts([extension2])

    const appEvent: AppEvent = {
      app: testAppLinked(),
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

  test('rebuilding contexts', async () => {
    // Given
    const manager = new ESBuildContextManager(options)
    await manager.createContexts([extension1])
    const spyContext = vi.spyOn(manager.contexts.h1![0]!, 'rebuild').mockResolvedValue({} as any)
    const spyCopy = vi.spyOn(fs, 'copyFile').mockResolvedValue()

    // When
    await manager.rebuildContext(extension1)

    // Then
    expect(spyContext).toHaveBeenCalled()
    expect(spyCopy).toHaveBeenCalledWith('/path/to/output/h1/dist', '/extensions/ui_extension_1/dist')
  })
})
