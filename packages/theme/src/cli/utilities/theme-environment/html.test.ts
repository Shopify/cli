import {getErrorOverlay, injectErrorIntoHtml} from './hot-reload/error-overlay.js'
import {describe, expect, test} from 'vitest'

describe('html', () => {
  test('injects error overlay into HTML', () => {
    // Given
    const html = '<html><head></head><body><div>content</div></body></html>'
    const errors = new Map([
      ['assets/theme.css', ['Syntax error in line 10']],
      ['sections/header.liquid', ['Missing end tag', 'Invalid liquid syntax']],
    ])

    // When
    const result = injectErrorIntoHtml(html, errors)

    // Then
    const overlay = getErrorOverlay(errors)
    expect(result).toBe(html + overlay)
    expect(result).toContain('assets/theme.css')
    expect(result).toContain('Syntax error in line 10')
    expect(result).toContain('sections/header.liquid')
    expect(result).toContain('Missing end tag')
    expect(result).toContain('Invalid liquid syntax')
  })

  test('preserves original HTML content', () => {
    // Given
    const html = '<html><head><title>My Store</title></head><body><div>content</div></body></html>'
    const errors = new Map([['file.css', ['Error']]])

    // When
    const result = injectErrorIntoHtml(html, errors)

    // Then
    const overlay = getErrorOverlay(errors)
    expect(result).toBe(html + overlay)
    expect(result).toContain('<title>My Store</title>')
    expect(result).toContain('<div>content</div>')
  })
})
