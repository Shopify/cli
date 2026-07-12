import {renderMarkdown} from './markdown.js'
import {describe, expect, test} from 'vitest'

describe('renderMarkdown', () => {
  test('renders bold text with ANSI styling', () => {
    const rendered = renderMarkdown('**important**')

    expect(rendered).toContain('\u001b[')
    expect(rendered).toContain('important')
  })

  test('renders headings, lists, and code blocks without throwing', () => {
    const markdown = `# Heading

- one
- two

\`\`\`bash
shopify app dev
\`\`\`
`

    expect(() => renderMarkdown(markdown)).not.toThrow()
    const rendered = renderMarkdown(markdown)
    expect(rendered).toContain('Heading')
    expect(rendered).toContain('shopify app dev')
  })

  test('renders bold, italic, and links nested inside a tight list item', () => {
    // Tight list items (no blank line between them) lex to block-level "text" tokens
    // rather than "paragraph" tokens. marked-terminal's own renderer only returns those
    // tokens' raw source text, dropping any inline styling within them — this covers the
    // fix that renders their nested inline tokens instead.
    const rendered = renderMarkdown('- **bold** and *italic* and [a link](https://example.com)\n- another item\n')

    expect(rendered).not.toContain('**bold**')
    expect(rendered).not.toContain('*italic*')
    expect(rendered).not.toContain('[a link](https://example.com)')
    expect(rendered).toContain('bold')
    expect(rendered).toContain('italic')
    expect(rendered).toContain('a link')
    expect(rendered).toContain('\u001b[')
  })

  test('renders an empty string for empty input', () => {
    expect(renderMarkdown('').trim()).toBe('')
  })

  test('tolerates unterminated Markdown constructs, as happens mid-stream', () => {
    expect(() => renderMarkdown('Some **bold text that never closes')).not.toThrow()
  })
})
