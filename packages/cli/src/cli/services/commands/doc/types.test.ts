import {docFetchJsonOutputSchema, docSearchJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const document = {url: 'https://shopify.dev/docs', content: ''}
const entry = {score: 0, content: '', url: 'https://shopify.dev/docs', title: 'Docs', domain: null}

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

  test.each([true, false, null])('encodes public search data with hasNextPage=%s', (hasNextPage) => {
    const result = {results: [entry, {...entry, score: 0.99, domain: 'admin'}], pageInfo: {hasNextPage}}
    expect(JSON.parse(docSearchJsonOutputSchema.encode(result))).toEqual(result)
    expect(JSON.parse(docSearchJsonOutputSchema.encode({results: [], pageInfo: {hasNextPage}}))).toEqual({
      results: [],
      pageInfo: {hasNextPage},
    })
  })

  test('rejects a bare collection result', () => {
    expect(() => docSearchJsonOutputSchema.validate([])).toThrow()
  })

  test.each([
    {...entry, score: '0'},
    {...entry, score: Infinity},
    {...entry, url: 'invalid'},
    {...entry, content: null},
    {...entry, title: false},
    {...entry, domain: undefined},
    {...entry, internal: true},
  ])('rejects an invalid search entry: %j', (result) => {
    expect(() => docSearchJsonOutputSchema.validate({results: [result], pageInfo: {hasNextPage: null}})).toThrow()
  })

  test.each([
    {results: [], pageInfo: {hasNextPage: 'unknown'}},
    {results: [], pageInfo: {hasNextPage: null, cursor: 'invented'}},
    {results: [], pageInfo: {hasNextPage: null}, body: '[]'},
    {invalidArray: []},
    null,
  ])('rejects an invalid search wrapper: %j', (result) => {
    expect(() => docSearchJsonOutputSchema.validate(result)).toThrow()
  })
})
