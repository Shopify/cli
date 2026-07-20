import {parseAssistantReportResponse} from './parse.js'
import {describe, expect, test} from 'vitest'

describe('parseAssistantReportResponse', () => {
  test('parses a plain JSON response', () => {
    const parsed = parseAssistantReportResponse(
      '{"api": "shopifyql", "query": "FROM sales SHOW total_sales", "rationale": "sales trend"}',
    )

    expect(parsed).toEqual({api: 'shopifyql', query: 'FROM sales SHOW total_sales', rationale: 'sales trend'})
  })

  test('parses a response wrapped in a markdown code fence', () => {
    const parsed = parseAssistantReportResponse(
      ['Here is the query:', '```json', '{"api": "admin", "query": "{ shop { name } }"}', '```'].join('\n'),
    )

    expect(parsed).toEqual({api: 'admin', query: '{ shop { name } }', rationale: ''})
  })

  test('defaults rationale to an empty string when omitted', () => {
    const parsed = parseAssistantReportResponse('{"api": "admin", "query": "{ shop { name } }"}')

    expect(parsed.rationale).toBe('')
  })

  test('extracts the first balanced JSON object even when the query value contains braces', () => {
    const parsed = parseAssistantReportResponse(
      '{"api": "admin", "query": "{ shop { name metafield(namespace: \\"x\\") { value } } }", "rationale": ""}',
    )

    expect(parsed.query).toBe('{ shop { name metafield(namespace: "x") { value } } }')
  })

  test('extracts JSON when a string value ends in an escaped trailing backslash', () => {
    // An even run of backslashes right before the closing quote (`path\\"`) must not be mistaken
    // for an escaped quote — the string, and therefore the object, does actually close there.
    const query = 'query { shop { name } } # path\\'
    const raw = JSON.stringify({api: 'admin', query, rationale: 'x'})

    const parsed = parseAssistantReportResponse(raw)

    expect(parsed.query).toBe(query)
  })

  test('throws an AbortError when the response contains no JSON object', () => {
    expect(() => parseAssistantReportResponse('Sorry, I cannot help with that.')).toThrow(
      'The assistant did not reply with a valid report query.',
    )
  })

  test('throws an AbortError when the JSON is malformed', () => {
    expect(() => parseAssistantReportResponse('{"api": "admin", "query": }')).toThrow(
      'The assistant did not reply with a valid report query.',
    )
  })

  test('throws an AbortError when the api field is not a recognized value', () => {
    expect(() => parseAssistantReportResponse('{"api": "bogus", "query": "FROM sales SHOW total_sales"}')).toThrow(
      'The assistant did not reply with a valid report query.',
    )
  })

  test('throws an AbortError when the query field is missing or blank', () => {
    expect(() => parseAssistantReportResponse('{"api": "admin", "query": "  "}')).toThrow(
      'The assistant did not reply with a valid report query.',
    )
  })
})
