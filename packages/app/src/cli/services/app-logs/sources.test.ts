import {sources} from './sources.js'
import {sourcesForApp} from './utils.js'
import {testApp, testFunctionExtension, testUIExtension} from '../../models/app/app.test-data.js'
import {expect, test} from 'vitest'

test('returns function sources in extension order', async () => {
  const first = await testFunctionExtension({
    config: {...(await testFunctionExtension()).configuration, handle: 'first'},
  })
  const second = await testFunctionExtension({
    config: {...(await testFunctionExtension()).configuration, handle: 'second'},
  })
  const ui = await testUIExtension()

  const app = testApp({allExtensions: [first, ui, second]})
  const result = sources(app)
  expect(result.map(({source}) => source)).toEqual(sourcesForApp(app))
  expect(result.map(({source}) => source)).toEqual(['extensions.first', 'extensions.second'])
  expect(result[0]).toEqual({
    source: 'extensions.first',
    namespace: 'extensions',
    handle: 'first',
    name: first.configuration.name,
    type: first.type,
    externalType: first.externalType,
    humanName: first.humanName,
    uid: first.uid,
    directory: first.directory,
    configurationPath: first.configurationPath,
    configuration: first.configuration,
    entrySourceFilePath: first.entrySourceFilePath,
    outputPath: first.outputPath,
    surface: first.surface,
    features: first.features,
    dependency: first.dependency,
  })
})

test('returns an empty collection without function extensions', () => {
  expect(sources(testApp())).toEqual([])
})
