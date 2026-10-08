import {docFetchJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const document = {url: 'https://shopify.dev/docs', content: ''}

describe('documentation JSON schemas', () => {
  test('encodes a document, including empty Markdown', () => {
    expect(JSON.parse(docFetchJsonOutputSchema.encode({document}))).toEqual({document})
  })

  test.each(['/tmp/doc.md', 'C:\\docs\\doc.md', '\\\\server\\docs\\doc.md'])(
    'encodes an absolute file receipt: %s',
    (path) => {
      expect(JSON.parse(docFetchJsonOutputSchema.encode({path, format: 'markdown'}))).toEqual({
        path,
        format: 'markdown',
      })
    },
  )

  test.each([
    {document: {...document, url: 'invalid'}},
    {document: {...document, content: null}},
    {document: {...document, internal: true}},
    {document, extra: true},
    {path: 'docs/doc.md', format: 'markdown'},
    {path: '/tmp/doc.md', format: 'json'},
    {path: '/tmp/doc.md', format: 'markdown', document},
  ])('rejects an invalid fetch result: %j', (result) => {
    expect(() => docFetchJsonOutputSchema.validate(result)).toThrow()
  })
})
