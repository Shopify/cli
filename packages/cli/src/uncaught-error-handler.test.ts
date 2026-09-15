import {renderUncaughtError} from './uncaught-error-handler.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

const mocks = vi.hoisted(() => {
  class FatalError extends Error {}

  return {
    FatalError,
    handler: vi.fn(),
    jsonOutputEnabled: vi.fn(),
    renderFatalError: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/environment', () => ({jsonOutputEnabled: mocks.jsonOutputEnabled}))
vi.mock('@shopify/cli-kit/node/error', () => ({FatalError: mocks.FatalError, handler: mocks.handler}))
vi.mock('@shopify/cli-kit/node/ui', () => ({renderFatalError: mocks.renderFatalError}))

beforeEach(() => {
  mocks.handler.mockReset()
  mocks.jsonOutputEnabled.mockReset()
  mocks.renderFatalError.mockReset()
})

describe('renderUncaughtError', () => {
  test('uses the shared error handler for JSON output', async () => {
    const error = new Error('Unexpected failure')
    mocks.jsonOutputEnabled.mockReturnValue(true)

    await renderUncaughtError(error)

    expect(mocks.handler).toHaveBeenCalledWith(error)
    expect(mocks.renderFatalError).not.toHaveBeenCalled()
  })

  test('preserves fatal error banners outside JSON output', async () => {
    const error = new mocks.FatalError('Expected failure')
    mocks.jsonOutputEnabled.mockReturnValue(false)

    await renderUncaughtError(error)

    expect(mocks.renderFatalError).toHaveBeenCalledWith(error)
    expect(mocks.handler).not.toHaveBeenCalled()
  })
})
