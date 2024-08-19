import {DevAppWatcherOptions, ESBuildContextManager} from './app-watcher-esbuild.js'
import {testUIExtension} from '../../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

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
  })
})
