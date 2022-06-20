/* eslint-disable no-console */
import {Fatal, Bug} from './error'
import {isUnitTest, isVerbose} from './environment/local'
import constants from './constants'
import {DependencyManager} from './dependency'
import {
  append as fileAppend,
  mkdirSync as fileMkdirSync,
  readSync as fileReadSync,
  sizeSync as fileSizeSync,
  writeSync as fileWriteSync,
} from './file'
import {join as pathJoin, relativize as relativizePath} from './path'
import {page} from './system'
import terminalLink from 'terminal-link'
import colors from 'ansi-colors'
import StackTracey from 'stacktracey'
import {AbortController, AbortSignal} from 'abort-controller'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cjs from 'color-json'
import {Writable} from 'node:stream'

let logFile: string

export function initiateLogging({
  logDir = constants.paths.directories.cache.path(),
  filename = 'shopify.log',
}: {
  logDir: string
  filename: string
}) {
  fileMkdirSync(logDir)
  logFile = pathJoin(logDir, filename)
  truncateLogs()
}

// Shaves off the first 10,000 log lines (circa 1MB) if logs are over 5MB long.
// Rescues in case the file hasn't been created yet.
function truncateLogs() {
  try {
    if (fileSizeSync(logFile) > 5 * 1024 * 1024) {
      const contents = fileReadSync(logFile)
      const splitContents = contents.split('\n')
      const newContents = splitContents.slice(10000, splitContents.length).join('\n')
      fileWriteSync(logFile, newContents)
    }
    // eslint-disable-next-line no-empty, no-catch-all/no-catch-all
  } catch {}
}

enum ContentTokenType {
  Raw,
  Command,
  Json,
  Path,
  Link,
  Heading,
  SubHeading,
  Italic,
  ErrorText,
  Yellow,
  Cyan,
  Magenta,
  Green,
}

interface ContentMetadata {
  link?: string
}

class ContentToken {
  type: ContentTokenType
  value: Message
  metadata: ContentMetadata

  constructor(value: Message, metadata: ContentMetadata = {}, type: ContentTokenType) {
    this.type = type
    this.value = value
    this.metadata = metadata
  }
}

export const token = {
  raw: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Raw)
  },
  genericShellCommand: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Command)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: (value: any) => {
    return new ContentToken(value, {}, ContentTokenType.Json)
  },
  path: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Path)
  },
  link: (value: Message, link: string) => {
    return new ContentToken(value, {link}, ContentTokenType.Link)
  },
  heading: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Heading)
  },
  subheading: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.SubHeading)
  },
  italic: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Italic)
  },
  errorText: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.ErrorText)
  },
  cyan: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Cyan)
  },
  yellow: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Yellow)
  },
  magenta: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Magenta)
  },
  green: (value: Message) => {
    return new ContentToken(value, {}, ContentTokenType.Green)
  },
  packagejsonScript: (dependencyManager: DependencyManager, scriptName: string, ...scriptArgs: string[]) => {
    return new ContentToken(
      formatPackageManagerCommand(dependencyManager, scriptName, scriptArgs),
      {},
      ContentTokenType.Command,
    )
  },
  successIcon: () => {
    return new ContentToken('✔', {}, ContentTokenType.Green)
  },
  failIcon: () => {
    return new ContentToken('✖', {}, ContentTokenType.ErrorText)
  },
}

function formatPackageManagerCommand(
  dependencyManager: DependencyManager,
  scriptName: string,
  scriptArgs: string[],
): string {
  switch (dependencyManager) {
    case 'yarn': {
      const pieces = ['yarn', scriptName, ...scriptArgs]
      return pieces.join(' ')
    }
    case 'pnpm':
    case 'npm': {
      const pieces = [dependencyManager, 'run', scriptName]
      if (scriptArgs.length > 0) {
        pieces.push('--')
        pieces.push(...scriptArgs)
      }
      return pieces.join(' ')
    }
  }
}

export class TokenizedString {
  value: string
  constructor(value: string) {
    this.value = value
  }
}

export type Message = string | TokenizedString

