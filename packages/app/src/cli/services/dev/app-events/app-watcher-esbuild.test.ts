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

const extension1 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_1', uid: 'uid1'})
const extension2 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_2', uid: 'uid2'})

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
    expect(manager.contexts).toHaveProperty('uid1')
    expect(manager.contexts).toHaveProperty('uid2')
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
      uid: 'conditional-extension-uid',
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
    expect(manager.contexts).toHaveProperty('conditional-extension-uid')
    expect(manager.contexts['conditional-extension-uid']).toHaveLength(2)
  })

  test('deleting contexts', async () => {
    // Given
    const manager = new ESBuildContextManager(options)
    const extensions = [extension1, extension2]
    await manager.createContexts(extensions)

    // When
    await manager.deleteContexts([extension1])

    // Then
    expect(manager.contexts).not.toHaveProperty('uid1')
    expect(manager.contexts).toHaveProperty('uid2')
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
    expect(manager.contexts).toHaveProperty('uid1')
    expect(manager.contexts).not.toHaveProperty('uid2')
  })

  test('updating contexts with an app event when the app was reloaded', async () => {
    // Given
    const manager = new ESBuildContextManager(options)
    await manager.createContexts([extension1])
    const originalContext = manager.contexts.uid1![0]!
    const appEvent: AppEvent = {
      app: testAppLinked(),
      path: '',
      startTime: [0, 0],
      extensionEvents: [{type: EventType.Updated, extension: extension1}],
      appWasReloaded: true,
    }

    // When
    await manager.updateContexts(appEvent)

    // Then
    expect(manager.contexts).toHaveProperty('uid1')
    expect(manager.contexts.uid1!.length).toBe(1)
    expect(manager.contexts.uid1![0]).not.toBe(originalContext)
  })

  test('rebuilding contexts', async () => {
    // Given
    const manager = new ESBuildContextManager(options)
    await manager.createContexts([extension1])
    const spyContext = vi.spyOn(manager.contexts.uid1![0]!, 'rebuild').mockResolvedValue({} as any)
    const spyCopy = vi.spyOn(fs, 'copyFile').mockResolvedValue()

    // When
    await manager.rebuildContext(extension1)

    // Then
    expect(spyContext).toHaveBeenCalled()
    expect(spyCopy).toHaveBeenCalledWith('/path/to/output/uid1/dist', '/extensions/ui_extension_1/dist')
  })
})
