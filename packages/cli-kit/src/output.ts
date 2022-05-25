/* eslint-disable no-console */
import {Fatal, Bug} from './error'
import {isUnitTest} from './environment/local'
import terminalLink from 'terminal-link'
import colors from 'ansi-colors'
import StackTracey from 'stacktracey'
import AbortController from 'abort-controller'
import {Writable} from 'node:stream'

enum ContentTokenType {
  Command,
  Path,
  Link,
  Heading,
  SubHeading,
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
  value: string
  metadata: ContentMetadata

  constructor(value: string, metadata: ContentMetadata = {}, type: ContentTokenType) {
    this.type = type
    this.value = value
    this.metadata = metadata
  }
}

export const token = {
  command: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Command)
  },
  path: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Path)
  },
  link: (value: string, link: string) => {
    return new ContentToken(value, {link}, ContentTokenType.Link)
  },
  heading: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Heading)
  },
  subheading: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.SubHeading)
  },
  errorText: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.ErrorText)
  },
  cyan: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Cyan)
  },
  yellow: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Yellow)
  },
  magenta: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Magenta)
  },
  green: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Green)
  },
}

// output.content`Something ${output.token.command(Something)}`

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
        case ContentTokenType.Command:
          output += colors.bold(colors.yellow(enumToken.value))
          break
        case ContentTokenType.Path:
          output += colors.italic(enumToken.value)
          break
        case ContentTokenType.Link:
          output += terminalLink(colors.green(enumToken.value), enumToken.metadata.link ?? '')
          break
        case ContentTokenType.Heading:
          output += colors.bold.underline(enumToken.value)
          break
        case ContentTokenType.SubHeading:
          output += colors.underline(enumToken.value)
          break
        case ContentTokenType.ErrorText:
          output += colors.bold.redBright(enumToken.value)
          break
        case ContentTokenType.Yellow:
          output += colors.yellow(enumToken.value)
          break
        case ContentTokenType.Cyan:
          output += colors.cyan(enumToken.value)
          break
        case ContentTokenType.Magenta:
          output += colors.magenta(enumToken.value)
          break
        case ContentTokenType.Green:
          output += colors.green(enumToken.value)
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
  if (process.argv.includes('--verbose')) {
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
  if (shouldOutput('info')) {
    consoleLog(colors.bold(`✅ Success! ${stringifyMessage(content)}.`))
  }
}

/**
 * Outputs a completed message to the user.
 * Completed message receive a special formatting to make them stand out in the console.
 * Note: Completed messages are sent through the standard output.
 * @param content {string} The content to be output to the user.
 */
export const completed = (content: Message) => {
  if (shouldOutput('info')) {
    consoleLog(`${colors.green('✔')} ${stringifyMessage(content)}.`)
  }
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
  if (shouldOutput('error')) {
    if (!content.message) {
      return
    }
    const message = content.message
    const padding = '    '
    const header = colors.redBright(`\n━━━━━━ Error ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    const footer = colors.redBright('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    consoleError(header)
    const lines = message.split('\n')
    for (const line of lines) {
      consoleError(`${padding}${line}`)
    }
    if (content.tryMessage) {
      consoleError(`\n${padding}${colors.bold('What to try:')}`)
      const lines = content.tryMessage.split('\n')
      for (const line of lines) {
        consoleError(`${padding}${line}`)
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
        consoleError(`\n${padding}${colors.bold('Stack trace:')}`)
        const stackLines = stack.asTable({}).split('\n')
        for (const stackLine of stackLines) {
          consoleError(`${padding}${stackLine}`)
        }
      }
    }
    consoleError(footer)
  }
}

export function stringifyMessage(message: Message): string {
  if (message instanceof TokenizedString) {
    return message.value
  } else {
    return message
  }
}

const message = (content: Message, level: LogLevel = 'info') => {
  if (shouldOutput(level)) {
    consoleLog(stringifyMessage(content))
  }
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
export async function concurrent(processes: OutputProcess[]) {
  const abortController = new AbortController()

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
              message(content`${linePrefix(process.prefix, index)}${colors.bold('ERROR')} ${line}`, 'error')
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

/* eslint-enable no-console */
