import {Offense, Theme, Severity} from '@shopify/theme-check-common'
import fs from 'fs'

interface CommandToken {
  command: string
}

interface LinkToken {
  link: {
    label?: string
    url: string
  }
}

interface CharToken {
  char: string
}

interface UserInputToken {
  userInput: string
}

interface SubduedToken {
  subdued: string
}

interface FilePathToken {
  filePath: string
}

type InlineToken = Exclude<Token, ListToken>
interface ListToken {
  list: {
    title?: TokenItem<InlineToken>
    items: TokenItem<InlineToken>[]
    ordered?: boolean
  }
}

interface BoldToken {
  bold: string
}

type Token =
  | string
  | CommandToken
  | LinkToken
  | CharToken
  | UserInputToken
  | SubduedToken
  | FilePathToken
  | ListToken
  | BoldToken

type TokenItem<T extends Token = Token> = T | T[]

interface CustomSection {
  title?: string
  body: TokenItem
}

// TODO: CONSIDER EXPOSING THOSE TYPES PUBLICALLY FROM UI-KIT
// TODO: might not need to export once moved code into here
interface OffensesByCheck {
  [check: string]: Offense[]
}

const getSnippet = (absolutePath: string, startLine: number, endLine: number) => {
  const fileContent = fs.readFileSync(absolutePath, 'utf-8')
  const lines = fileContent.split('\n')
  const snippetLines = lines.slice(startLine, endLine + 1)
  return snippetLines.join('\n')
}

/**
 * Format theme-check Offenses into a format for cli-kit to output.
 */
export function formatOffenses(offenses: Offense[]): TokenItem {
  const offenseBodies = []

  for (const offense of offenses) {
    const {message, absolutePath, start, end, check} = offense
    const line = start.line === end.line ? `L${start.line}` : `L${start.line} - L${end.line}`

    const codeSnippet = getSnippet(absolutePath, start.line, end.line).trim()

    const offenseDetails = `${check}\n${message}\n\n${codeSnippet}\n\n`
    /**
     * Leading newlines works around a formatting issue in the ui library where
     * spaces are automatically appended between tokens. This can cause unexpected
     * formatting issues when presenting theme check offenses
     */
    offenseBodies.push([{bold: `\n${line}:`}, offenseDetails])
  }

  return offenseBodies.flat()
}

/**
 * Sorts theme check offenses. First all offenses are grouped by file path,
 *
 * then within each collection of offenses, they are sorted by severity.
 */
export function sortOffenses(offenses: Offense[]): OffensesByCheck {
  const offensesByFile = offenses.reduce((acc: OffensesByCheck, offense: Offense) => {
    const {absolutePath} = offense
    if (!acc[absolutePath]) {
      acc[absolutePath] = []
    }

    acc[absolutePath]!.push(offense)
    return acc
  }, {})

  const severitySorted: OffensesByCheck = {}
  Object.keys(offensesByFile).forEach((filePath) => {
    severitySorted[filePath] = offensesByFile[filePath]!.sort(
      (offenseA, offenseB) => offenseA.severity - offenseB.severity,
    )
  })

  return severitySorted
}

export function formatSummary(offenses: Offense[], theme: Theme): string[] {
  const summary = [`${theme.length} files inspected`]

  if (offenses.length === 0) {
    summary.push('with no offenses found.')
  } else {
    summary.push(`with ${offenses.length} total offenses found.`)
    const {numErrors, numWarnings, numInfos} = offenses.reduce(
      (acc, offense) => {
        switch (offense.severity) {
          case Severity.ERROR:
            acc.numErrors++
            break
          case Severity.WARNING:
            acc.numWarnings++
            break
          case Severity.INFO:
            acc.numInfos++
            break
        }
        return acc
      },
      {numErrors: 0, numWarnings: 0, numInfos: 0},
    )

    if (numErrors > 0) {
      summary.push(`\n${numErrors} errors.`)
    }
    if (numWarnings > 0) {
      summary.push(`\n${numWarnings} suggestions.`)
    }
    if (numInfos > 0) {
      summary.push(`\n${numInfos} style issues.`)
    }
  }

  return summary
}
