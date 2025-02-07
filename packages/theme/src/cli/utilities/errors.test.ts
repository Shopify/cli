import {
  renderThrownError,
  createSyncingCatchError,
  createAbortCatchError,
  createFetchError,
  extractFetchErrorInfo,
} from './errors.js'
import {describe, test, expect, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

describe('errors', () => {
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

  describe('renderThrownError', () => {
    test('renders AbortError with fatal error UI', () => {
      const error = new AbortError('test error')
      renderThrownError('Test Headline', error)

      expect(renderFatalError).toHaveBeenCalledWith(expect.objectContaining({message: `Test Headline\n`}))
    })

    test('renders regular Error with error UI and debug output', () => {
      const error = new Error('test error')
      error.stack = 'test stack'
      renderThrownError('Test Headline', error)

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Test Headline',
        body: 'test error',
      })
    })
  })

  describe('createSyncingCatchError', () => {
    test('creates error handler for delete preset', () => {
      const handler = createSyncingCatchError('test.liquid', 'delete')
      const error = new Error('test error')

      handler(error)

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Failed to delete file "test.liquid" from remote theme.',
        body: 'test error',
      })
    })

    test('creates error handler for upload preset', () => {
      const handler = createSyncingCatchError('test.liquid', 'upload')
      const error = new Error('test error')

      handler(error)

      expect(renderError).toHaveBeenCalledWith({
        headline: expect.stringMatching(/failed to upload/i),
        body: 'test error',
      })
    })

    test('creates error handler with custom headline', () => {
      const handler = createSyncingCatchError('Custom Headline')
      const error = new Error('test error')

      handler(error)

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Custom Headline',
        body: 'test error',
      })
    })
  })

  describe('createAbortCatchError', () => {
    test('creates error handler that exits process', () => {
      const handler = createAbortCatchError('Test Headline')
      const error = new Error('test error')

      handler(error)

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Test Headline',
        body: 'test error',
      })
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('createFetchError', () => {
    test('creates FetchError from Response-like object', () => {
      const response = new Response('test error', {
        status: 404,
        statusText: 'Not Found',
        headers: {'x-request-id': 'test-id'},
      })

      const responseUrl = 'https://test.com'
      Object.defineProperty(response, 'url', {value: responseUrl})

      expect(createFetchError(response)).toMatchObject({
        statusCode: response.status,
        statusMessage: response.statusText,
        data: {
          url: responseUrl,
          requestId: response.headers.get('x-request-id'),
        },
      })
    })

    test('creates FetchError with defaults for missing properties', () => {
      expect(createFetchError(new Error('test error'), 'https://error.com')).toMatchObject({
        statusCode: 502,
        statusMessage: 'Bad Gateway',
        cause: expect.any(Error),
        data: {url: 'https://error.com', requestId: undefined},
      })
    })
  })

  describe('extractFetchErrorInfo', () => {
    test('extracts info from FetchError with all properties', () => {
      const fetchError = createFetchError({
        status: 404,
        statusText: 'Not Found',
        url: 'https://test.com',
        headers: new Headers({'x-request-id': 'test-id'}),
      })

      expect(extractFetchErrorInfo(fetchError, 'Test context')).toMatchObject({
        headline: expect.stringContaining('Test context'),
        status: 404,
        statusText: 'Not Found',
        requestId: 'test-id',
        url: 'https://test.com',
      })
    })

    test('extracts info with defaults for regular Error', () => {
      const error = new Error('test error')
      const info = extractFetchErrorInfo(error)

      expect(info.headline).toBe('Unexpected error during fetch with status 502 (Bad Gateway).')
      expect(info.status).toBe(502)
      expect(info.statusText).toBe('Bad Gateway')
      expect(info.body).toBe(error.stack)
    })
  })
})
