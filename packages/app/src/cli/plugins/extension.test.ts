import {getListOfExtensionSpecs, getListOfExtensionPoints, getListOfFunctionSpecs} from './extension.js'
import {Config} from '@oclif/core'
import {describe, test, vi, expect} from 'vitest'

describe('getListOfExtensionSpecs', () => {
  test('returns empty list when there are no extension specs', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await getListOfExtensionSpecs(config)

    // Then
    expect(got).toEqual([])
  })

  test('returns list of extension specs', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: [{firstSpec: 1}, {secondSpec: 2}], plugin: {name: 'extension-spec'}},
        {result: [{thirdSpec: 3}, {fourthSpec: 4}], plugin: {name: 'extension-spec-2'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await getListOfExtensionSpecs(config)

    // Then
    expect(got).toEqual([{firstSpec: 1}, {secondSpec: 2}, {thirdSpec: 3}, {fourthSpec: 4}])
  })
})

describe('getListOfExtensionPoints', () => {
  test('returns empty list when there are no extension points', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await getListOfExtensionPoints(config)

    // Then
    expect(got).toEqual([])
  })

  test('returns list of extension points', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: [{firstPoint: 1}, {secondPoint: 2}], plugin: {name: 'extension-point'}},
        {result: [{thirdPoint: 3}, {fourthPoint: 4}], plugin: {name: 'extension-point-2'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await getListOfExtensionPoints(config)

    // Then
    expect(got).toEqual([{firstPoint: 1}, {secondPoint: 2}, {thirdPoint: 3}, {fourthPoint: 4}])
  })
})

describe('getListOfFunctionSpecs', () => {
  test('returns empty list when there are no function specs', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await getListOfFunctionSpecs(config)

    // Then
    expect(got).toEqual([])
  })

  test('returns list of function specs', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: [{firstSpec: 1}, {secondSpec: 2}], plugin: {name: 'function-spec'}},
        {result: [{thirdSpec: 3}, {fourthSpec: 4}], plugin: {name: 'function-spec-2'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await getListOfFunctionSpecs(config)

    // Then
    expect(got).toEqual([{firstSpec: 1}, {secondSpec: 2}, {thirdSpec: 3}, {fourthSpec: 4}])
  })
})
