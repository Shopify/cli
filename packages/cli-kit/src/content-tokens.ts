import {relativize as relativizePath} from './path.js'
import colors from './public/node/colors.js'
import {Message, stringifyMessage} from './output.js'
import terminalLink from 'terminal-link'
import cjs from 'color-json'
import type {Change} from 'diff'

export abstract class ContentToken<T> {
  value: T

  constructor(value: T) {
    this.value = value
  }

  abstract output(): string | string[]
}

export class RawContentToken extends ContentToken<string> {
  output(): string {
    return this.value
  }
}

export class LinkContentToken extends ContentToken<Message> {
  link: string

  constructor(value: Message, link: string) {
    super(value)
    this.link = link
  }

  output() {
    return terminalLink(colors.green(stringifyMessage(this.value)), this.link ?? '')
  }
}

export class CommandContentToken extends ContentToken<Message> {
  output(): string {
    return colors.bold(colors.yellow(stringifyMessage(this.value)))
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class JsonContentToken extends ContentToken<any> {
  output(): string {
    try {
      return cjs(stringifyMessage(this.value) ?? {})
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_) {
      return JSON.stringify(stringifyMessage(this.value) ?? {}, null, 2)
    }
  }
}

export class LinesDiffContentToken extends ContentToken<Change[]> {
  output(): string[] {
    return this.value
      .map((part) => {
        if (part.added) {
          return part.value
            .split(/\n/)
            .filter((line) => line !== '')
            .map((line) => {
              return colors.green(`+ ${line}\n`)
            })
        } else if (part.removed) {
          return part.value
            .split(/\n/)
            .filter((line) => line !== '')
            .map((line) => {
              return colors.magenta(`- ${line}\n`)
            })
        } else {
          return part.value
        }
      })
      .flat()
  }
}

export class ColorContentToken extends ContentToken<Message> {
  color: (text: string) => string

  constructor(value: Message, color: (text: string) => string) {
    super(value)
    this.color = color
  }

  output(): string {
    return this.color(stringifyMessage(this.value))
  }
}

export class ErrorContentToken extends ContentToken<Message> {
  output(): string {
    return colors.bold.redBright(stringifyMessage(this.value))
  }
}

export class PathContentToken extends ContentToken<Message> {
  output(): string {
    return relativizePath(stringifyMessage(this.value))
  }
}

export class HeadingContentToken extends ContentToken<Message> {
  output(): string {
    return colors.bold.underline(stringifyMessage(this.value))
  }
}

export class SubHeadingContentToken extends ContentToken<Message> {
  output(): string {
    return colors.underline(stringifyMessage(this.value))
  }
}

export class ItalicContentToken extends ContentToken<Message> {
  output(): string {
    return colors.italic(stringifyMessage(this.value))
  }
}
