import {AbortError} from '@shopify/cli-kit/node/error'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {sleep} from '@shopify/cli-kit/node/system'
import {fetchTheme} from '@shopify/cli-kit/node/themes/api'
import {Theme} from '@shopify/cli-kit/node/themes/types'

// 5 minutes
export const UPDATER_TIMEOUT = 5 * 60 * 1000
export const FAILED_TO_CREATE_THEME_MESSAGE =
  'The host theme could not be created to host your theme app extension. Please try again or use the "--theme" flag to use an existing theme as the host theme.'

export async function waitForThemeToBeProcessed(themeId: number, adminSession: AdminSession, startTime = Date.now()) {
  // Each iteration must wait for the response before the next poll is initiated.
  // eslint-disable-next-line no-await-in-loop, no-empty
  while (await themeIsProcessing(themeId, adminSession, startTime)) {}
}

async function themeIsProcessing(themeId: number, session: AdminSession, startTime: number) {
  const theme = await fetchTheme(themeId, session)

  if (!theme || themeProcessingTimedOut(theme, startTime)) {
    throw new AbortError(FAILED_TO_CREATE_THEME_MESSAGE)
  }

  // Sleep for 3 seconds before polling again
  await sleep(3)

  return theme.processing
}
function themeProcessingTimedOut(theme: Theme, startTime: number): boolean {
  return theme.processing && Date.now() - startTime >= UPDATER_TIMEOUT
}
