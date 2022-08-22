import {healthCheck, ping} from './deployer.js'
import {retryOnError} from './error.js'
import {beforeEach, describe, it, expect, vi} from 'vitest'
import {http, output} from '@shopify/cli-kit'

beforeEach(() => {
  vi.mock('@shopify/cli-kit')
  vi.mock('./error.js', async () => {
    const module: any = await vi.importActual('./error.js')
    return {
      ...module,
      retryOnError: vi.fn(),
    }
  })
})

describe('ping()', () => {
  it('succeeds on https status 200', async () => {
    const pingUrl = 'https://unit.test'
    const fetch = vi.fn().mockResolvedValueOnce({status: 200})
    vi.mocked(http.fetch).mockImplementation(fetch)

    const result = await ping(pingUrl)

    expect(result).toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(pingUrl, {method: 'GET'})
  })

  it('throws on any other https status', async () => {
    const pingUrl = 'https://unit.test'
    const fetch = vi.fn().mockResolvedValueOnce({status: 404})
    vi.mocked(http.fetch).mockImplementation(fetch)

    await expect(ping(pingUrl)).rejects.toThrowError()
    expect(fetch).toHaveBeenCalledWith(pingUrl, {method: 'GET'})
  })
})

describe('healthCheck()', () => {
  it("calls retryOnError, succeeds if doesn't throw", async () => {
    const mockedRetryOnError = vi.fn().mockResolvedValue(true)
    vi.mocked(retryOnError).mockImplementation(mockedRetryOnError)
    const mockedOutput = vi.fn()
    vi.mocked(output.success).mockImplementation(mockedOutput)

    const result = await healthCheck('')

    expect(result).toBeUndefined()
    expect(mockedRetryOnError).toHaveBeenCalledOnce()
    expect(mockedOutput).toHaveBeenCalledOnce()
  })
  it('calls retryOnError, fails if error thrown', async () => {
    const mockedRetryOnError = vi.fn().mockImplementation(async () => {
      throw new Error()
    })
    vi.mocked(retryOnError).mockImplementation(mockedRetryOnError)
    const mockedOutput = vi.fn()
    vi.mocked(output.success).mockImplementation(mockedOutput)

    const result = await healthCheck('')

    expect(result).toBeUndefined()
    expect(mockedRetryOnError).toHaveBeenCalledOnce()
    expect(mockedOutput).not.toHaveBeenCalled()
  })
})
