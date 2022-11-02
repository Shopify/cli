/* eslint-disable no-console */
import {isUnitTest, isVerbose} from './environment/local.js'
import {PackageManager} from './public/node/node-package-manager.js'
import colors from './public/node/colors.js'
import {
  ColorContentToken,
  CommandContentToken,
  ContentToken,
  ErrorContentToken,
  HeadingContentToken,
  ItalicContentToken,
  JsonContentToken,
  LinesDiffContentToken,
  LinkContentToken,
  PathContentToken,
  RawContentToken,
  SubHeadingContentToken,
} from './content-tokens.js'
import {logToFile} from './log.js'
import {AbortSignal} from 'abort-controller'
import stripAnsi from 'strip-ansi'
import {Writable} from 'node:stream'
import type {Change} from 'diff'

export {default as logUpdate} from 'log-update'

export type Logger = (message: string) => void

export class TokenizedString {
  value: string
  constructor(value: string) {
    this.value = value
  }
}

export type Message = string | TokenizedString

export const token = {
  raw: (value: string) => {
    return new RawContentToken(value)
  },
  genericShellCommand: (value: Message) => {
    return new CommandContentToken(value)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: (value: any) => {
    return new JsonContentToken(value)
  },
  path: (value: Message) => {
    return new PathContentToken(value)
  },
  link: (value: Message, link: string) => {
    return new LinkContentToken(value, link)
  },
  heading: (value: Message) => {
    return new HeadingContentToken(value)
  },
  subheading: (value: Message) => {
    return new SubHeadingContentToken(value)
  },
  italic: (value: Message) => {
    return new ItalicContentToken(value)
  },
  errorText: (value: Message) => {
    return new ErrorContentToken(value)
  },
  cyan: (value: Message) => {
    return new ColorContentToken(value, colors.cyan)
  },
  yellow: (value: Message) => {
    return new ColorContentToken(value, colors.yellow)
  },
  magenta: (value: Message) => {
    return new ColorContentToken(value, colors.magenta)
  },
  green: (value: Message) => {
    return new ColorContentToken(value, colors.green)
  },
  packagejsonScript: (packageManager: PackageManager, scriptName: string, ...scriptArgs: string[]) => {
    return new CommandContentToken(formatPackageManagerCommand(packageManager, scriptName, scriptArgs))
  },
  successIcon: () => {
    return new ColorContentToken('✔', colors.green)
  },
  failIcon: () => {
    return new ErrorContentToken('✖')
  },
  linesDiff: (value: Change[]) => {
    return new LinesDiffContentToken(value)
  },
}

function formatPackageManagerCommand(packageManager: PackageManager, scriptName: string, scriptArgs: string[]): string {
  switch (packageManager) {
    case 'yarn': {
      const pieces = ['yarn', scriptName, ...scriptArgs]
      return pieces.join(' ')
    }
    case 'pnpm':
    case 'npm': {
      const pieces = [packageManager, 'run', scriptName]
      if (scriptArgs.length > 0) {
        pieces.push('--')
        pieces.push(...scriptArgs)
      }
      return pieces.join(' ')
    }
  }
}

export function content(strings: TemplateStringsArray, ...keys: (ContentToken<unknown> | string)[]): TokenizedString {
  let output = ``
  strings.forEach((string, i) => {
    output += string
    if (i >= keys.length) {
      return
    }
    const token = keys[i]!

    if (typeof token === 'string') {
      output += token
    } else {
      const enumTokenOutput = token.output()

      if (Array.isArray(enumTokenOutput)) {
        enumTokenOutput.forEach((line: string) => {
          output += line
        })
      } else {
        output += enumTokenOutput
      }
    }
  })
  return new TokenizedString(output)
}

/** Log levels */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'

/**
 * It maps a level to a numeric value.
 * @param level - The level for which we'll return its numeric value.
 * @returns The numeric value of the level.
 */
const logLevelValue = (level: LogLevel): number => {
  switch (level) {
    case 'trace':
      return 10
    case 'debug':
      return 20
    case 'info':
      return 30
    case 'warn':
      return 40
    case 'error':
      return 50
    case 'fatal':
      return 60
    default:
      return 30
  }
}

/**
 *
 * @returns It returns the log level set by the user.
 */
export const currentLogLevel = (): LogLevel => {
  if (isVerbose()) {
    return 'debug'
  } else {
    return 'info'
  }
}

export const shouldOutput = (logLevel: LogLevel): boolean => {
  if (isUnitTest()) {
    return false
  }
  const currentLogLevelValue = logLevelValue(currentLogLevel())
  const messageLogLevelValue = logLevelValue(logLevel)
  return messageLogLevelValue >= currentLogLevelValue
}

// eslint-disable-next-line import/no-mutable-exports
export let collectedLogs: {[key: string]: string[]} = {}

/**
 * This is only used during UnitTesting.
 * If we are in a testing context, instead of printing the logs to the console,
 * we will store them in a variable that can be accessed from the tests.
 * @param key - The key of the log.
 * @param content - The content of the log.
 */
export const collectLog = (key: string, content: Message) => {
  const output = collectedLogs.output ?? []
  const data = collectedLogs[key] ?? []
  data.push(stripAnsi(stringifyMessage(content) ?? ''))
  output.push(stripAnsi(stringifyMessage(content) ?? ''))
  collectedLogs[key] = data
  collectedLogs.output = output
}

export const clearCollectedLogs = () => {
  collectedLogs = {}
}

/**
 * Ouputs information to the user.
 * Info messages don't get additional formatting.
 * Note: Info messages are sent through the standard output.
 * @param content - The content to be output to the user.
 * @param logger - The logging function to use to output to the user.
 */
export const info = (content: Message, logger: Logger = consoleLog) => {
  const message = stringifyMessage(content)
  if (isUnitTest()) collectLog('info', content)
  outputWhereAppropriate('info', logger, message)
}

/**
 * Outputs a success message to the user.
 * Success messages receive a special formatting to make them stand out in the console.
 * Note: Success messages are sent through the standard output.
 * @param content - The content to be output to the user.
 * @param logger - The logging function to use to output to the user.
 */
export const success = (content: Message, logger: Logger = consoleLog) => {
  const message = colors.bold(`✅ Success! ${stringifyMessage(content)}.`)
  if (isUnitTest()) collectLog('success', content)
  outputWhereAppropriate('info', logger, message)
}

/**
 * Outputs a completed message to the user.
 * Completed message receive a special formatting to make them stand out in the console.
 * Note: Completed messages are sent through the standard output.
 * @param content - The content to be output to the user.
 * @param logger - The logging function to use to output to the user.
 */
export const completed = (content: Message, logger: Logger = consoleLog) => {
  const message = `${colors.green('✔')} ${stringifyMessage(content)}`
  if (isUnitTest()) collectLog('completed', content)
  outputWhereAppropriate('info', logger, message)
}

/**
 * Ouputs debug information to the user. By default these output is hidden unless the user calls the CLI with --verbose.
 * Debug messages don't get additional formatting.
 * Note: Debug messages are sent through the standard output.
 * @param content - The content to be output to the user.
 * @param logger - The logging function to use to output to the user.
 */
export const debug = (content: Message, logger: Logger = consoleLog) => {
  if (isUnitTest()) collectLog('debug', content)
  const message = colors.gray(stringifyMessage(content))
  outputWhereAppropriate('debug', logger, message)
}

/**
 * Outputs a warning message to the user.
 * Warning messages receive a special formatting to make them stand out in the console.
 * Note: Warning messages are sent through the standard output.
 * @param content - The content to be output to the user.
 * @param logger - The logging function to use to output to the user.
 */
export const warn = (content: Message, logger: Logger = consoleWarn) => {
  if (isUnitTest()) collectLog('warn', content)
  const message = colors.yellow(stringifyMessage(content))
  outputWhereAppropriate('warn', logger, message)
}

/**
 * Prints a new line in the terminal.
 */
export const newline = () => {
  console.log()
}

export function stringifyMessage(message: Message): string {
  if (message instanceof TokenizedString) {
    return message.value
  } else {
    return message
  }
}

const message = (content: Message, level: LogLevel = 'info') => {
  const stringifiedMessage = stringifyMessage(content)
  outputWhereAppropriate(level, consoleLog, stringifiedMessage)
}

export interface OutputProcess {
  /** The prefix to include in the logs
   *   [vite] Output coming from Vite
   */
  prefix: string
  /**
   * A callback to invoke the process. stdout and stderr should be used
   * to send standard output and error data that gets formatted with the
   * right prefix.
   */
  action: (stdout: Writable, stderr: Writable, signal: AbortSignal) => Promise<void>
}

/**
 * This regex can be used to find the erase cursor Ansii characters
 * to strip them from the string.
 * https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797#erase-functions
 */
const eraseCursorAnsiRegex = [
  // Erase the entire line
  '2K',
  // Clear vertical tab stop at current line
  '1G',
]
  .map((element) => `[\\u001B\\u009B][[\\]()#;?]*${element}`)
  .join('|')

export function consoleLog(message: string): void {
  console.log(withOrWithoutStyle(message))
}

export function consoleError(message: string): void {
  console.error(withOrWithoutStyle(message))
}

export function consoleWarn(message: string): void {
  console.warn(withOrWithoutStyle(message))
}

export function outputWhereAppropriate(logLevel: LogLevel, logger: Logger, message: string): void {
  if (shouldOutput(logLevel)) {
    logger(message)
  }
  logToFile(message, logLevel.toUpperCase())
}

function withOrWithoutStyle(message: string): string {
  if (shouldDisplayColors()) {
    return message
  } else {
    return unstyled(message)
  }
}

export function unstyled(message: string): string {
  return stripAnsi(message)
}

export function shouldDisplayColors(): boolean {
  return Boolean(process.stdout.isTTY || process.env.FORCE_COLOR)
}

/**
 * @param packageManager - The package manager that is being used.
 * @param version - The version to update to
 */
export function getOutputUpdateCLIReminder(
  packageManager: PackageManager | 'unknown' | undefined,
  version: string,
): string {
  const versionMessage = `💡 Version ${version} available!`
  if (!packageManager || packageManager === 'unknown') return versionMessage

  const updateCommand = token.packagejsonScript(packageManager, 'shopify', 'upgrade')
  return content`${versionMessage} Run ${updateCommand}`.value
}

/**
 * Parse title and body to be a single formatted string
 * @param title - The title of the message. Will be formatted as a heading.
 * @param body - The body of the message. Will respect the original formatting.
 * @returns The formatted message.
 */
export function section(title: string, body: string): string {
  const formattedTitle = `${title.toUpperCase()}${' '.repeat(35 - title.length)}`
  return content`${token.heading(formattedTitle)}\n${body}`.value
}

/* eslint-enable no-console */
