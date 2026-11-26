type TomlKeyPath = (string | number)[]

const BARE_KEY = /^[A-Za-z0-9_-]+$/
// Repository-controlled arrays and inline tables must not exhaust the JavaScript call stack.
const MAX_VALUE_NESTING = 128

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
 * quoted key with an escape or a value beyond the nesting limit, and keeps only the lines it found before that
 * point: a value it can't place gets no line, never the line of another value.
 */
export function locateTomlValues(content: string): Map<string, number> {
  const lines = new Map<string, number>()
  const arrayTableCounts = new Map<string, number>()
  let cursor = 0
  let lineCursor = 0
  let line = 1

  function record(path: TomlKeyPath, offset: number): void {
    // Values are recorded in source order, so each newline only needs to be counted once.
    while (lineCursor < offset) {
      if (content[lineCursor] === '\n') line++
      lineCursor++
    }
    lines.set(tomlKey(path), line)
  }

  function skipWhitespace(): void {
    while (cursor < content.length) {
      if (' \t\r\n\uFEFF'.includes(content[cursor]!)) cursor++
      else if (content[cursor] === '#') {
        const end = content.indexOf('\n', cursor)
        cursor = end === -1 ? content.length : end
      } else break
    }
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

  function readKey(): string[] | undefined {
    const segments: string[] = []
    const keySegment = /[A-Za-z0-9_-]+|"[^"\\\n]*"|'[^'\n]*'/y
    for (;;) {
      skipWhitespace()
      keySegment.lastIndex = cursor
      const match = keySegment.exec(content)
      if (!match) return undefined
      const text = match[0]
      segments.push(text[0] === '"' || text[0] === "'" ? text.slice(1, -1) : text)
      cursor = keySegment.lastIndex
      skipWhitespace()
      if (content[cursor] !== '.') return segments
      cursor++
    }
  }

  function readValue(path: TomlKeyPath, depth: number): boolean {
    if (depth > MAX_VALUE_NESTING) return false
    skipWhitespace()
    const start = cursor
    const character = content[cursor]
    if (character === '[' || character === '{') return readContainer(path, depth, character)
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

  function readContainer(path: TomlKeyPath, depth: number, opening: '[' | '{'): boolean {
    const isArray = opening === '['
    const closing = isArray ? ']' : '}'
    cursor++
    let index = 0
    for (;;) {
      skipWhitespace()
      if (content[cursor] === closing) break
      const read = isArray ? readValue([...path, index++], depth + 1) : readKeyValue(path, depth + 1)
      if (!read) return false
      skipWhitespace()
      if (content[cursor] === ',') cursor++
      else if (content[cursor] !== closing) return false
    }
    cursor++
    return true
  }

  function readKeyValue(table: TomlKeyPath, depth = 0): boolean {
    const key = readKey()
    if (!key || content[cursor] !== '=') return false
    cursor++
    return readValue([...table, ...key], depth)
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
    skipWhitespace()
    if (cursor >= content.length) break
    if (content[cursor] === '[') {
      const header = readTableHeader()
      if (!header) break
      table = header
    } else if (!readKeyValue(table)) {
      break
    }
  }
  return lines
}
