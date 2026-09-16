import {getErrorPage} from './error-page.js'
import {describe, expect, test} from 'vitest'

describe('getErrorPage', () => {
  test('renders the title and header', () => {
    const page = getErrorPage({title: 'Failed to render', header: 'Liquid syntax error', errors: []})

    expect(page).toContain('<title>Failed to render</title>')
    expect(page).toContain('Liquid syntax error')
  })

  test('renders the message and code of every error', () => {
    const page = getErrorPage({
      title: 'Failed to render',
      header: 'Liquid syntax error',
      errors: [
        {message: 'Unknown tag', code: 'sections/header.liquid:12'},
        {message: 'Unclosed block', code: 'sections/footer.liquid:3'},
      ],
    })

    expect(page).toContain('Unknown tag')
    expect(page).toContain('sections/header.liquid:12')
    expect(page).toContain('Unclosed block')
    expect(page).toContain('sections/footer.liquid:3')
  })

  test('escapes HTML in error messages and codes so untrusted content cannot inject markup', () => {
    const page = getErrorPage({
      title: 'Failed to render',
      header: 'Liquid syntax error',
      errors: [{message: '<script>alert("xss")</script>', code: "it's <b>here</b> & broken"}],
    })

    expect(page).not.toContain('<script>alert')
    expect(page).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(page).toContain('it&#039;s &lt;b&gt;here&lt;/b&gt; &amp; broken')
  })

  test('returns a complete document when there are no errors', () => {
    const page = getErrorPage({title: 'Failed to render', header: 'Liquid syntax error', errors: []})

    expect(page).toMatch(/^<!DOCTYPE html>/)
    expect(page).toContain('</html>')
  })
})
