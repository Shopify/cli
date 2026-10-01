import colors from '../../public/node/colors.js'
import {OutputMessage, stringifyMessage} from '../../public/node/output.js'
import {relativizePath} from '../../public/node/path.js'
import ansiEscapes from 'ansi-escapes'
import supportsHyperlinks from 'supports-hyperlinks'
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

export class LinkContentToken extends ContentToken<OutputMessage> {
  link: string
  fallback: string | undefined

  constructor(value: OutputMessage, link?: string, fallback?: string) {
    super(value)
    this.link = link ?? stringifyMessage(value)
    this.fallback = fallback
  }

  output() {
    const text = colors.green(stringifyMessage(this.value))
    const url = this.link ?? ''
    const defaultFallback = this.value === this.link ? text : `${text} ( ${url} )`
    if (supportsHyperlinks.stdout) {
      return ansiEscapes.link(text, url)
    }
    return this.fallback ?? defaultFallback
  }
}

export class CommandContentToken extends ContentToken<OutputMessage> {
  output(): string {
    return `\`${colors.magentaBright(stringifyMessage(this.value))}\``
  }
}

// Token-matching regex taken from the color-json package this implementation replaces:
// https://www.npmjs.com/package/color-json
const jsonTokenRegex =
  /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g

function colorJson(input: unknown): string {
  const object = typeof input === 'string' ? JSON.parse(input) : input
  const json = JSON.stringify(object, undefined, 2)
  const colorized = json.replace(jsonTokenRegex, (match) => {
    if (match.startsWith('"')) {
      return match.endsWith(':') ? colors.white(match) : colors.green(match)
    }
    if (match === 'true' || match === 'false') {
      return colors.cyan(match)
    }
    if (match === 'null') {
      return colors.red(match)
    }
    return colors.magenta(match)
  })
  // The outer yellow colors the structural characters (braces, brackets, commas);
  // chalk reopens it after each nested token color.
  return colors.yellow(colorized)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class JsonContentToken extends ContentToken<any> {
  output(): string {
    try {
      return colorJson(stringifyMessage(this.value) ?? {})
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_) {
      return JSON.stringify(stringifyMessage(this.value) ?? {}, null, 2)
    }
  }
}

export class LinesDiffContentToken extends ContentToken<Change[]> {
  output(): string[] {
    return this.value.flatMap((part) => {
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
  }
}

export class ColorContentToken extends ContentToken<OutputMessage> {
  color: (text: string) => string

  constructor(value: OutputMessage, color: (text: string) => string) {
    super(value)
    this.color = color
  }

  output(): string {
    return this.color(stringifyMessage(this.value))
  }
}

export class ErrorContentToken extends ContentToken<OutputMessage> {
  output(): string {
    return colors.bold.redBright(stringifyMessage(this.value))
  }
}

export class PathContentToken extends ContentToken<OutputMessage> {
  output(): string {
    return relativizePath(stringifyMessage(this.value))
  }
}

export class HeadingContentToken extends ContentToken<OutputMessage> {
  output(): string {
    return colors.bold.underline(stringifyMessage(this.value))
  }
}

export class SubHeadingContentToken extends ContentToken<OutputMessage> {
  output(): string {
    return colors.underline(stringifyMessage(this.value))
  }
}

export class ItalicContentToken extends ContentToken<OutputMessage> {
  output(): string {
    return colors.italic(stringifyMessage(this.value))
  }
}
