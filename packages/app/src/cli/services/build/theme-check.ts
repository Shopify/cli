import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {itemToString} from '@shopify/cli-kit/node/output'
import {TokenItem} from '@shopify/cli-kit/node/ui'
import {Severity, type Offense, type Theme, themeCheckRun} from '@shopify/theme-check-node'

/** The contents of every theme file, keyed by its normalized uri. */
type ThemeSourcesByUri = Map<string, string>

/**
 * Theme check reads every file before running the checks, so their contents are
 * already in memory by the time offenses are rendered. Snippets are built from
 * that copy rather than read from disk again: a file can be deleted, moved, or
 * become unreadable while the checks run, and re-reading it made the build
 * crash after all the checks had already passed.
 */
function themeSourcesByUri(theme: Theme): ThemeSourcesByUri {
  return new Map(theme.map((sourceCode) => [sourceCode.uri, sourceCode.source]))
}

/**
 * Returns a code snippet from a file's contents. All line numbers given MUST be zero indexed
 */
function getSnippet(source: string, startLine: number, endLine: number) {
  const lines = source.split('\n')
  const snippetLines = lines.slice(startLine, endLine + 1)
  const isSingleLine = snippetLines.length === 1

  return snippetLines
    .map((line, index) => {
      // For each line in snippetLines, prepend the line number and a space.
      const lineNumber = startLine + index + 1

      // Normalize variable whitespace from single line snippets
      const formattedLine = isSingleLine ? line.trim() : line
      return `${lineNumber}  ${formattedLine}`
    })
    .join('\n')
}

function severityToToken(severity: Severity) {
  /**
   * Leading newlines works around a formatting behavior in the ui library where
   * spaces are automatically appended between tokens. This can cause unexpected
   * formatting issues when presenting theme check offenses
   */
  switch (severity) {
    case Severity.ERROR:
      return {error: '\n[error]:'}
    case Severity.WARNING:
      return {warn: '\n[warning]:'}
    case Severity.INFO:
      return {info: '\n[info]:'}
  }
}

/**
 * Format theme-check Offenses into a format for cli-kit to output.
 */
function formatOffenses(offenses: Offense[], themeSources: ThemeSourcesByUri): TokenItem {
  const offenseBodies = offenses.map((offense, index) => {
    const {message, uri, start, end, check, severity} = offense
    const source = themeSources.get(uri)

    // Theme check line numbers are zero indexed, but intuitively 1-indexed.
    // The snippet is omitted when the file contents are unavailable, so that a
    // missing snippet never hides the offense itself.
    const codeSnippet = source === undefined ? [] : [`\n\n${getSnippet(source, start.line, end.line)}`]

    // Ensure enough padding between offenses
    const offensePadding = index === offenses.length - 1 ? '' : '\n\n'

    return [severityToToken(severity), {bold: check}, {subdued: `\n${message}`}, ...codeSnippet, offensePadding]
  })

  return offenseBodies.flat()
}

export async function runThemeCheck(directory: string): Promise<string> {
  // Respect a user's `.theme-check.yml` in the extension root when present.
  // Falling through to `undefined` lets theme-check-node auto-discover the
  // user config; otherwise use the bundled theme-app-extension defaults.
  const hasUserConfig = await fileExists(joinPath(directory, '.theme-check.yml'))
  const configPath = hasUserConfig ? undefined : 'theme-check:theme-app-extension'
  const {offenses, theme} = await themeCheckRun(directory, configPath)
  const formattedOffenses = formatOffenses(offenses, themeSourcesByUri(theme))
  return itemToString(formattedOffenses)
}
