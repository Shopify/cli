import {jsonErrorOutputSchema} from './schema.js'
import {describe, expect, test} from 'vitest'

describe('JSON error output schema', () => {
  test('documents and validates every fatal JSON error type', () => {
    expect(jsonErrorOutputSchema.typescript).toContain(
      'type JsonError = JsonAbortError | JsonBugError | JsonExternalError',
    )
    expect(jsonErrorOutputSchema.typescript).toContain('interface JsonAbortError')
    expect(jsonErrorOutputSchema.typescript).toContain('interface JsonBugError')
    expect(jsonErrorOutputSchema.typescript).toContain('interface JsonExternalError')

    expect(jsonErrorOutputSchema.validate({error: {type: 'abort', message: 'Expected failure'}})).toEqual({
      error: {type: 'abort', message: 'Expected failure'},
    })
  })

  test('rejects an invalid fatal JSON error', () => {
    expect(() => jsonErrorOutputSchema.validate({error: {type: 'external', message: 'Failed'}})).toThrow()
  })
})
