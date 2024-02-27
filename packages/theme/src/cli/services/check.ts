import {fileExists, readFileSync, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {
  Severity,
  applyFixToString,
  autofix,
  loadConfig,
  type FixApplicator,
  type Offense,
  type Theme,
} from '@shopify/theme-check-node'
import YAML from 'yaml'

interface OffenseMap {
  [check: string]: Offense[]
}

interface TransformedOffense {
  check: string
  severity: string
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
  warningCount: number
  infoCount: number
}

type SeverityCounts = Partial<{
  [K in keyof typeof Severity]: number
}>

export type FailLevel = 'error' | 'suggestion' | 'style' | 'warning' | 'info' | 'crash'

function failLevelToSeverity(failLevel: FailLevel): Severity | undefined {
  switch (failLevel) {
    case 'error':
      return Severity.ERROR
    case 'suggestion':
    case 'warning':
      return Severity.WARNING
    case 'style':
    case 'info':
      return Severity.INFO
    case 'crash':
      return undefined
  }
}

function severityToLabel(severity: Severity) {
  switch (severity) {
    case Severity.ERROR:
      return 'error'
    case Severity.WARNING:
      return 'warning'
    case Severity.INFO:
      return 'info'
  }
}

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
export function formatOffenses(offenses: Offense[]) {
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

const offenseSeverityAscending = (offenseA: Offense, offenseB: Offense) => offenseA.severity - offenseB.severity

/**
 * Sorts theme check offenses. First all offenses are grouped by file path,
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

/**
 * Returns the number of offenses for each severity type.
 */
function countOffenseTypes(offenses: Offense[]) {
  return offenses.reduce((acc: SeverityCounts, offense: Offense) => {
    const isSeverityUncounted = !Object.prototype.hasOwnProperty.call(acc, offense.severity)
    if (isSeverityUncounted) {
      acc[offense.severity] = 0
    }

    acc[offense.severity]!++

    return acc
  }, {})
}

export function formatSummary(offenses: Offense[], offensesByFile: OffenseMap, theme: Theme): string[] {
  const summary = [`${theme.length} files inspected`]

  if (offenses.length === 0) {
    summary.push('with no offenses found.')
  } else {
    summary.push(`with ${offenses.length} total offenses found across ${Object.keys(offensesByFile).length} files.`)

    const counts = countOffenseTypes(offenses)

    if (counts[Severity.ERROR]) {
      summary.push(`\n${counts[Severity.ERROR]} errors.`)
    }
    if (counts[Severity.WARNING]) {
      summary.push(`\n${counts[Severity.WARNING]} warnings.`)
    }
    if (counts[Severity.INFO]) {
      summary.push(`\n${counts[Severity.INFO]} info issues.`)
    }
  }

  return summary
}

export function renderOffensesText(offensesByFile: OffenseMap, themeRootPath: string) {
  const fileNames = Object.keys(offensesByFile).sort()

  fileNames.forEach((filePath) => {
    // Format the file path to be relative to the theme root.
    // Remove the leading slash agnostic of windows or unix.
    const headlineFilePath = filePath.replace(themeRootPath, '').slice(1)

    renderInfo({
      headline: headlineFilePath,
      body: formatOffenses(offensesByFile[filePath]!),
    })
  })
}

export function formatOffensesJson(offensesByFile: OffenseMap): TransformedOffenseMap[] {
  return Object.entries(offensesByFile).map(([path, offenses]) => {
    const transformedOffenses = offenses.map((offense: Offense) => {
      return {
        check: offense.check,
        severity: severityToLabel(offense.severity),
        start_row: offense.start.line,
        start_column: offense.start.character,
        end_row: offense.end.line,
        end_column: offense.end.character,
        message: offense.message,
      }
    })

    const counts = countOffenseTypes(offenses)

    return {
      path,
      offenses: transformedOffenses,
      errorCount: counts[Severity.ERROR] || 0,
      warningCount: counts[Severity.WARNING] || 0,
      infoCount: counts[Severity.INFO] || 0,
    }
  })
}

/**
 * Handles the process exit based on the offenses and fail level.
 */
export function handleExit(offenses: Offense[], failLevel: FailLevel) {
  // If there is no fail level set, exit with 0
  if (!failLevel) process.exit(0)

  const failSeverity = failLevelToSeverity(failLevel)
  const shouldFail = failSeverity !== undefined && offenses.some((offense) => offense.severity <= failSeverity)

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
  const filePath = joinPath(root, basefile)
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

const saveToDiskFixApplicator: FixApplicator = async (sourceCode, fix) => {
  const updatedSource = applyFixToString(sourceCode.source, fix)
  await writeFile(sourceCode.absolutePath, updatedSource)
}

export async function performAutoFixes(sourceCodes: Theme, offenses: Offense[]) {
  await autofix(sourceCodes, offenses, saveToDiskFixApplicator)
}

export async function outputActiveConfig(themeRoot: string, configPath?: string) {
  const {ignore, settings, root} = await loadConfig(configPath, themeRoot)

  const config = {
    // loadConfig flattens all configs, it doesn't extend anything
    extends: [],

    // Depending on how the configs were merged during loadConfig, there may be
    // duplicate patterns to ignore. We can clean them before outputting.
    ignore: [...new Set(ignore)],

    root,

    // Dump out the active settings for all checks.
    ...settings,
  }
  outputInfo(YAML.stringify(config))
}

export async function outputActiveChecks(root: string, configPath?: string) {
  const {settings, ignore, checks} = await loadConfig(configPath, root)
  // Depending on how the configs were merged during loadConfig, there may be
  // duplicate patterns to ignore. We can clean them before outputting.
  const ignorePatterns = [...new Set(ignore)]

  const checkCodes = Object.keys(settings)

  const checksList = checkCodes.reduce((acc: {[key: string]: unknown}, checkCode: string) => {
    const {severity, enabled, ...additional} = settings[checkCode]!
    if (!enabled) {
      return acc
    }

    const severityLabel = severityToLabel(severity === undefined ? Severity.INFO : severity)

    // Map metafields from the check into desired output format
    const meta = checks.find((check) => check.meta.code === checkCode)
    const metafields =
      meta && meta.meta
        ? {
            description: meta.meta.docs.description,
            doc: meta.meta.docs.url,
          }
        : {}

    acc[checkCode] = {
      severity: severityLabel,
      ...metafields,
      // Manually formatting ignore patterns to keep single line array output
      ignored_patterns: `[${ignorePatterns.join(', ')}]`,
      ...additional,
    }
    return acc
  }, {})

  outputInfo(YAML.stringify(checksList))
}

interface ExtendedWriteStream extends NodeJS.WriteStream {
  _handle: {
    setBlocking: (blocking: boolean) => void
  }
}

interface HandleObject {
  _handle: unknown
}

interface HandleWithSetBlocking {
  _handle: {
    setBlocking: unknown
  }
}

export function isExtendedWriteStream(stream: NodeJS.WriteStream): stream is ExtendedWriteStream {
  return (
    '_handle' in stream &&
    typeof (stream as HandleObject)._handle === 'object' &&
    (stream as HandleObject)._handle !== null &&
    typeof (stream as HandleWithSetBlocking)._handle.setBlocking === 'function'
  )
}
