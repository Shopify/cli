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
    /**
     * TODO: Return _your_ development theme.
     *
     * CLI2 creates the development theme and persists the ID
     * on a PStore file. Thus, only the CLI2 can differentiate
     * between _your_ development theme and the others.
     *
     * Currently, this filter just returns all development
     * themes, but it should only return _yours_.
     *
     * As soon as the development gets created at the CLI3 level
     * this issue must be fixed.
     */

    // Given
    const filter = new Filter({
      development: true,
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(2)
    expect(filtered[0]!.name).toBe('theme 7')
    expect(filtered[1]!.name).toBe('theme 8')
  })

  test('filters by theme (exact name)', async () => {
    // Given
    const filter = new Filter({
      theme: 'theme 7',
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme 7')
  })

  test('filters by theme (partial name with different case)', async () => {
    // Given
    const filter = new Filter({
      theme: 'eMe 7',
    })

    // When
    const filtered = filterThemes(store, themes, filter)

    // Then
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.name).toBe('theme 7')
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
    expect(filtered[0]!.name).toBe('theme 5')
  })

  test('filters by themes', async () => {
    // Given
    const filter = new Filter({
      themes: ['theme 3', '5'],
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
