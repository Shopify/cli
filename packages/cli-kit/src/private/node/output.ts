import {isUnitTest} from '../../public/node/context/local.js'
import {
  OutputMessage,
  LogLevel,
  collectLog,
  stringifyMessage,
  outputWhereAppropriate,
  Logger,
  shouldDisplayColors,
  unstyled,
} from '../../public/node/output.js'

/**
 * Returns a colored or uncolored version of a message, depending on the environment.
 *
 * @param message - The message to color or not.
 * @returns The message with or without colors.
 */
function withOrWithoutStyle(message: string): string {
  if (shouldDisplayColors()) {
    return message
  } else {
    return unstyled(message)
  }
}

/**
 * Prints a log message in the console to stdout.
 *
 * @param message - The message to print.
 */
export function consoleLog(message: string): void {
  process.stdout.write(`${withOrWithoutStyle(message)}\n`)
}

/**
 * Prints a warning message in the console to stderr.
 *
 * @param message - The message to print.
 */
export function consoleWarn(message: string): void {
  process.stderr.write(`${withOrWithoutStyle(message)}\n`)
}

/**
 * Logs an unformatted message at the given log level.
 * Note: By default,  messages are sent through the standard error.
 *
 * @param content - The content to be output to the user.
 * @param logLevel - The log level associated with the message.
 * @param logger - The logging function to use to output to the user.
 */
export function output(content: OutputMessage, logLevel: LogLevel = 'info', logger: Logger = consoleWarn): void {
  if (isUnitTest()) collectLog(logLevel, content)
  const message = stringifyMessage(content)
  outputWhereAppropriate(logLevel, logger, message)
}
