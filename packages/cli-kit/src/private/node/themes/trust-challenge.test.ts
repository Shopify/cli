import {trustChallengeUrl, withTrustChallengeRetry} from './trust-challenge.js'
import {GraphQLClientError} from '../api/headers.js'
import {waitForEnter} from '../ui/wait-for-enter.js'
import {recordEvent} from '../../../public/node/analytics.js'
import {adminFqdn} from '../../../public/node/context/fqdn.js'
import {AbortError, AbortSilentError} from '../../../public/node/error.js'
import {isCI, openURL} from '../../../public/node/system.js'
import {isTTY, renderInfo, renderSuccess} from '../../../public/node/ui.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {ClientError} from 'graphql-request'

vi.mock('../ui/wait-for-enter.js')
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
  vi.mocked(waitForEnter).mockResolvedValue(undefined)
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
    expect(waitForEnter).not.toHaveBeenCalled()
  })

  test('rethrows an error that is not a trust challenge without prompting', async () => {
    const error = new Error('boom')
    const request = vi.fn().mockRejectedValue(error)

    await expect(withTrustChallengeRetry(request)).rejects.toBe(error)

    expect(request).toHaveBeenCalledTimes(1)
    expect(openURL).not.toHaveBeenCalled()
  })

  test('opens the challenge URL, waits for Enter, then retries the request once', async () => {
    const request = vi.fn().mockRejectedValueOnce(challengeClientError(challengeUrl)).mockResolvedValueOnce('retried')

    await expect(withTrustChallengeRetry(request)).resolves.toBe('retried')

    expect(request).toHaveBeenCalledTimes(2)
    expect(openURL).toHaveBeenCalledWith(challengeUrl)
    expect(waitForEnter).toHaveBeenCalledTimes(1)
    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Verify your identity to continue.',
        nextSteps: expect.arrayContaining([expect.arrayContaining([{userInput: 'Enter'}])]),
      }),
    )
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:required')
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:browser-opened')
    expect(recordEvent).toHaveBeenCalledWith('theme-api:trust-challenge:acknowledged')
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Continuing with your theme changes.'})
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
    expect(waitForEnter).toHaveBeenCalledTimes(1)
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

    expect(waitForEnter).not.toHaveBeenCalled()
  })

  test('shares a single prompt across concurrent requests that are challenged together', async () => {
    const enter = deferredEnter()
    const firstRequest = vi
      .fn()
      .mockRejectedValueOnce(challengeClientError(challengeUrl))
      .mockResolvedValueOnce('first')
    const secondRequest = vi
      .fn()
      .mockRejectedValueOnce(challengeClientError(challengeUrl))
      .mockResolvedValueOnce('second')

    const results = Promise.all([withTrustChallengeRetry(firstRequest), withTrustChallengeRetry(secondRequest)])
    await vi.waitFor(() => expect(waitForEnter).toHaveBeenCalledTimes(1))
    enter.press()

    await expect(results).resolves.toEqual(['first', 'second'])
    expect(openURL).toHaveBeenCalledTimes(1)
    expect(renderSuccess).toHaveBeenCalledTimes(1)
    expect(firstRequest).toHaveBeenCalledTimes(2)
    expect(secondRequest).toHaveBeenCalledTimes(2)
  })

  test('holds a request that starts while a challenge is pending until Enter is pressed, then sends it once', async () => {
    const enter = deferredEnter()
    const challengedRequest = vi
      .fn()
      .mockRejectedValueOnce(challengeClientError(challengeUrl))
      .mockResolvedValueOnce('challenged')
    const laterRequest = vi.fn().mockResolvedValue('later')

    const challengedResult = withTrustChallengeRetry(challengedRequest)
    await vi.waitFor(() => expect(waitForEnter).toHaveBeenCalledTimes(1))

    const laterResult = withTrustChallengeRetry(laterRequest)
    await Promise.resolve()
    expect(laterRequest).not.toHaveBeenCalled()

    enter.press()

    await expect(Promise.all([challengedResult, laterResult])).resolves.toEqual(['challenged', 'later'])
    expect(laterRequest).toHaveBeenCalledTimes(1)
    expect(openURL).toHaveBeenCalledTimes(1)
  })

  test('rejects requests waiting on a pending challenge when the prompt is cancelled with Ctrl+C', async () => {
    const enter = deferredEnter()
    const challengedRequest = vi.fn().mockRejectedValueOnce(challengeClientError(challengeUrl))
    const laterRequest = vi.fn().mockResolvedValue('later')

    const challengedResult = withTrustChallengeRetry(challengedRequest)
    await vi.waitFor(() => expect(waitForEnter).toHaveBeenCalledTimes(1))
    const laterResult = withTrustChallengeRetry(laterRequest)

    enter.cancel()

    await expect(challengedResult).rejects.toBeInstanceOf(AbortSilentError)
    await expect(laterResult).rejects.toBeInstanceOf(AbortSilentError)
    expect(laterRequest).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('passes the provided stdin to the Enter prompt', async () => {
    const stdin = {} as typeof process.stdin
    const request = vi.fn().mockRejectedValueOnce(challengeClientError(challengeUrl)).mockResolvedValueOnce('retried')

    await withTrustChallengeRetry(request, {stdin})

    expect(waitForEnter).toHaveBeenCalledWith(stdin)
  })
})

function deferredEnter(): {press: () => void; cancel: () => void} {
  let press!: () => void
  let cancel!: () => void
  vi.mocked(waitForEnter).mockReturnValue(
    new Promise<void>((resolve, reject) => {
      press = resolve
      cancel = () => reject(new AbortSilentError())
    }),
  )
  return {press: () => press(), cancel: () => cancel()}
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
