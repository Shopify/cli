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

export const success = (content: Message) => {
  console.log(colors.green(`🎉 ${stringifyMessage(content)}`))
}

export const message = (content: Message) => {
  console.log(stringifyMessage(content))
}

export const newline = () => {
  console.log()
}

export const error = (content: Fatal) => {
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

export const warning = (content: Message) => {
  console.warn(colors.yellow(stringifyMessage(content)))
}

function stringifyMessage(message: Message): string {
  if (message instanceof TokenizedString) {
    return message.value
  } else {
    return message
  }
}
/* eslint-enable no-console */
