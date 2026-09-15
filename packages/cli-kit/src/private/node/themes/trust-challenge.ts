import {GraphQLClientError} from '../api/headers.js'
import {recordEvent} from '../../../public/node/analytics.js'
import {adminFqdn} from '../../../public/node/context/fqdn.js'
import {AbortError} from '../../../public/node/error.js'
import {outputDebug, outputInfo} from '../../../public/node/output.js'
import {isCI, openURL} from '../../../public/node/system.js'
import {isTTY, keypress, renderInfo} from '../../../public/node/ui.js'
import {ClientError} from 'graphql-request'

export const TRUST_CHALLENGE_ERROR_CODE = 'CHALLENGE_REQUIRED'

interface GraphQLErrorWithExtensions {
  extensions?: {
    code?: unknown
    redirect_to?: unknown
  }
}

export interface TrustChallengeOptions {
  stdin?: typeof process.stdin
}

let pendingChallenge: Promise<void> | undefined

/**
 * Runs a theme Admin API request and, when Core answers with a Trust Battery
 * challenge, waits for the user to complete it in the browser before retrying once.
 *
 * @param request - The request to run and possibly retry.
 * @param options - Overrides for the prompt, mainly for tests.
 * @returns The result of the request.
 */
export async function withTrustChallengeRetry<T>(
  request: () => Promise<T>,
  options: TrustChallengeOptions = {},
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    const challengeUrl = await trustChallengeUrl(error)
    if (!challengeUrl) throw error

    await completeTrustChallenge(challengeUrl, options)
  }

  try {
    return await request()
  } catch (error) {
    const challengeUrl = await trustChallengeUrl(error)
    if (!challengeUrl) throw error

    recordEvent('theme-api:trust-challenge:retry-challenged')
    throw new AbortError(
      'Shopify still needs to verify your identity before it can apply this theme change.',
      undefined,
      [['Complete the verification at', {link: {url: challengeUrl}}, 'then run the command again.']],
    )
  }
}

/**
 * Extracts the challenge URL from a Trust Battery `CHALLENGE_REQUIRED` GraphQL error.
 *
 * Only URLs on the Admin host are trusted. Anything else is not treated as a
 * challenge and the original error surfaces through normal error handling.
 *
 * @param error - The error thrown by an Admin API request.
 * @returns The challenge URL, or undefined when the error is not a trust challenge.
 */
export async function trustChallengeUrl(error: unknown): Promise<string | undefined> {
  const challengeError = graphQLErrors(error).find((graphQLError) => {
    return graphQLError?.extensions?.code === TRUST_CHALLENGE_ERROR_CODE
  })
  const redirectTo = challengeError?.extensions?.redirect_to
  if (typeof redirectTo !== 'string') return undefined

  if (!(await isAdminUrl(redirectTo))) {
    outputDebug(`Ignoring trust challenge with an unexpected URL host: ${redirectTo}`)
    return undefined
  }

  return redirectTo
}

function graphQLErrors(error: unknown): GraphQLErrorWithExtensions[] {
  if (error instanceof ClientError) {
    return Array.isArray(error.response.errors) ? error.response.errors : []
  }
  if (error instanceof GraphQLClientError) {
    return Array.isArray(error.errors) ? error.errors : []
  }
  return []
}

async function isAdminUrl(url: string): Promise<boolean> {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname === (await adminFqdn())
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Concurrent theme requests (for example the parallel batches of `theme push`)
 * all receive the same challenge. Share one prompt so the browser opens once and
 * every waiting request retries after the same verification.
 */
async function completeTrustChallenge(challengeUrl: string, options: TrustChallengeOptions): Promise<void> {
  pendingChallenge ??= promptForTrustChallenge(challengeUrl, options).finally(() => {
    pendingChallenge = undefined
  })
  return pendingChallenge
}

async function promptForTrustChallenge(challengeUrl: string, options: TrustChallengeOptions): Promise<void> {
  recordEvent('theme-api:trust-challenge:required')

  if (isCI() || !isTTY()) {
    recordEvent('theme-api:trust-challenge:non-interactive')
    throw new AbortError('Shopify needs to verify your identity before it can apply this theme change.', undefined, [
      [
        'Open',
        {link: {url: challengeUrl}},
        "in a browser where you're logged in to Shopify, complete the verification, then run the command again.",
      ],
    ])
  }

  const opened = await openURL(challengeUrl)
  recordEvent(opened ? 'theme-api:trust-challenge:browser-opened' : 'theme-api:trust-challenge:browser-not-opened')

  renderInfo({
    headline: 'Verify your identity to continue.',
    body: opened
      ? 'A verification page opened in your browser. Complete it to apply your theme changes.'
      : 'Shopify needs to verify your identity before it can apply your theme changes.',
    link: opened ? undefined : {label: 'Open the verification page', url: challengeUrl},
  })
  outputInfo('👉 Press any key once you have completed the verification')

  // Long-running commands such as `theme dev` keep stdin in raw mode for their own
  // shortcuts; `keypress` switches it off after one key, so put it back.
  const stdin = options.stdin ?? process.stdin
  const stdinWasRaw = stdin.isRaw === true
  await keypress(stdin)
  if (stdinWasRaw) stdin.setRawMode(true)
  outputInfo('')

  recordEvent('theme-api:trust-challenge:acknowledged')
}
