import {readFileSync} from '@shopify/cli-kit/node/fs'
import {itemToString} from '@shopify/cli-kit/node/output'
import {TokenItem} from '@shopify/cli-kit/node/ui'
import {Severity, type Offense, check} from '@shopify/theme-check-node'

/**
 * Returns a code snippet from a file. All line numbers given MUST be zero indexed
 */
function getSnippet(absolutePath: string, startLine: number, endLine: number) {
  const fileContent = readFileSync(absolutePath).toString()
  const lines = fileContent.split('\n')
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
function formatOffenses(offenses: Offense[]): TokenItem {
  const offenseBodies = offenses.map((offense, index) => {
    const {message, absolutePath, start, end, check, severity} = offense
    // Theme check line numbers are zero indexed, but intuitively 1-indexed
    const codeSnippet = getSnippet(absolutePath, start.line, end.line)

    // Ensure enough padding between offenses
    const offensePadding = `${index === offenses.length - 1 ? '' : '\n\n'}`

    return [
      severityToToken(severity),
      {bold: `${check}`},
      {subdued: `\n${message}`},
      `\n\n${codeSnippet}`,
      offensePadding,
    ]
  })

  return offenseBodies.flat()
}

export async function runThemeCheck(directory: string): Promise<string> {
  const configPath = 'theme-check:theme-app-extension'
  const offenses = await check(directory, configPath)
  const formattedOffenses = formatOffenses(offenses)
  return itemToString(formattedOffenses)
}
