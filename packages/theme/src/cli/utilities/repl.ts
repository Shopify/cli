import {render} from './theme-environment/storefront-renderer.js'
import {DevServerSession} from './theme-environment/types.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {consoleWarn, consoleError, outputDebug} from '@shopify/cli-kit/node/output'
import {renderText, renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function replLoop(
  themeSession: DevServerSession,
  storefrontToken: string,
  themeId: string,
  password: string | undefined,
) {
  try {
    const inputValue = await renderTextPrompt({message: 'Enter a value'})
    if (hasDelimiter(inputValue)) {
      consoleWarn(
        "Liquid Console doesn't support Liquid delimiters such as '{{ ... }}' or '{% ... %}'.\nPlease use 'collections.first' instead of '{{ collections.first }}'.",
      )
    }
    const evaluatedValue = await evaluate(themeSession, inputValue, themeId)
    presentEvaluatedValue(evaluatedValue)
    return replLoop(themeSession, storefrontToken, themeId, password)
  } catch (error) {
    shutdownReplSession(error)
    throw new AbortSilentError()
  }
}

function presentEvaluatedValue(evaluatedValue: string) {
  if (evaluatedValue === 'null') {
    renderText({text: 'null'})
    return
  }
  const regex = />([^<]+)</
  const match = evaluatedValue.match(regex)

  if (match && match[1]) {
    renderText({text: match[1]})
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

export async function evaluate(themeSession: DevServerSession, snippet: string, themeId: string) {
  return evaluateResult(themeSession, themeId, snippet)
}

async function evaluateResult(themeSession: DevServerSession, themeId: string, snippet: string) {
  outputDebug(`Evaluating snippet - ${snippet}`)
  const response = await render(themeSession, {
    path: '/',
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
