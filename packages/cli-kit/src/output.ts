/* eslint-disable no-console */
import {Fatal} from './error'
import terminalLink from 'terminal-link'
import colors from 'ansi-colors'

enum ContentTokenType {
  Command,
  Path,
  Link,
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
}

// output.content`Something ${output.token.command(Something)}`

class TokenizedString {
  value: string
  constructor(value: string) {
    this.value = value
  }
}

type Message = string | TokenizedString

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

const message = (content: Message, level: LogLevel = 'info') => {
  if (shouldOutput(level)) {
    console.log(stringifyMessage(content))
  }
}

export const success = (content: Message) => {
  if (shouldOutput('info')) {
    console.log(colors.green(`🎉 ${stringifyMessage(content)}`))
  }
}

export const info = (content: Message) => {
  message(content, 'info')
}

export const debug = (content: Message) => {
  message(content, 'debug')
}

export const warn = (content: Message) => {
  console.warn(colors.yellow(stringifyMessage(content)))
}

export const newline = () => {
  console.log()
}

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
      console.error(padding + content.tryMessage)
    }
    console.error(footer)
  }
}

function stringifyMessage(message: Message): string {
  if (message instanceof TokenizedString) {
    return message.value
  } else {
    return message
  }
}
/* eslint-enable no-console */
