import {render} from './theme-environment/storefront-renderer.js'
import {DevServerSession} from './theme-environment/types.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {
  consoleWarn,
  consoleError,
  outputDebug,
  outputToken,
  outputContent,
  outputInfo,
} from '@shopify/cli-kit/node/output'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function replLoop(themeSession: DevServerSession, themeId: string, url: string) {
  try {
    const inputValue = await renderTextPrompt({message: 'Enter a value'})
    if (hasDelimiter(inputValue)) {
      consoleWarn(
        "Liquid Console doesn't support Liquid delimiters such as '{{ ... }}' or '{% ... %}'.\nPlease use 'collections.first' instead of '{{ collections.first }}'.",
      )
    }
    const evaluatedValue = await evaluate(themeSession, inputValue, themeId, url)
    presentEvaluatedValue(evaluatedValue)
    return replLoop(themeSession, themeId, url)
  } catch (error) {
    shutdownReplSession(error)
    throw new AbortSilentError()
  }
}

function presentEvaluatedValue(evaluatedValue?: unknown) {
  if (hasJsonError(evaluatedValue)) {
    consoleWarn(
      "Object can't be printed, but you can access its fields. Read more at https://shopify.dev/docs/api/liquid.",
    )
    return
  }

  if (evaluatedValue === undefined || evaluatedValue === null) {
    presentValue('null')
    return
  }

  const formattedOutput = JSON.stringify(evaluatedValue, null, 2)
  presentValue(formattedOutput)
}

function presentValue(value: string) {
  return outputInfo(outputContent`${outputToken.cyan(value)}`)
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

function hasJsonError(output: unknown): boolean {
  switch (typeof output) {
    case 'object':
      if (Array.isArray(output)) {
        return hasJsonError(output[0])
      } else if (output !== null) {
        const errorOutput = output as {error?: string}
        return errorOutput.error?.includes('json not allowed for this object') ?? false
      }
      return false
    default:
      return false
  }
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
