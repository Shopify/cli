import {trustChallengeUrl, withTrustChallengeRetry} from './trust-challenge.js'
import {GraphQLClientError} from '../api/headers.js'
import {recordEvent} from '../../../public/node/analytics.js'
import {adminFqdn} from '../../../public/node/context/fqdn.js'
import {AbortError} from '../../../public/node/error.js'
import {isCI, openURL} from '../../../public/node/system.js'
import {isTTY, keypress, renderInfo} from '../../../public/node/ui.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {ClientError} from 'graphql-request'

vi.mock('../../../public/node/analytics.js')
vi.mock('../../../public/node/context/fqdn.js')
vi.mock('../../../public/node/output.js')
vi.mock('../../../public/node/system.js')
vi.mock('../../../public/node/ui.js')

const challengeUrl = 'https://admin.shopify.com/challenges/user_verification?token=abc'

beforeEach(() => {
  vi.mocked(adminFqdn).mockResolvedValue('admin.shopify.com')
  vi.mocked(isCI).mockReturnValue(false)
  vi.mocked(isTTY).mockReturnValue(true)
  vi.mocked(openURL).mockResolvedValue(true)
  vi.mocked(keypress).mockResolvedValue(undefined)
})

describe('trustChallengeUrl', () => {
  test('returns the redirect URL from a CHALLENGE_REQUIRED graphql-request ClientError', async () => {
    const error = challengeClientError(challengeUrl)

    await expect(trustChallengeUrl(error)).resolves.toBe(challengeUrl)
  })

  test('returns the redirect URL from a CHALLENGE_REQUIRED cli-kit GraphQLClientError', async () => {
    const error = new GraphQLClientError('Challenge Required', 200, [
      {message: 'Challenge Required', extensions: {code: 'CHALLENGE_REQUIRED', redirect_to: challengeUrl}},
    ])

    await expect(trustChallengeUrl(error)).resolves.toBe(challengeUrl)
  })

  test('returns undefined for a GraphQL error with a different code', async () => {
    const error = new ClientError(
      {status: 200, errors: [{message: 'Access denied', extensions: {code: 'ACCESS_DENIED'}} as any]},
      {query: ''},
    )

    await expect(trustChallengeUrl(error)).resolves.toBeUndefined()
  })

  test('returns undefined when the redirect URL is not on the Admin host', async () => {
    const error = challengeClientError('https://evil.example.com/challenges/user_verification?token=abc')

    await expect(trustChallengeUrl(error)).resolves.toBeUndefined()
  })

  test('returns undefined when the redirect URL is not https', async () => {
    const error = challengeClientError('http://admin.shopify.com/challenges/user_verification?token=abc')

    await expect(trustChallengeUrl(error)).resolves.toBeUndefined()
  })

  test('returns undefined when the redirect URL is missing', async () => {
    const error = new ClientError(
      {status: 200, errors: [{message: 'Challenge Required', extensions: {code: 'CHALLENGE_REQUIRED'}} as any]},
      {query: ''},
    )

    await expect(trustChallengeUrl(error)).resolves.toBeUndefined()
  })

  test('returns undefined for an error that is not a GraphQL client error', async () => {
    await expect(trustChallengeUrl(new Error('boom'))).resolves.toBeUndefined()
  })

  test('accepts the local Admin host when the CLI targets a local environment', async () => {
    vi.mocked(adminFqdn).mockResolvedValue('admin.shop.dev')
    const localChallengeUrl = 'https://admin.shop.dev/challenges/user_verification?token=abc'

    await expect(trustChallengeUrl(challengeClientError(localChallengeUrl))).resolves.toBe(localChallengeUrl)
  })
})

