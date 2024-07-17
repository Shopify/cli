import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {REPLThemeManager} from '../utilities/repl-theme-manager.js'
import {ensureValidPassword} from '../utilities/prompts.js'
import {DevServerSession} from '../utilities/theme-environment/types.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {consoleError, consoleLog, outputDebug} from '@shopify/cli-kit/node/output'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export async function ensureReplEnv(adminSession: AdminSession, storePasswordFlag?: string) {
  const themeId = await findOrCreateReplTheme(adminSession)

  const storePassword = (await isStorefrontPasswordProtected(adminSession.storeFqdn))
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

export async function repl(
  adminSession: AdminSession,
  storefrontToken: string,
  themeId: string,
  password: string | undefined,
) {
  consoleLog('Welcome to Shopify Liquid console\n(press Ctrl + C to exit)')
  const themeSession: DevServerSession = {
    ...adminSession,
    storefrontToken,
    storefrontPassword: password,
    expiresAt: new Date(),
  }
  return replLoop(themeSession, storefrontToken, themeId, password)
}

async function replLoop(
  themeSession: DevServerSession,
  storefrontToken: string,
  themeId: string,
  password: string | undefined,
) {
  try {
    const inputValue = await renderTextPrompt({message: 'Enter a value'})
    const evaluatedValue = await evaluate(themeSession, inputValue, themeId)
    const regex = />([^<]+)</
    const match = evaluatedValue.match(regex)

    if (match && match[1]) {
      consoleLog(match[1])
    }
    return replLoop(themeSession, storefrontToken, themeId, password)
  } catch (error) {
    shutdownReplSession(error)
    throw new AbortSilentError()
  }
}

function shutdownReplSession(error: unknown) {
  if (error instanceof Error) {
    const errorMessage = `Shopify Liquid console error: ${error.message}`
    const backtrace = error.stack || 'Error backtrace not found'
    consoleError(errorMessage)
    outputDebug(backtrace)
  }
}

export async function evaluate(themeSession: DevServerSession, snippet: string, themeId: string) {
  const response = await render(themeSession, {
    path: '/',
    query: [],
    themeId,
    cookies: '',
    sectionId: 'announcement-bar',

    headers: {},
    replaceTemplates: {
      'sections/announcement-bar.liquid': `{{ ${snippet} }}`,
    },
  })

  return response.text()
}
