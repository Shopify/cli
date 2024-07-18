import {render} from './theme-environment/storefront-renderer.js'
import {DevServerSession} from './theme-environment/types.js'
import {presentValue} from './repl/presenter.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {consoleWarn, consoleError, outputDebug} from '@shopify/cli-kit/node/output'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function replLoop(themeSession: DevServerSession, themeId: string, url: string) {
  try {
    const inputValue = await renderTextPrompt({message: 'Enter a value'})
    if (hasDelimiter(inputValue)) {
      consoleWarn(
        "Liquid Console doesn't support Liquid delimiters such as '{{ ... }}' or '{% ... %}'.\nPlease use 'collections.first' instead of '{{ collections.first }}'.",
      )
      return replLoop(themeSession, themeId, url)
    }

    const evaluatedValue = await evaluate(themeSession, inputValue, themeId, url)
    presentValue(evaluatedValue)

    return replLoop(themeSession, themeId, url)
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

function hasDelimiter(input: string): boolean {
  return /\{\{|\}\}|\{%|%\}/.test(input)
}

async function evaluate(
  themeSession: DevServerSession,
  snippet: string,
  themeId: string,
  url: string,
): Promise<string | undefined> {
  const result = await evaluateResult(themeSession, themeId, snippet, url)

  const regex = />([^<]+)</
  const match = result.match(regex)

  if (match && match[1]) {
    return JSON.parse(match[1])
  }
}

async function evaluateResult(themeSession: DevServerSession, themeId: string, snippet: string, url: string) {
  outputDebug(`Evaluating snippet - ${snippet}`)
  const response = await render(themeSession, {
    path: url,
    query: [],
    themeId,
    cookies: '',
    sectionId: 'announcement-bar',
    headers: {},
    replaceTemplates: {
      'sections/announcement-bar.liquid': `{{ ${snippet} | json }}`,
    },
  })

  return response.text()
}
