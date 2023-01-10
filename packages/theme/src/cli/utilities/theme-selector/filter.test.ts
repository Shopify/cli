import {Filter, filterThemes} from './filter.js'
import {Theme} from '../../models/theme.js'
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
    expect(filtered[0]!.name).toBe('theme 3')
  })

  test('filters the development theme', async () => {
    // Given
    const filter = new Filter({
      development: true,
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme 7')
  })

  test.skip('filters the correct development theme', async () => {
    /**
     * Implement the logic to diferenciate development themes
     * based on the local "development_theme_id".
     *
     * Currently, the CLI2 creates development themes and only
     * at the CLI2 level is possible to difernciate a development
     * theme associated with the current machine.
     *
     * Thus, currently, this filter just returnes the first development
     * theme, but it should return the develipment theme associented
     * with the host enviomento of the CLI3.
     *
     * As soon as the development gets created at the CLI3 level
     * this issue must be fixed.
     */
  })

  test('filters by indentifier (name)', async () => {
    // Given
    const filter = new Filter({
      identifier: 'theme 7',
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme 7')
  })

  test('filters by indentifier (ID)', async () => {
    // Given
    const filter = new Filter({
      identifier: '5',
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme 5')
  })

  test('filters by indentifiers', async () => {
    // Given
    const filter = new Filter({
      identifiers: ['theme 3', '5'],
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(2)
    expect(filtered[0]!.name).toBe('theme 3')
    expect(filtered[1]!.name).toBe('theme 5')
  })
})

function theme(id: number, role: string) {
  return {id, role, name: `theme ${id}`} as Theme
}
