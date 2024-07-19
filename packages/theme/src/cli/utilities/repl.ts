import {DevServerSession} from './theme-environment/types.js'
import {presentValue} from './repl/presenter.js'
import {evaluate} from './repl/evaluater.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {consoleWarn, outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
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
    outputInfo(outputContent`${outputToken.errorText(`Shopify Liquid console error: ${error.message}`)}`)
    outputDebug(error.stack || 'Error backtrace not found')
  }
}

function hasDelimiter(input: string): boolean {
  return /\{\{|\}\}|\{%|%\}/.test(input)
}