export function content(strings: TemplateStringsArray, ...keys: (ContentToken | string)[]): TokenizedString {
  let output = ``
  strings.forEach((string, i) => {
    output += string
    if (i >= keys.length) {
      return
    }
    const token = keys[i]

    if (typeof token === 'string') {
      output += token
    } else {
      const enumToken = token as ContentToken
      switch (enumToken.type) {
        case ContentTokenType.Raw:
          output += enumToken.value
          break
        case ContentTokenType.Command:
          output += colors.bold(colors.yellow(stringifyMessage(enumToken.value)))
          break
        case ContentTokenType.Path:
          output += colors.cyan(relativizePath(stringifyMessage(enumToken.value)))
          break
        case ContentTokenType.Json:
          try {
            output += cjs(stringifyMessage(enumToken.value) ?? {})
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch (_) {
            output += JSON.stringify(stringifyMessage(enumToken.value) ?? {}, null, 2)
          }
          break
        case ContentTokenType.Link:
          output += terminalLink(colors.green(stringifyMessage(enumToken.value)), enumToken.metadata.link ?? '')
          break
        case ContentTokenType.Heading:
          output += colors.bold.underline(stringifyMessage(enumToken.value))
          break
        case ContentTokenType.SubHeading:
          output += colors.underline(stringifyMessage(enumToken.value))
          break
        case ContentTokenType.Italic:
          output += colors.italic(stringifyMessage(enumToken.value))
          break
        case ContentTokenType.ErrorText:
          output += colors.bold.redBright(stringifyMessage(enumToken.value))
          break
        case ContentTokenType.Yellow:
          output += colors.yellow(stringifyMessage(enumToken.value))
          break
        case ContentTokenType.Cyan:
          output += colors.cyan(stringifyMessage(enumToken.value))
          break
        case ContentTokenType.Magenta:
          output += colors.magenta(stringifyMessage(enumToken.value))
          break
        case ContentTokenType.Green:
          output += colors.green(stringifyMessage(enumToken.value))
          break
      }
    }
  })
  return new TokenizedString(output)
}

/** Log levels */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'

/**
 * It maps a level to a numeric value.
 * @param level {LogLevel} The level for which we'll return its numeric value.
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
 * @returns {LogLevel} It returns the log level set by the user.
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

/**
 * Ouputs information to the user. This is akin to "console.log"
 * Info messages don't get additional formatting.
 * Note: Info messages are sent through the standard output.
 * @param content {string} The content to be output to the user.
 */
export const info = (content: Message) => {
  message(content, 'info')
}

/**
 * Outputs a success message to the user.
 * Success message receive a special formatting to make them stand out in the console.
 * Note: Success messages are sent through the standard output.
 * @param content {string} The content to be output to the user.
 */
export const success = (content: Message) => {
  const message = colors.bold(`✅ Success! ${stringifyMessage(content)}.`)
  outputWhereAppropriate('info', consoleLog, message)
}

/**
 * Outputs a completed message to the user.
 * Completed message receive a special formatting to make them stand out in the console.
 * Note: Completed messages are sent through the standard output.
 * @param content {string} The content to be output to the user.
 */
export const completed = (content: Message) => {
  const message = `${colors.green('✔')} ${stringifyMessage(content)}.`
  outputWhereAppropriate('info', consoleLog, message)
}

/**
 * Ouputs debug information to the user. By default these output is hidden unless the user calls the CLI with --verbose.
 * Debug messages don't get additional formatting.
 * Note: Debug messages are sent through the standard output.
 * @param content {string} The content to be output to the user.
 */
export const debug = (content: Message) => {
  message(colors.gray(stringifyMessage(content)), 'debug')
}

/**
 * Outputs a warning message to the user.
 * Warning messages receive a special formatting to make them stand out in the console.
 * Note: Warning messages are sent through the standard output.
 * @param content {string} The content to be output to the user.
 */
export const warn = (content: Message) => {
  consoleWarn(colors.yellow(stringifyMessage(content)))
}

/**
 * Prints a new line in the terminal.
 */
export const newline = () => {
  console.log()
}

/**
 * Formats and outputs a fatal error.
 * Note: This API is not intended to be used internally. If you want to
 * abort the execution due to an error, raise a fatal error and let the
 * error handler handle and format it.
 * @param content {Fatal} The fatal error to be output.
 */
export const error = async (content: Fatal) => {
  if (!content.message) {
    return
  }
  let outputString = ''
  const message = content.message
  const padding = '    '
  const header = colors.redBright(`\n━━━━━━ Error ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  const footer = colors.redBright('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  outputString += header
  const lines = message.split('\n')
  for (const line of lines) {
    outputString += `${padding}${line}\n`
  }
  if (content.tryMessage) {
    outputString += `\n${padding}${colors.bold('What to try:')}\n`
    const lines = content.tryMessage.split('\n')
    for (const line of lines) {
      outputString += `${padding}${line}`
    }
  }

  let stack = await new StackTracey(content).withSourcesAsync()
  stack = stack
    .filter((entry) => {
      return !entry.file.includes('@oclif/core')
    })
    .map((item) => {
      item.calleeShort = colors.yellow(item.calleeShort)
      /** We make the paths relative to the packages/ directory */
      const fileShortComponents = item.fileShort.split('packages/')
      item.fileShort = fileShortComponents.length === 2 ? fileShortComponents[1] : fileShortComponents[0]
      return item
    })
  if (content instanceof Bug) {
    if (stack.items.length !== 0) {
      outputString += `\n${padding}${colors.bold('Stack trace:')}`
      const stackLines = stack.asTable({}).split('\n')
      for (const stackLine of stackLines) {
        outputString += `${padding}${stackLine}`
      }
    }
  }
  outputString += footer
  outputWhereAppropriate('error', consoleError, outputString)
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
 * Use this function when you have multiple concurrent processes that send data events
 * and we need to output them ensuring that they can visually differenciated by the user.
 *
 * @param processes {OutputProcess[]} A list of processes to run concurrently.
 */
export async function concurrent(
  processes: OutputProcess[],
  callback: ((signal: AbortSignal) => void) | undefined = undefined,
) {
  const abortController = new AbortController()

  // eslint-disable-next-line node/callback-return
  if (callback) callback(abortController.signal)

  const concurrentColors = [token.yellow, token.cyan, token.magenta, token.green]
  const prefixColumnSize = Math.max(...processes.map((process) => process.prefix.length))

  function linePrefix(prefix: string, index: number) {
    const colorIndex = index < concurrentColors.length ? index : index % concurrentColors.length
    const color = concurrentColors[colorIndex]
    return color(`${prefix}${' '.repeat(prefixColumnSize - prefix.length)} ${colors.bold('|')} `)
  }

  try {
    await Promise.all(
      processes.map(async (process, index) => {
        const stdout = new Writable({
          write(chunk, _encoding, next) {
            const lines = stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii')).split(/\n/)
            for (const line of lines) {
              info(content`${linePrefix(process.prefix, index)}${line}`)
            }
            next()
          },
        })
        const stderr = new Writable({
          write(chunk, _encoding, next) {
            const lines = stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii')).split(/\n/)
            for (const line of lines) {
              message(content`${linePrefix(process.prefix, index)}${colors.bold(line)}`, 'error')
            }
            next()
          },
        })
        await process.action(stdout, stderr, abortController.signal)
      }),
    )
  } catch (_error) {
    // We abort any running process
    abortController.abort()
    throw _error
  }
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

/**
 * The data sent through the standard pipelines of the sub-processes that we execute
 * might contain ansii escape characters to move the cursor. That causes any additional
 * formatting to break. This function takes a string and strips escape characters that
 * manage the cursor in the terminal.
 * @param value {string} String whose erase cursor escape characters will be stripped.
 * @returns {string} Stripped string.
 */
function stripAnsiEraseCursorEscapeCharacters(value: string): string {
  return value.replace(/(\n)$/, '').replace(new RegExp(eraseCursorAnsiRegex, 'g'), '')
}

function consoleLog(message: string): void {
  console.log(withOrWithoutStyle(message))
}

function consoleError(message: string): void {
  console.error(withOrWithoutStyle(message))
}

function consoleWarn(message: string): void {
  console.warn(withOrWithoutStyle(message))
}

function outputWhereAppropriate(logLevel: LogLevel, logFunc: (message: string) => void, message: string): void {
  if (shouldOutput(logLevel)) {
    logFunc(message)
  }
  logToFile(message, logLevel.toUpperCase())
}

function logToFile(message: string, logLevel: string): void {
  // If file logging hasn't been initiated, skip it
  if (!logFile) return
  const timestamp = new Date().toISOString()
  fileAppend(logFile, `[${timestamp} ${logLevel}]: ${message}\n`)
}

function withOrWithoutStyle(message: string): string {
  if (shouldDisplayColors()) {
    return message
  } else {
    return unstyled(message)
  }
}

export function unstyled(message: string): string {
  return colors.unstyle(message)
}

export function shouldDisplayColors(): boolean {
  return Boolean(process.stdout.isTTY || process.env.FORCE_COLOR)
}

export async function pageLogs() {
  await page(logFile)
}

/* eslint-enable no-console */
