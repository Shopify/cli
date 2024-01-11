import {Filter, filterThemes} from './filter.js'
import {Theme} from '@shopify/cli-kit/node/themes/models/theme'
import {test, describe, expect} from 'vitest'

const store = 'my-shop.myshopify.com'

const themes = [
  theme(1, 'unpublished'),
  theme(2, 'unpublished'),
  theme(3, 'live'),
  theme(4, 'unpublished'),
  theme(5, 'unpublished'),
  theme(6, 'unpublished'),
  theme(7, 'development'),
  theme(8, 'development'),
]

describe('filterThemes', () => {
  test('filters the live theme', async () => {
    // Given
    const filter = new Filter({
      live: true,
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme (3)')
  })

  test('filters by role', async () => {
    // Given
    const filter = new Filter({
      development: true,
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(2)
    expect(filtered[0]!.name).toBe('theme (7)')
    expect(filtered[1]!.name).toBe('theme (8)')
  })

  test('does not filter by theme if role filter is provided', async () => {
    // Given
    const developmentFilter = new Filter({
      development: true,
      themes: ['4', '5'],
    })

    const liveFilter = new Filter({
      live: true,
      themes: ['4', '5'],
    })

    // When
    const filteredDevelopmentThemes = filterThemes(store, themes, developmentFilter)
    const filteredLiveThemes = filterThemes(store, themes, liveFilter)

    // Then
    expect(filteredDevelopmentThemes).toHaveLength(2)
    expect(filteredDevelopmentThemes[0]!.name).toBe('theme (7)')
    expect(filteredDevelopmentThemes[0]!.role).toBe('development')
    expect(filteredDevelopmentThemes[1]!.name).toBe('theme (8)')
    expect(filteredDevelopmentThemes[0]!.role).toBe('development')

    expect(filteredLiveThemes).toHaveLength(1)
    expect(filteredLiveThemes[0]!.name).toBe('theme (3)')
    expect(filteredLiveThemes[0]!.role).toBe('live')
  })

  test('filters by theme (exact name)', async () => {
    // Given
    const filter = new Filter({
      theme: 'theme (7)',
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme (7)')
  })

  test('filters by theme (partial name with different case)', async () => {
    // Given
    const filter = new Filter({
      theme: 'eMe (7',
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme (7)')
  })

  test('filters by theme (ID)', async () => {
    // Given
    const filter = new Filter({
      theme: '5',
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme (5)')
  })

  test('filters by themes', async () => {
    // Given
    const filter = new Filter({
      themes: ['theme (3)', '5'],
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(2)
    expect(filtered[0]!.name).toBe('theme (3)')
    expect(filtered[1]!.name).toBe('theme (5)')
  })
})

describe('Filter#any', () => {
  const filterProps = {
    themes: undefined,
    theme: undefined,
    development: false,
    live: false,
  }

  test('returns true when development filter is specified', async () => {
    // Given
    const filter = new Filter({...filterProps, development: true})

    // When
    const result = filter.any()

    // Then
    expect(result).toBeTruthy()
  })

  test('returns true when live filter is specified', async () => {
    // Given
    const filter = new Filter({...filterProps, live: true})

    // When
    const result = filter.any()

    // Then
    expect(result).toBeTruthy()
  })

  test('returns true when theme filter is specified', async () => {
    // Given
    const filter = new Filter({...filterProps, theme: '1'})

    // When
    const result = filter.any()

    // Then
    expect(result).toBeTruthy()
  })

  test('returns true when themes filter is specified', async () => {
    // Given
    const filter = new Filter({...filterProps, themes: ['1']})

    // When
    const result = filter.any()

    // Then
    expect(result).toBeTruthy()
  })

  test('returns false when themes filter is empty', async () => {
    // Given
    const filter = new Filter({...filterProps, themes: []})

    // When
    const result = filter.any()

    // Then
    expect(result).toBeFalsy()
  })

  test('returns false when no filter is specified', async () => {
    // Given
    const filter = new Filter(filterProps)

    // When
    const result = filter.any()

    // Then
    expect(result).toBeFalsy()
  })
})

function theme(id: number, role: string) {
  return {id, role, name: `theme (${id})`} as Theme
}
