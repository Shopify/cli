import {evaluate, SessionItem} from './evaluator.js'
import {presentValue} from './presenter.js'
import {DevServerSession} from '../theme-environment/types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {consoleWarn, outputDebug} from '@shopify/cli-kit/node/output'
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
    rl.close()

    if (error instanceof Error) {
      outputDebug(error.stack || 'Error backtrace not found')
      throw new AbortError(error.message)
    } else {
      throw new AbortError('An unknown error occurred. Please try again.')
    }
  }
}

function hasDelimiter(input: string): boolean {
  return /^\s*(\{\{|{%)/.test(input)
}
