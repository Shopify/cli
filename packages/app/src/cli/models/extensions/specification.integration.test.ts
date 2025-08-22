import {loadLocalExtensionsSpecifications} from './load-specifications.js'
import {configWithoutFirstClassFields, createContractBasedModuleSpecification} from './specification.js'
import {AppSchema} from '../app/app.js'
import {describe, test, expect, beforeAll} from 'vitest'

// If the AppSchema is not instanced, the dynamic loading of loadLocalExtensionsSpecifications is not working
beforeAll(() => {
  const schema = AppSchema
})

describe('allUISpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadLocalExtensionsSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allLocalSpecs', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadLocalExtensionsSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('createContractBasedModuleSpecification', () => {
  test('creates a specification with the given identifier', () => {
    // When
    const got = createContractBasedModuleSpecification('test', ['localization'])

    // Then
    expect(got).toMatchObject(
      expect.objectContaining({
        identifier: 'test',
        experience: 'extension',
        uidStrategy: 'uuid',
      }),
    )
    expect(got.appModuleFeatures()).toEqual(['localization'])
  })
})

describe('configWithoutFirstClassFields', () => {
  test('removes the first class fields from the config', () => {
    // When
    const got = configWithoutFirstClassFields({
      type: 'test',
      handle: 'test',
      uid: 'test',
      path: 'test',
      extensions: [{type: 'test', handle: 'test', uid: 'test', path: 'test'}],
      config: {
        test: 'test',
      },
      other: 'other',
    })

    // Then
    expect(got).toEqual({
      config: {
        test: 'test',
      },
      other: 'other',
    })
  })
})
