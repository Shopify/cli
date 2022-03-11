import pc from 'picocolors'
import terminalLink from 'terminal-link'

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
          output += pc.bold(pc.yellow(enumToken.value))
          break
        case ContentTokenType.Path:
          output += pc.italic(enumToken.value)
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
  // eslint-disable-next-line no-console
  console.log(pc.green(`🎉 ${stringifyMessage(content)}`))
}

export const message = (content: Message) => {
  // eslint-disable-next-line no-console
  console.log(stringifyMessage(content))
}

export const error = (content: Message) => {
  // eslint-disable-next-line no-console
  console.error(stringifyMessage(content))
}

export const warning = (content: Message) => {
  // eslint-disable-next-line no-console
  console.warn(pc.yellow(stringifyMessage(content)))
}

function stringifyMessage(message: Message): string {
  if (message instanceof TokenizedString) {
    return message.value
  } else {
    return message
  }
}
