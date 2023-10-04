import {fileExists, readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'
import {renderError, renderTasks, renderWarning, type Task} from '@shopify/cli-kit/node/ui'
import {
  Severity,
  applyFixToString,
  autofix,
  loadConfig,
  themeCheckRun,
  type FixApplicator,
  type Offense,
  type Theme,
  type ThemeCheckRun,
} from '@shopify/theme-check-node'
import YAML from 'yaml'

interface OffenseMap {
  [check: string]: Offense[]
}

interface TransformedOffense {
  check: string
  severity: number
  start_row: number
  start_column: number
  end_row: number
  end_column: number
  message: string
}

interface TransformedOffenseMap {
  path: string
  offenses: TransformedOffense[]
  errorCount: number
  suggestionCount: number
  styleCount: number
}

/**
 * Returns a code snippet from a file.
 * @param absolutePath - The absolute path to the file.
 * @param startLine - The line number of the first line of the snippet.
 * @param endLine - The line number of the last line of the snippet.
 * @returns The code snippet.
 */
function getSnippet(absolutePath: string, startLine: number, endLine: number) {
  const fileContent = readFileSync(absolutePath).toString()
  const lines = fileContent.split('\n')
  const snippetLines = lines.slice(startLine, endLine + 1)
  return snippetLines.join('\n')
}

/**
 * Format theme-check Offenses into a format for cli-kit to output.
 */
export function formatOffenses(offenses: Offense[]) {
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

const offenseSeverityAscending = (offenseA: Offense, offenseB: Offense) => offenseA.severity - offenseB.severity

/**
 * Sorts theme check offenses. First all offenses are grouped by file path,
 *
 * then within each collection of offenses, they are sorted by severity.
 */
export function sortOffenses(offenses: Offense[]): OffenseMap {
  // Bucket offenses by filename
  const offensesByFile = offenses.reduce((acc: OffenseMap, offense: Offense) => {
    const {absolutePath} = offense
    if (!acc[absolutePath]) {
      acc[absolutePath] = []
    }

    acc[absolutePath]!.push(offense)
    return acc
  }, {})

  // Finally sort each collection of offenses by severity
  return Object.keys(offensesByFile).reduce((acc: OffenseMap, filePath) => {
    acc[filePath] = offensesByFile[filePath]!.sort(offenseSeverityAscending)
    return acc
  }, {})
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

export function renderOffensesText(offensesByFile: OffenseMap, themeRootPath: string) {
  const fileNames = Object.keys(offensesByFile).sort()

  fileNames.forEach((filePath) => {
    const hasErrorOffenses = offensesByFile[filePath]!.some((offense) => offense.severity === Severity.ERROR)
    const render = hasErrorOffenses ? renderError : renderWarning

    // Format the file path to be relative to the theme root.
    // Remove the leading slash agnostic of windows or unix.
    const headlineFilePath = filePath.replace(themeRootPath, '').slice(1)

    render({
      headline: headlineFilePath,
      body: formatOffenses(offensesByFile[filePath]!),
    })
  })
}

export function formatOffensesJson(offensesByFile: OffenseMap): TransformedOffenseMap[] {
  return Object.entries(offensesByFile).map(([path, offenses]) => {
    let errorCount = 0
    let suggestionCount = 0
    let styleCount = 0

    const transformedOffenses = offenses.map((offense: Offense) => {
      if (offense.severity === Severity.ERROR) errorCount++
      if (offense.severity === Severity.WARNING) suggestionCount++
      if (offense.severity === Severity.INFO) styleCount++

      return {
        check: offense.check,
        severity: offense.severity,
        start_row: offense.start.line,
        start_column: offense.start.character,
        end_row: offense.end.line,
        end_column: offense.end.character,
        message: offense.message,
      }
    })

    return {
      path,
      offenses: transformedOffenses,
      errorCount,
      suggestionCount,
      styleCount,
    }
  })
}

const SEVERITY_MAP = {
  error: Severity.ERROR,
  suggestion: Severity.WARNING,
  style: Severity.INFO,
}

export type FailLevel = 'error' | 'suggestion' | 'style'

/**
 * Handles the process exit based on the offenses and fail level.
 */
export function handleExit(offenses: Offense[], failLevel?: FailLevel) {
  // If there is no fail level set, exit with 0
  if (!failLevel) process.exit(0)

  const failSeverity = SEVERITY_MAP[failLevel]
  const shouldFail = offenses.some((offense) => offense.severity < failSeverity)

  process.exit(shouldFail ? 1 : 0)
}

/**
 * Adds a '#' character at the start of each line in a string.
 */
function commentString(input: string): string {
  return input
    .split('\n')
    .map((line) => `# ${line}`)
    .join('\n')
}

export async function initConfig(root: string) {
  const basefile = '.theme-check.yml'
  const filePath = `${root}/${basefile}`
  if (await fileExists(filePath)) {
    outputInfo(`${basefile} already exists at ${root}`)
    return
  }

  // The initialized config will extend the recommended settings and
  // will simply show the commented checks for the user to customize.
  const {settings} = await loadConfig(undefined, root)
  const checksYml = commentString(YAML.stringify(settings))

  const initConfigYml = YAML.stringify({extends: 'theme-check:recommended', ignore: ['node_modules/**']})

  await writeFile(filePath, `${initConfigYml}${checksYml}`)

  outputSuccess(`Created ${basefile} at ${root}`)
}

export async function runThemeCheck(themeRoot: string, configPath?: string) {
  let themeCheckResults = {} as ThemeCheckRun

  const themeCheckTask: Task = {
    title: `Performing theme check. Please wait...\nEvaluating ${themeRoot}`,
    task: async () => {
      themeCheckResults = await themeCheckRun(themeRoot, configPath)
    },
  }

  await renderTasks([themeCheckTask])

  return themeCheckResults
}

const saveToDiskFixApplicator: FixApplicator = async (sourceCode, fix) => {
  const updatedSource = applyFixToString(sourceCode.source, fix)
  await writeFile(sourceCode.absolutePath, updatedSource)
}

export async function performAutoFixes(sourceCodes: Theme, offenses: Offense[]) {
  await autofix(sourceCodes, offenses, saveToDiskFixApplicator)
}