describe('withTrustChallengeRetry', () => {
  test('returns the result of a request that succeeds without a challenge', async () => {
    const request = vi.fn().mockResolvedValue('ok')

    await expect(withTrustChallengeRetry(request)).resolves.toBe('ok')

    expect(request).toHaveBeenCalledTimes(1)
    expect(openURL).not.toHaveBeenCalled()
    expect(keypress).not.toHaveBeenCalled()
  })

  test('rethrows an error that is not a trust challenge without prompting', async () => {
    const error = new Error('boom')
    const request = vi.fn().mockRejectedValue(error)

    await expect(withTrustChallengeRetry(request)).rejects.toBe(error)

    expect(request).toHaveBeenCalledTimes(1)
    expect(openURL).not.toHaveBeenCalled()
  })

  test('opens the challenge URL, waits for a keypress, then retries the request once', async () => {
    const request = vi.fn().mockRejectedValueOnce(challengeClientError(challengeUrl)).mockResolvedValueOnce('retried')

    await expect(withTrustChallengeRetry(request)).resolves.toBe('retried')

    expect(request).toHaveBeenCalledTimes(2)
    expect(openURL).toHaveBeenCalledWith(challengeUrl)
    expect(keypress).toHaveBeenCalledTimes(1)
    expect(renderInfo).toHaveBeenCalledWith(expect.objectContaining({headline: 'Verify your identity to continue.'}))
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:required')
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:browser-opened')
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:acknowledged')
  })

  test('renders a link to the challenge URL when the browser cannot be opened', async () => {
    vi.mocked(openURL).mockResolvedValue(false)
    const request = vi.fn().mockRejectedValueOnce(challengeClientError(challengeUrl)).mockResolvedValueOnce('retried')

    await withTrustChallengeRetry(request)

    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({link: {label: 'Open the verification page', url: challengeUrl}}),
    )
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:browser-not-opened')
  })

  test('aborts with the challenge URL when the retried request is challenged again', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(challengeClientError(challengeUrl))
      .mockRejectedValueOnce(challengeClientError(challengeUrl))

    const promise = withTrustChallengeRetry(request)

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toMatchObject({
      nextSteps: [expect.arrayContaining([{link: {url: challengeUrl}}])],
    })
    expect(request).toHaveBeenCalledTimes(2)
    expect(keypress).toHaveBeenCalledTimes(1)
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:retry-challenged')
  })

  test('rethrows a non-challenge error from the retried request unchanged', async () => {
    const retryError = new Error('boom')
    const request = vi.fn().mockRejectedValueOnce(challengeClientError(challengeUrl)).mockRejectedValueOnce(retryError)

    await expect(withTrustChallengeRetry(request)).rejects.toBe(retryError)

    expect(request).toHaveBeenCalledTimes(2)
  })

  test('aborts with the challenge URL in the next steps when running in CI', async () => {
    vi.mocked(isCI).mockReturnValue(true)
    const request = vi.fn().mockRejectedValue(challengeClientError(challengeUrl))

    const promise = withTrustChallengeRetry(request)

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toMatchObject({
      nextSteps: [expect.arrayContaining([{link: {url: challengeUrl}}])],
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(openURL).not.toHaveBeenCalled()
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:non-interactive')
  })

  test('aborts instead of prompting when stdin is not a TTY', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    const request = vi.fn().mockRejectedValue(challengeClientError(challengeUrl))

    await expect(withTrustChallengeRetry(request)).rejects.toBeInstanceOf(AbortError)

    expect(keypress).not.toHaveBeenCalled()
  })

  test('shares a single prompt across concurrent requests that are challenged together', async () => {
    let resolveKeypress!: () => void
    vi.mocked(keypress).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveKeypress = resolve
      }) as Promise<unknown>,
    )
    const firstRequest = vi
      .fn()
      .mockRejectedValueOnce(challengeClientError(challengeUrl))
      .mockResolvedValueOnce('first')
    const secondRequest = vi
      .fn()
      .mockRejectedValueOnce(challengeClientError(challengeUrl))
      .mockResolvedValueOnce('second')

    const results = Promise.all([withTrustChallengeRetry(firstRequest), withTrustChallengeRetry(secondRequest)])
    await vi.waitFor(() => expect(keypress).toHaveBeenCalledTimes(1))
    resolveKeypress()

    await expect(results).resolves.toEqual(['first', 'second'])
    expect(openURL).toHaveBeenCalledTimes(1)
    expect(firstRequest).toHaveBeenCalledTimes(2)
    expect(secondRequest).toHaveBeenCalledTimes(2)
  })

  test('restores raw mode on stdin after the keypress when a long-running command had enabled it', async () => {
    const stdin = fakeStdin({isRaw: true})
    const request = vi.fn().mockRejectedValueOnce(challengeClientError(challengeUrl)).mockResolvedValueOnce('retried')

    await withTrustChallengeRetry(request, {stdin})

    expect(keypress).toHaveBeenCalledWith(stdin)
    expect(stdin.setRawMode).toHaveBeenCalledWith(true)
  })

  test('leaves raw mode alone after the keypress when stdin was not raw', async () => {
    const stdin = fakeStdin({isRaw: false})
    const request = vi.fn().mockRejectedValueOnce(challengeClientError(challengeUrl)).mockResolvedValueOnce('retried')

    await withTrustChallengeRetry(request, {stdin})

    expect(stdin.setRawMode).not.toHaveBeenCalled()
  })
})

type FakeStdin = typeof process.stdin & {setRawMode: ReturnType<typeof vi.fn>}

function fakeStdin({isRaw}: {isRaw: boolean}): FakeStdin {
  return {isRaw, setRawMode: vi.fn()} as unknown as FakeStdin
}

function challengeClientError(redirectTo: string): ClientError {
  return new ClientError(
    {
      status: 200,
      errors: [
        {
          message: 'Challenge Required',
          extensions: {code: 'CHALLENGE_REQUIRED', redirect_to: redirectTo},
        } as any,
      ],
    },
    {query: ''},
  )
}
