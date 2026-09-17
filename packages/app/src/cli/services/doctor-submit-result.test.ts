import {doctorSubmitFailure} from './doctor-submit-result.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {FetchError} from '@shopify/cli-kit/node/http'
import {describe, expect, test} from 'vitest'

describe('doctorSubmitFailure', () => {
  test('retains the stage and expected error help as semantic data', () => {
    const error = new AbortError('Upload failed', 'Try again.', ['Check your connection.'])

    expect(doctorSubmitFailure(error, 'upload')).toEqual({
      status: 'failed',
      error: {
        stage: 'upload',
        message: 'Upload failed',
        tryMessage: 'Try again.',
        nextSteps: ['Check your connection.'],
      },
    })
  })

  test('normalizes transport failures without leaking request details or inventing API response state', () => {
    const error = new FetchError('request to https://storage.test/?secret=token failed', 'system', {code: 'ECONNRESET'})

    expect(doctorSubmitFailure(error, 'upload')).toEqual({
      status: 'failed',
      error: {
        stage: 'upload',
        message: 'A network error interrupted the App Doctor submission.',
        tryMessage: 'Check your network connection and try submitting the App Doctor results again.',
      },
    })
  })

  test.each([
    new Error('Unexpected failure'),
    new TypeError('Unexpected type'),
    Object.assign(new Error('Not a transport error'), {name: 'FetchError'}),
  ])('does not classify unknown errors by name: %s', (error) => {
    expect(doctorSubmitFailure(error, 'preparation')).toBeUndefined()
  })

  test('does not invent API response state for local errors', () => {
    const result = doctorSubmitFailure(new AbortError('Missing trace'), 'preparation')

    expect(result?.error).not.toHaveProperty('accepted')
    expect(result?.error).not.toHaveProperty('userErrors')
  })
})
