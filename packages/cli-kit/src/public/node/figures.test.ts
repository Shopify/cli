import figures from './figures.js'
import {describe, expect, test} from 'vitest'

describe('figures', () => {
  test('exports figures as default', () => {
    // Given/When/Then
    expect(figures).toBeDefined()
    expect(typeof figures).toBe('object')
  })

  test('includes common figure characters', () => {
    // Given/When/Then - figures package provides these characters
    expect(figures).toHaveProperty('tick')
    expect(figures).toHaveProperty('cross')
    expect(figures).toHaveProperty('warning')
    expect(figures).toHaveProperty('info')
    expect(typeof figures.tick).toBe('string')
    expect(typeof figures.cross).toBe('string')
  })

  test('figures have consistent structure', () => {
    // Given/When/Then
    expect(figures).not.toBeNull()
    expect(Array.isArray(figures)).toBe(false)

    // Verify it's an object with string properties
    const figureEntries = Object.entries(figures)
    expect(figureEntries.length).toBeGreaterThan(0)

    figureEntries.forEach(([key, value]) => {
      expect(typeof key).toBe('string')
      expect(typeof value).toBe('string')
    })
  })
})
