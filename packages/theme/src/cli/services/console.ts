import {ConsoleResult} from './console/types.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {REPLThemeManager} from '../utilities/repl/repl-theme-manager.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {DELIMITER_WARNING, hasDelimiter, replLoop} from '../utilities/repl/repl.js'
import {evaluate, SessionItem} from '../utilities/repl/evaluator.js'
import {hasJsonError, JSON_ERROR_MESSAGE} from '../utilities/repl/presenter.js'
import {fetchDevServerSession, initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {errorToJson} from '@shopify/cli-kit/node/error/serialization'

export async function ensureReplEnv(adminSession: AdminSession, storePasswordFlag?: string) {
  const themeId = await findOrCreateReplTheme(adminSession)

  const storePassword = (await isStorefrontPasswordProtected(adminSession))
    ? await ensureValidPassword(storePasswordFlag, adminSession.storeFqdn)
    : undefined

  return {
    themeId,
    storePassword,
  }
}

async function findOrCreateReplTheme(adminSession: AdminSession): Promise<string> {
  const themeManager = new REPLThemeManager(adminSession)
  const replTheme = await themeManager.findOrCreate()

  return replTheme.id.toString()
}

export async function initializeRepl(
  adminSession: AdminSession,
  themeId: string,
  url: string,
  themeAccessPassword?: string,
  storefrontPassword?: string,
) {
  outputInfo('Welcome to Shopify Liquid console\n(press Ctrl + C to exit)')

  validateThemeAccessPassword(themeAccessPassword)
  const session = await initializeDevServerSession(themeId, adminSession, themeAccessPassword, storefrontPassword)

  return replLoop(session, themeId, url)
}

export async function evaluateConsoleInputs(options: {
  inputs: string[]
  adminSession: AdminSession
  themeId: string
  url: string
  themeAccessPassword?: string
  storefrontPassword?: string
}): Promise<ConsoleResult> {
  const {inputs, adminSession, themeId, url, themeAccessPassword, storefrontPassword} = options
  validateThemeAccessPassword(themeAccessPassword)
  const session = await fetchDevServerSession(themeId, adminSession, themeAccessPassword, storefrontPassword)
  const replSession: SessionItem[] = []
  const results: ConsoleResult['results'] = []
  let failed = false

  for (const input of inputs) {
    if (failed) {
      results.push({input, status: 'skipped', reason: 'previous-input-failed'})
      continue
    }
    try {
      if (hasDelimiter(input)) throw new AbortError(DELIMITER_WARNING)
      // Assignments must finish before the next expression reads the shared Liquid context.
      // eslint-disable-next-line no-await-in-loop
      const value = await evaluate({snippet: input, themeSession: session, themeId, url, replSession, mode: 'batch'})
      if (hasJsonError(value)) throw new AbortError(JSON_ERROR_MESSAGE)
      results.push({input, status: 'success', value: value ?? null})
    } catch (error) {
      if (!(error instanceof AbortError)) throw error
      failed = true
      results.push({input, status: 'failed', error: errorToJson(error)})
    }
  }

  return {status: failed ? 'partial' : 'success', results}
}

function validateThemeAccessPassword(themeAccessPassword?: string): void {
  if (themeAccessPassword?.startsWith('shpat_')) {
    throw new AbortError(
      'Unable to use Admin API tokens with the console command',
      `To use this command with the --password flag you must:

1. Install the Theme Access app on your shop
2. Generate a new password

Alternatively, you can authenticate normally by not passing the --password flag.

Learn more: https://shopify.dev/docs/storefronts/themes/tools/theme-access`,
    )
  }
}
