import {extractGraphQLErrors} from '../api/graphql.js'
import {commandEventOutputMode} from '../command-event-context.js'
import {waitForEnter} from '../ui/wait-for-enter.js'
import {recordEvent} from '../../../public/node/analytics.js'
import {adminFqdn} from '../../../public/node/context/fqdn.js'
import {AbortError} from '../../../public/node/error.js'
import {outputDebug} from '../../../public/node/output.js'
import {isCI, openURL} from '../../../public/node/system.js'
import {isTTY, renderInfo, renderSuccess} from '../../../public/node/ui.js'

const TRUST_CHALLENGE_ERROR_CODE = 'CHALLENGE_REQUIRED'

/**
 * The abort that ends a Trust Battery challenge: the session cannot answer it, or
 * the request was challenged again after the verification.
 */
export class TrustChallengeError extends AbortError {}

let pendingChallenge: Promise<void> | undefined
let completedChallenges = 0

/**
 * Runs a theme Admin API request and, when Core answers with a Trust Battery
 * challenge, waits for the user to complete it in the browser before retrying once.
 *
 * A request that starts while another request's challenge is still being completed
 * waits for that challenge first, so it is sent once instead of being challenged
 * itself and then retried. A request that was already in flight when a challenge
 * was completed retries without a second prompt, unless another prompt is open:
 * then it waits for that prompt too.
 *
 * @param request - The request to run and possibly retry.
 * @returns The result of the request.
 */
export async function withTrustChallengeRetry<T>(request: () => Promise<T>): Promise<T> {
  if (pendingChallenge) await pendingChallenge
  const completedChallengesAtStart = completedChallenges

  try {
    return await request()
  } catch (error) {
    const challengeUrl = await trustChallengeUrl(error)
    if (!challengeUrl) throw error

    const verifiedSinceStart = completedChallenges > completedChallengesAtStart
    if (pendingChallenge || !verifiedSinceStart) await completeTrustChallenge(challengeUrl)
  }

  try {
    return await request()
  } catch (error) {
    const challengeUrl = await trustChallengeUrl(error)
    if (!challengeUrl) throw error

    recordEvent('theme-api:trust-challenge:retry-challenged')
    throw new TrustChallengeError('Shopify still needs to verify your identity before it can continue.', undefined, [
      ['Complete the verification at', {link: {url: challengeUrl}}, 'then run the command again.'],
    ])
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
  const challengeError = extractGraphQLErrors(error).find(
    (graphQLError) => graphQLError.extensions?.code === TRUST_CHALLENGE_ERROR_CODE,
  )
  const redirectTo = challengeError?.extensions?.redirect_to
  if (typeof redirectTo !== 'string') return undefined

  if (!(await isAdminUrl(redirectTo))) {
    outputDebug(`Ignoring trust challenge with an unexpected URL host: ${redirectTo}`)
    return undefined
  }

  return redirectTo
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
async function completeTrustChallenge(challengeUrl: string): Promise<void> {
  pendingChallenge ??= promptForTrustChallenge(challengeUrl)
    .then(() => {
      completedChallenges += 1
    })
    .finally(() => {
      pendingChallenge = undefined
    })
  return pendingChallenge
}

async function promptForTrustChallenge(challengeUrl: string): Promise<void> {
  recordEvent('theme-api:trust-challenge:required')

  if (isCI() || !isTTY() || commandEventOutputMode() === 'json') {
    recordEvent('theme-api:trust-challenge:non-interactive')
    throw new TrustChallengeError('Shopify needs to verify your identity before it can continue.', undefined, [
      [
        'Open',
        {link: {url: challengeUrl}},
        "in a browser where you're logged in to Shopify with the same account you use in Shopify CLI, complete the verification, then run the command again.",
      ],
    ])
  }

  const opened = await openURL(challengeUrl)
  recordEvent(opened ? 'theme-api:trust-challenge:browser-opened' : 'theme-api:trust-challenge:browser-not-opened')

  // Everything the user needs is inside the banner: long-running commands such as
  // `theme push` redraw an Ink progress bar that erases any plain line written after it.
  renderInfo({
    headline: 'Verify your identity to continue.',
    body: opened
      ? 'A verification page opened in your browser.'
      : 'Shopify needs to verify your identity before it can continue.',
    link: opened ? undefined : {label: 'Open the verification page', url: challengeUrl},
    nextSteps: [
      ['Complete the verification in your browser, logged in with the same account you use in Shopify CLI.'],
      ['Press', {userInput: 'Enter'}, 'here once you have completed it.'],
    ],
    orderedNextSteps: true,
  })

  await waitForEnter()

  recordEvent('theme-api:trust-challenge:acknowledged')
  renderSuccess({headline: 'Continuing.'})
}
