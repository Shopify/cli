import {loadUIExtensionSpecificationsFromPlugins} from '../../private/plugins/extension.js'
import {Config} from '@oclif/core'
import {describe, test, vi, expect} from 'vitest'

describe('getListOfExtensionSpecs', () => {
  test('returns empty list when there are no extension specs', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await loadUIExtensionSpecificationsFromPlugins(config)

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
    const got = await loadUIExtensionSpecificationsFromPlugins(config)

    // Then
    expect(got).toEqual([{firstSpec: 1}, {secondSpec: 2}, {thirdSpec: 3}, {fourthSpec: 4}])
  })
})
