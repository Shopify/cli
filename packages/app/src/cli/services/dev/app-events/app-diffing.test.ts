import {appDiff} from './app-diffing.js'
import {testApp, testAppConfigExtensions, testUIExtension} from '../../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

const extension1 = await testUIExtension({
  type: 'ui_extension',
  handle: 'h1',
  directory: '/extensions/ui_extension_1',
  uid: 'uid1',
})
const extension2 = await testUIExtension({type: 'ui_extension', directory: '/extensions/ui_extension_2', uid: 'uid2'})
const posExtension = await testAppConfigExtensions()
const posExtensionWithDifferentConfig = await testAppConfigExtensions(true)

const testCases = [
  {
    name: 'Both apps have the same extensions',
    oldExtensions: [extension1, extension2, posExtension],
    newExtensions: [extension1, extension2, posExtension],
    expected: {
      created: [],
      updated: [],
      deleted: [],
    },
  },
  {
    name: 'New app is missing 1 extension',
    oldExtensions: [extension1, extension2, posExtension],
    newExtensions: [extension1, extension2],
    expected: {
      created: [],
      updated: [],
      deleted: [posExtension],
    },
  },
  {
    name: 'New app has an extra extension',
    oldExtensions: [extension1, extension2],
    newExtensions: [extension1, extension2, posExtension],
    expected: {
      created: [posExtension],
      updated: [],
      deleted: [],
    },
  },
  {
    name: 'An extension has a new config',
    oldExtensions: [extension1, extension2, posExtension],
    newExtensions: [extension1, extension2, posExtensionWithDifferentConfig],
    expected: {
      created: [],
      updated: [posExtensionWithDifferentConfig],
      deleted: [],
    },
  },
  {
    name: 'An extension has a new config, but includeUpdates is false',
    oldExtensions: [extension1, extension2, posExtension],
    newExtensions: [extension1, extension2, posExtensionWithDifferentConfig],
    includeUpdates: false,
    expected: {
      created: [],
      updated: [],
      deleted: [],
    },
  },
  {
    name: 'Multiple changes',
    oldExtensions: [extension1, posExtension],
    newExtensions: [extension2, posExtensionWithDifferentConfig],
    expected: {
      created: [extension2],
      updated: [posExtensionWithDifferentConfig],
      deleted: [extension1],
    },
  },
]

describe('app-diffing', () => {
  test.each(testCases)(
    '"$name" case returns the expected changes',
    ({oldExtensions, newExtensions, expected, includeUpdates}) => {
      // Given
      const app = testApp({allExtensions: oldExtensions})
      const newApp = testApp({allExtensions: newExtensions})

      // When
      const result = appDiff(app, newApp, includeUpdates ?? true)

      // Then
      expect(result).toEqual(expected)
    },
  )
})
