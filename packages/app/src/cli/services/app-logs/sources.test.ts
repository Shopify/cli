import {sources} from './sources.js'
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

  expect(sources(testApp({allExtensions: [first, ui, second]}))).toEqual(['extensions.first', 'extensions.second'])
})

test('returns an empty collection without function extensions', () => {
  expect(sources(testApp())).toEqual([])
})
