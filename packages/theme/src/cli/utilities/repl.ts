import {DevServerSession} from './theme-environment/types.js'
import {evaluate} from './repl/evaluater.js'
import {presentValue} from './repl/presenter.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {consoleWarn, outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {createInterface, Interface} from 'readline'

export async function replLoop(themeSession: DevServerSession, themeId: string, url: string) {
  try {
    if (process.stdin.isTTY) {
      // We want to indicate that we're still using stdin, so that the process
      // doesn't exit early.
      process.stdin.ref()
    }

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.on('line', (input) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handleInput(input, themeSession, themeId, url, rl)
    })
    rl.prompt()
  } catch (error) {
    shutdownReplSession(error)
    throw new AbortSilentError()
  }
}

export async function handleInput(
  inputValue: string,
  themeSession: DevServerSession,
  themeId: string,
  url: string,
  rl: Interface,
) {
  if (hasDelimiter(inputValue)) {
    consoleWarn(
      "Liquid Console doesn't support Liquid delimiters such as '{{ ... }}' or '{% ... %}'.\nPlease use 'collections.first' instead of '{{ collections.first }}'.",
    )
    return rl.prompt()
  }
  const evaluatedValue = await evaluate(themeSession, inputValue, themeId, url)
  presentValue(evaluatedValue)
  rl.prompt()
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
