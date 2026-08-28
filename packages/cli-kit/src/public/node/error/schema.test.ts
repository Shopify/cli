import {jsonErrorOutputSchema} from './schema.js'
import {describe, expect, test} from 'vitest'
import {Ajv} from 'ajv'

describe('JSON error output schema', () => {
  test('documents and validates every fatal JSON error type', () => {
    const validate = new Ajv().compile(jsonErrorOutputSchema.jsonSchema)
    for (const error of [
      {type: 'abort', message: 'Expected failure'},
      {type: 'bug', message: 'Unexpected failure'},
      {type: 'external', message: 'Command failed', command: 'npm', args: ['install']},
    ]) {
      expect(validate({error})).toBe(true)
    }
    expect(validate({error: {type: 'unknown', message: 'Failed'}})).toBe(false)
    expect(validate({error: {type: 'external', message: 'Failed'}})).toBe(false)

    expect(jsonErrorOutputSchema.validate({error: {type: 'abort', message: 'Expected failure'}})).toEqual({
      error: {type: 'abort', message: 'Expected failure'},
    })
  })

  test('rejects an invalid fatal JSON error', () => {
    expect(() => jsonErrorOutputSchema.validate({error: {type: 'external', message: 'Failed'}})).toThrow()
  })

  test.each([
    {type: 'abort' as const},
    {type: 'bug' as const},
    {type: 'external' as const, command: 'npm', args: ['install']},
  ])('supports selected structured details on $type errors', (variant) => {
    const document = {
      error: {...variant, message: 'Failed', details: {errors: [{message: 'Invalid field', code: 'UNDEFINED_FIELD'}]}},
    }

    expect(jsonErrorOutputSchema.validate(document)).toEqual(document)
    expect(JSON.parse(jsonErrorOutputSchema.encode(document))).toEqual(document)
    expect(new Ajv().compile(jsonErrorOutputSchema.jsonSchema)(document)).toBe(true)
  })
})
