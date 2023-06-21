import {testFunctionExtension} from '../app/app.test-data.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {describe, expect, test} from 'vitest'

function functionConfiguration(): FunctionConfigType {
  return {
    name: 'foo',
    type: 'function',
    api_version: '2023-07',
    configuration_ui: true,
    metafields: [],
    build: {},
  }
}

describe('watchPaths', async () => {
  test('returns an array for a single path', async () => {
    const config = functionConfiguration()
    config.build = {
      watch: 'single-path',
    }
    const extensionInstance = await testFunctionExtension({
      config,
    })

    const got = extensionInstance.watchPaths

    expect(got).toEqual(['single-path'])
  })

  test('returns an array for an array', async () => {
    const config = functionConfiguration()
    config.build = {
      watch: ['one-path', 'two-path', 'red-path', 'blue-path'],
    }
    const extensionInstance = await testFunctionExtension({
      config,
    })

    const got = extensionInstance.watchPaths

    expect(got).toEqual(['one-path', 'two-path', 'red-path', 'blue-path'])
  })
})
