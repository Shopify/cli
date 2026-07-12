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

  test('renders an empty string for empty input', () => {
    expect(renderMarkdown('').trim()).toBe('')
  })

  test('tolerates unterminated Markdown constructs, as happens mid-stream', () => {
    expect(() => renderMarkdown('Some **bold text that never closes')).not.toThrow()
  })
})
