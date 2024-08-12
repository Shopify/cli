import {evaluate, SessionItem} from './evaluator.js'
import {presentValue} from './presenter.js'
import {DevServerSession} from '../theme-environment/types.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {consoleWarn, outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {createInterface, Interface} from 'readline'

export const DELIMITER_WARNING =
  "Liquid Console doesn't support Liquid delimiters such as '{{ ... }}' or '{% ... %}'.\nPlease use 'collections.first' instead of '{{ collections.first }}'."

export async function replLoop(themeSession: DevServerSession, themeId: string, url: string) {
  if (process.stdin.isTTY) {
    // We want to indicate that we're still using stdin, so that the process
    // doesn't exit early.
    process.stdin.ref()
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const replSession: SessionItem[] = []

  rl.on('line', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleInput(input, themeSession, themeId, url, rl, replSession)
  })
  rl.prompt()
}

export async function handleInput(
  inputValue: string,
  themeSession: DevServerSession,
  themeId: string,
  url: string,
  rl: Interface,
  replSession: SessionItem[],
) {
  try {
    if (hasDelimiter(inputValue)) {
      consoleWarn(DELIMITER_WARNING)
      return rl.prompt()
    }
    const evaluatedValue = await evaluate({snippet: inputValue, themeSession, themeId, url, replSession})
    presentValue(evaluatedValue)
    rl.prompt()
  } catch (error) {
    shutdownReplSession(error)
    rl.close()
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
  return /^\s*(\{\{|{%)/.test(input)
}
