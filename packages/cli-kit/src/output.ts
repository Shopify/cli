/* eslint-disable no-console */
import {Fatal} from './error'
import terminalLink from 'terminal-link'
import colors from 'ansi-colors'
import {Writable} from 'node:stream'

enum ContentTokenType {
  Command,
  Path,
  Link,
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

class TokenizedString {
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
          output += terminalLink(enumToken.value, enumToken.metadata.link ?? '')
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
    console.log(`${colors.magenta('✔')} ${stringifyMessage(content)}`)
  }
}

/**
 * Ouputs debug information to the user. By default these output is hidden unless the user calls the CLI with --verbose.
 * Debug messages don't get additional formatting.
 * Note: Debug messages are sent through the standard output.
 * @param content {string} The content to be output to the user.
 */
export const debug = (content: Message) => {
  message(content, 'debug')
}

/**
 * Outputs a warning message to the user.
 * Warning messages receive a special formatting to make them stand out in the console.
 * Note: Warning messages are sent through the standard output.
 * @param content {string} The content to be output to the user.
 */
export const warn = (content: Message) => {
  console.warn(colors.yellow(stringifyMessage(content)))
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
export const error = (content: Fatal) => {
  if (shouldOutput('error')) {
    const message = content.message || 'Unknown error'
    const padding = '    '
    const header = colors.redBright(`\n━━━━━━ Error ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    const footer = colors.redBright('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.error(header)
    console.error(padding + stringifyMessage(message))
    if (content.tryMessage) {
      console.error(`\n${padding}${colors.bold('What to try:')}`)
      const lines = content.tryMessage.split('\n')
      lines.forEach((line) => {
        console.error(`${padding}${line}`)
      })
    }
    console.error(footer)
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
    console.log(stringifyMessage(content))
  }
}

/**
 * Use this function when you have multiple concurrent processes that send data events
 * and we need to output them ensuring that they can visually differenciated by the user.
 *
 * @param index {number} The index of the process being run. This is used to determine the color.
 * @param prefix {string} The prefix to include in the standard output data to differenciate logs.
 * @param process The callback that's called with a Writable instance to send events through.
 */
export async function concurrent(index: number, prefix: string, process: (stdout: Writable) => Promise<void>) {
  const colors = [token.yellow, token.cyan, token.magenta, token.green]

  const stdout = new Writable({
    write(chunk, encoding, next) {
      const lines = chunk.toString('ascii').split('\n')
      const color = colors[colors.length % (index + 1)]
      const linePrefix = color(`[${prefix}]: `)
      for (const line of lines) {
        info(content`${linePrefix}${line}`)
      }
      next()
    },
  })
  await process(stdout)
}

/* eslint-enable no-console */
