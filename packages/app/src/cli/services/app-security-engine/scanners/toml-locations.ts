type TomlKeyPath = (string | number)[]

const BARE_KEY = /^[A-Za-z0-9_-]+$/

/**
 * Writes a TOML key path as text, for example `webhooks.subscriptions[1].uri`: bare keys joined with dots,
 * other keys quoted, and array indexes (zero-based) in brackets.
 */
export function tomlKey(path: TomlKeyPath): string {
  return path
    .map((segment, position) => {
      if (typeof segment === 'number') return `[${segment}]`
      const name = BARE_KEY.test(segment) ? segment : JSON.stringify(segment)
      return position === 0 ? name : `.${name}`
    })
    .join('')
}

/**
 * Finds the one-based line of each scalar value in TOML text, keyed by `tomlKey`. Array elements, including the
 * tables of an array of tables, are keyed by their index.
 *
 * The text must be TOML that already parsed. The scanner stops at the first construct it doesn't read, such as a
 * quoted key with an escape, and keeps only the lines it found before that point: a value it can't place gets no
 * line, never the line of another value.
 */
export function locateTomlValues(content: string): Map<string, number> {
  const lines = new Map<string, number>()
  const arrayTableCounts = new Map<string, number>()
  let cursor = 0

  function record(path: TomlKeyPath, offset: number): void {
    lines.set(tomlKey(path), content.slice(0, offset).split('\n').length)
  }

  function skipSpaces(): void {
    while (cursor < content.length && ' \t\r\uFEFF'.includes(content[cursor]!)) cursor++
  }

  function skipComment(): void {
    if (content[cursor] !== '#') return
    while (cursor < content.length && content[cursor] !== '\n') cursor++
  }

  function skipBlankLines(): void {
    let start: number
    do {
      start = cursor
      skipSpaces()
      skipComment()
      if (content[cursor] === '\n') cursor++
    } while (cursor !== start)
  }

  function atLineEnd(): boolean {
    skipSpaces()
    skipComment()
    return cursor >= content.length || content[cursor] === '\n'
  }

  /** Returns the offset after the string that starts at `start`, or undefined when it isn't terminated. */
  function stringEnd(start: number): number | undefined {
    const quote = content[start]!
    const delimiter = quote.repeat(3)
    if (content.startsWith(delimiter, start)) {
      let position = start + 3
      while (position < content.length) {
        if (quote === '"' && content[position] === '\\') {
          position += 2
        } else if (content.startsWith(delimiter, position)) {
          // Up to two quotes can end the string's content right before the closing delimiter.
          let end = position + 3
          while (end < position + 5 && content[end] === quote) end++
          return end
        } else {
          position++
        }
      }
      return undefined
    }
    let position = start + 1
    while (position < content.length && content[position] !== '\n') {
      if (quote === '"' && content[position] === '\\') position += 2
      else if (content[position] === quote) return position + 1
      else position++
    }
    return undefined
  }

  function readKeySegment(): string | undefined {
    const quote = content[cursor]
    if (quote === '"' || quote === "'") {
      if (content.startsWith(quote.repeat(3), cursor)) return undefined
      const end = stringEnd(cursor)
      if (end === undefined) return undefined
      const name = content.slice(cursor + 1, end - 1)
      if (quote === '"' && name.includes('\\')) return undefined
      cursor = end
      return name
    }
    const bare = /[A-Za-z0-9_-]+/y
    bare.lastIndex = cursor
    const match = bare.exec(content)
    if (!match) return undefined
    cursor += match[0].length
    return match[0]
  }

  function readKey(): string[] | undefined {
    const segments: string[] = []
    let hasNextSegment = true
    while (hasNextSegment) {
      skipSpaces()
      const segment = readKeySegment()
      if (segment === undefined) return undefined
      segments.push(segment)
      skipSpaces()
      hasNextSegment = content[cursor] === '.'
      if (hasNextSegment) cursor++
    }
    return segments
  }

  function readValue(path: TomlKeyPath): boolean {
    skipSpaces()
    const start = cursor
    const character = content[cursor]
    if (character === '[') return readArray(path)
    if (character === '{') return readInlineTable(path)
    if (character === '"' || character === "'") {
      const end = stringEnd(cursor)
      if (end === undefined) return false
      cursor = end
    } else {
      // Numbers, booleans and dates, including dates with a space before the time.
      const scalar = /[^,\]}#\n]+/y
      scalar.lastIndex = cursor
      const match = scalar.exec(content)
      if (!match || match[0].trim() === '') return false
      cursor += match[0].length
    }
    record(path, start)
    return true
  }

  function readArray(path: TomlKeyPath): boolean {
    cursor++
    let index = 0
    for (;;) {
      skipBlankLines()
      if (content[cursor] === ']') break
      if (!readValue([...path, index])) return false
      index++
      skipBlankLines()
      if (content[cursor] === ',') cursor++
      else if (content[cursor] !== ']') return false
    }
    cursor++
    return true
  }

  function readInlineTable(path: TomlKeyPath): boolean {
    cursor++
    skipSpaces()
    if (content[cursor] === '}') {
      cursor++
      return true
    }
    for (;;) {
      if (!readKeyValue(path)) return false
      skipSpaces()
      if (content[cursor] === '}') break
      if (content[cursor] !== ',') return false
      cursor++
    }
    cursor++
    return true
  }

  function readKeyValue(table: TomlKeyPath): boolean {
    const key = readKey()
    if (!key || content[cursor] !== '=') return false
    cursor++
    return readValue([...table, ...key])
  }

  /** Resolves a table header against the arrays of tables seen so far: `[a.b]` after `[[a]]` is `a[last].b`. */
  function readTableHeader(): TomlKeyPath | undefined {
    const isArrayTable = content.startsWith('[[', cursor)
    cursor += isArrayTable ? 2 : 1
    const key = readKey()
    const closing = isArrayTable ? ']]' : ']'
    if (!key || !content.startsWith(closing, cursor)) return undefined
    cursor += closing.length
    const table: TomlKeyPath = []
    key.forEach((segment, position) => {
      table.push(segment)
      const id = JSON.stringify(table)
      const count = arrayTableCounts.get(id)
      if (isArrayTable && position === key.length - 1) {
        arrayTableCounts.set(id, (count ?? 0) + 1)
        table.push(count ?? 0)
      } else if (count !== undefined) {
        table.push(count - 1)
      }
    })
    return table
  }

  let table: TomlKeyPath = []
  for (;;) {
    skipBlankLines()
    if (cursor >= content.length) break
    if (content[cursor] === '[') {
      const header = readTableHeader()
      if (!header) break
      table = header
    } else if (!readKeyValue(table)) {
      break
    }
    if (!atLineEnd()) break
  }
  return lines
}
