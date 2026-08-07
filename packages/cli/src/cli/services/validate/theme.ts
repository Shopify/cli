import {ValidationResult, type ValidationResponse} from './engine/contract.js'
import {hasFailedValidation} from './engine/format.js'
import {recordValidateMetadata} from './engine/telemetry.js'
import {
  check,
  extractDocDefinition,
  FileType as NodeFileType,
  recommended,
  Severity,
  SourceCodeType,
  toSchema,
  toSourceCode,
} from '@shopify/theme-check-common'
import {ThemeLiquidDocsManager} from '@shopify/theme-check-docs-updater'
import {themeCheckRun} from '@shopify/theme-check-node'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {outputResult, outputDebug} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import type {
  AbstractFileSystem,
  Config,
  FileStat,
  FileTuple,
  LiquidHtmlNode,
  Offense,
  SectionSchema,
  ThemeBlockSchema,
} from '@shopify/theme-check-common'

export type FileType = 'assets' | 'blocks' | 'config' | 'layout' | 'locales' | 'sections' | 'snippets' | 'templates'

export type ThemeContext = 'theme' | 'app'

export const VALID_FILE_TYPES: FileType[] = [
  'assets',
  'blocks',
  'config',
  'layout',
  'locales',
  'sections',
  'snippets',
  'templates',
]

export const VALID_CONTEXTS: ThemeContext[] = ['theme', 'app']

const DEFAULT_FILE_TYPE: FileType = 'sections'
const DEFAULT_CONTEXT: ThemeContext = 'theme'

/**
 * Inputs for a single theme validation run. The command only parses flags; the
 * service reads `--file` (as `filePath`) and validates `--filetype`/`--context`
 * itself so that every failure mode produces a structured validation response
 * rather than an oclif crash.
 *
 * Two modes, mirroring the source `validate_theme` script:
 *   - Full-app:  `themePath` (+ `files`) validates an on-disk theme.
 *   - Codeblock: `filename` (+ `code` or `filePath`) validates one stateless snippet.
 */
export interface ThemeValidationOptions {
  themePath?: string
  files?: string
  filename?: string
  filetype?: string
  context?: string
  /** Inline codeblock content (`--code`). */
  code?: string
  /** Path to a file whose content is validated as a codeblock (`--file`). */
  filePath?: string
}

export interface ThemeValidationOutcome {
  responses: ValidationResponse[]
  /** True when no response FAILED. INFORM counts as a pass for theme. */
  success: boolean
}

interface FileResult {
  result: ValidationResult
  resultDetail: string
}

function toOutcome(responses: FileResult[]): ThemeValidationOutcome {
  return {responses, success: !hasFailedValidation(responses)}
}

function errorOutcome(detail: string): ThemeValidationOutcome {
  return toOutcome([{result: ValidationResult.FAILED, resultDetail: detail}])
}

// ─── Full-app mode ──────────────────────────────────────────────────────────

async function validateFullApp(themePath: string, relativeFilePaths: string[]): Promise<FileResult[]> {
  const candidateConfigPath = joinPath(themePath, '.theme-check.yml')
  const configPath = (await fileExists(candidateConfigPath)) ? candidateConfigPath : undefined

  const checkResult = await themeCheckRun(themePath, configPath, (message: string) => outputDebug(message))

  // Bucket all offenses by uri (keeps line ordering from theme-check) and
  // separately track whether each file has any ERROR-severity offense. A file
  // with only WARNING/INFO offenses is valid but still surfaces the advice with
  // an INFORM status.
  const byUri: {[uri: string]: string[]} = {}
  const hasErrorByUri: {[uri: string]: boolean} = {}
  for (const offense of checkResult.offenses) {
    ;(byUri[offense.uri] ??= []).push(formatOffense(offense))
    if (isFailingOffense(offense)) {
      hasErrorByUri[offense.uri] = true
    }
  }

  return relativeFilePaths.map((relativePath) => {
    const matchedUri = Object.keys(byUri).find((uri) => normalizePath(uri).endsWith(normalizePath(relativePath)))
    if (matchedUri) {
      const findings = byUri[matchedUri]!.join('\n')
      if (hasErrorByUri[matchedUri]) {
        return {
          result: ValidationResult.FAILED,
          resultDetail: `${relativePath}:\n${findings}`,
        }
      }
      return {
        result: ValidationResult.INFORM,
        resultDetail: `${relativePath} passed all checks (with non-error findings):\n${findings}`,
      }
    }
    return {
      result: ValidationResult.SUCCESS,
      resultDetail: `${relativePath} passed all checks.`,
    }
  })
}

// ─── Stateless (codeblock) mode ───────────────────────────────────────────────

interface Theme {
  [uri: string]: string
}

class MockFileSystem implements AbstractFileSystem {
  constructor(private readonly theme: Theme) {}

  async readFile(uri: string): Promise<string> {
    const file = this.theme[uri]
    if (!file) throw new Error(`File not found: ${uri}`)
    return file
  }

  async readDirectory(): Promise<FileTuple[]> {
    return []
  }

  async stat(uri: string): Promise<FileStat> {
    const file = this.theme[uri]
    if (!file) throw new Error(`File not found: ${uri}`)
    return {type: NodeFileType.File, size: file.length}
  }
}

// Checks that are always false positives in stateless/codeblock mode. We only
// have the one file being validated, so any rule that needs co-resident files in
// the mock filesystem (locale files, referenced snippets/sections/blocks, asset
// files) cannot be satisfied here. These rules are correct in full-app mode
// where the theme is on disk.
const STATELESS_FALSE_POSITIVE_CHECKS = new Set<string>([
  // Locale checks — need locale files co-resident
  'TranslationKeyExists',
  'ValidSchemaTranslations',
  // Cross-file existence checks — need the referenced file co-resident
  'MissingTemplate',
  'MissingAsset',
  'ValidStaticBlockType',
  // Theme app extension app-block asset checks — JS/CSS files are referenced
  // from the schema, but a stateless validation request often contains only the
  // Liquid block. Full-theme validation still catches missing/oversized assets
  // when the extension is on disk.
  'AssetSizeAppBlockCSS',
  'AssetSizeAppBlockJavaScript',
])

async function validateCodeblock(
  fileName: string,
  fileType: FileType,
  context: ThemeContext,
  content: string,
): Promise<FileResult> {
  const uri = `file:///${fileType}/${fileName}`
  const theme: Theme = {[uri]: content}

  const config: Config = {
    checks: recommended.filter((definition) => !STATELESS_FALSE_POSITIVE_CHECKS.has(definition.meta.code)),
    settings: {},
    rootUri: 'file:///',
    context,
  }

  const docsManager = new ThemeLiquidDocsManager()

  const sourceCode = Object.entries(theme)
    .filter(([entryUri]) => entryUri.endsWith('.liquid') || entryUri.endsWith('.json'))
    .map(([entryUri, entryContent]) => toSourceCode(entryUri, entryContent))

  const offenses = await check(sourceCode, config, {
    fs: new MockFileSystem(theme),
    themeDocset: docsManager,
    jsonValidationSet: docsManager,
    getBlockSchema: async (blockName: string) => {
      const blockUri = `file:///blocks/${blockName}.liquid`
      const source = sourceCode.find((entry) => entry.uri === blockUri)
      if (!source) return undefined
      // `toSchema` returns a broader schema union than the library types express
      // per file type; the cast narrows it to the block schema shape.
      return toSchema(context, blockUri, source, async () => true) as Promise<ThemeBlockSchema | undefined>
    },
    getSectionSchema: async (sectionName: string) => {
      const sectionUri = `file:///sections/${sectionName}.liquid`
      const source = sourceCode.find((entry) => entry.uri === sectionUri)
      if (!source) return undefined
      // See the block-schema cast above.
      return toSchema(context, sectionUri, source, async () => true) as Promise<SectionSchema | undefined>
    },
    async getDocDefinition(relativePath: string) {
      const source = sourceCode.find((entry) => normalizePath(entry.uri).endsWith(normalizePath(relativePath)))
      if (!source || source.type !== SourceCodeType.LiquidHtml) return undefined
      // `ast` is narrowed to a LiquidHtmlNode by the SourceCodeType guard above;
      // its static type still unions in `Error`, so the assertion is required.
      return extractDocDefinition(source.uri, source.ast as LiquidHtmlNode)
    },
  })

  const errorOffenses = offenses.filter(isFailingOffense)
  if (errorOffenses.length === 0) {
    if (offenses.length === 0) {
      return {
        result: ValidationResult.SUCCESS,
        resultDetail: `${fileName} passed all checks.`,
      }
    }
    // Only warnings/info — valid, but surface the advice so authors see it.
    return {
      result: ValidationResult.INFORM,
      resultDetail: `${fileName} passed all checks (with ${offenses.length} non-error finding(s)):\n${offenses
        .map((offense) => formatOffense(offense))
        .join('\n')}`,
    }
  }

  return {
    result: ValidationResult.FAILED,
    resultDetail: offenses.map((offense) => formatOffense(offense)).join('\n'),
  }
}

// ─── Offense formatting ───────────────────────────────────────────────────────

// Severity labels match theme-check's three-tier classification: ERROR (real
// parse/schema bug), WARNING (likely bug or strong best-practice violation),
// INFO (style nit or recommendation).
function severityLabel(severity: Severity | undefined): string {
  switch (severity) {
    case Severity.WARNING:
      return 'WARNING'
    case Severity.INFO:
      return 'INFO'
    case Severity.ERROR:
    case undefined:
    default:
      return 'ERROR'
  }
}

// Format a theme-check offense with line/column so the author can see which line
// to fix, not just the generic message.
//
// Note: theme-check's Position type doc-comments claim 1-indexed `line` and
// 0-indexed `character`, but the runtime uses `line-column` with origin: 0 —
// both are 0-indexed in practice. We convert to 1-indexed here for humans.
function formatOffense(offense: Pick<Offense, 'message' | 'start' | 'severity' | 'suggest'>): string {
  const line = offense.start.line + 1
  const col = offense.start.character + 1
  const label = severityLabel(offense.severity)
  const base = `${label} [line ${line}, col ${col}]: ${offense.message}`
  if (offense.suggest && offense.suggest.length > 0) {
    return `${base}; SUGGESTED FIXES: ${offense.suggest.map((suggestion) => suggestion.message).join(' OR ')}.`
  }
  return base
}

// Theme Check classifies findings as ERROR | WARNING | INFO. ERROR is the only
// level treated as a failure — a real Liquid/JSON parse error, an unknown schema
// property, a missing required field. WARNING and INFO are advice and shouldn't
// fail validity, but we still emit them so authors see them.
function isFailingOffense(offense: {severity?: Severity}): boolean {
  // Defensive default: if severity is missing, treat as ERROR so a future check
  // that omits it errs on the side of being noticed rather than silently dropped.
  return (offense.severity ?? Severity.ERROR) === Severity.ERROR
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Pure validation core: resolves the mode from the options, reads any `--file`
 * content, runs theme-check, and returns the response set plus the pass/fail
 * verdict. All input reading (the on-disk theme in full-app mode, the `--file`
 * codeblock content in stateless mode) happens here so callers get a structured
 * FAILED response for bad input instead of a thrown error.
 */
export async function computeThemeValidation(options: ThemeValidationOptions): Promise<ThemeValidationOutcome> {
  if (options.themePath) {
    const files = (options.files ?? '')
      .split(',')
      .map((file) => file.trim())
      .filter(Boolean)

    if (files.length === 0) {
      return errorOutcome('--files must list at least one relative file path')
    }

    // Full-app mode never reads `--file`; it validates the on-disk theme.
    const fileResults = await validateFullApp(options.themePath, files)
    return toOutcome(fileResults)
  }

  if (!options.filename) {
    return errorOutcome('Provide either --theme-path (full app mode) or --filename (stateless mode)')
  }

  let content: string | undefined
  if (options.filePath) {
    try {
      content = await readFile(options.filePath)
      // Any read failure (missing/unreadable file) is intentionally converted to
      // a structured FAILED response so agents get the JSON contract, not a crash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return errorOutcome(
        `Could not read --file "${options.filePath}": ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } else {
    content = options.code
  }

  if (!content) {
    return errorOutcome('Provide --code or --file with the codeblock content')
  }

  const rawFileType = options.filetype ?? DEFAULT_FILE_TYPE
  if (!VALID_FILE_TYPES.includes(rawFileType as FileType)) {
    return errorOutcome(`Invalid --filetype "${rawFileType}". Valid values: ${VALID_FILE_TYPES.join(', ')}`)
  }

  const rawContext = options.context ?? DEFAULT_CONTEXT
  if (!VALID_CONTEXTS.includes(rawContext as ThemeContext)) {
    return errorOutcome(`Invalid --context "${rawContext}". Valid values: ${VALID_CONTEXTS.join(', ')}`)
  }

  const fileResult = await validateCodeblock(
    options.filename,
    rawFileType as FileType,
    rawContext as ThemeContext,
    content,
  )
  return toOutcome([fileResult])
}

function overallResult(responses: ValidationResponse[]): ValidationResult {
  if (responses.some((response) => response.result === ValidationResult.FAILED)) {
    return ValidationResult.FAILED
  }
  if (responses.some((response) => response.result === ValidationResult.INFORM)) {
    return ValidationResult.INFORM
  }
  return ValidationResult.SUCCESS
}

// Human-readable body for the cli-kit render call: status + detail per file, with
// no `##`/`**` markdown. The raw markdown summary is intentionally not surfaced
// here — the primary human surface is this tokenized, clean listing.
function formatHumanBody(responses: ValidationResponse[]): string {
  return responses.map((response) => `${response.result.toUpperCase()}: ${response.resultDetail}`).join('\n\n')
}

/**
 * Full command entry point: validate, record telemetry, render, and set the exit
 * code. `--json` prints `{success, responses}` (the eval-harness contract) and
 * throws AbortSilentError on failure for a non-zero exit; human output renders a
 * tokenized status/detail body via cli-kit UI. Exit codes: 0 on SUCCESS or
 * INFORM, 1 on FAILED/error (INFORM counts as a pass for theme).
 */
export async function runThemeValidation(options: ThemeValidationOptions & {json: boolean}): Promise<void> {
  // Mirror the source's top-level catch: any unexpected engine error (e.g.
  // theme-check throwing on a nonexistent theme path or malformed
  // `.theme-check.yml`) becomes a FAILED response so the JSON contract and exit
  // code stay intact for eval harnesses.
  let outcome: ThemeValidationOutcome
  try {
    outcome = await computeThemeValidation(options)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outcome = errorOutcome(error instanceof Error ? error.message : String(error))
  }

  const {responses, success} = outcome
  const overall = overallResult(responses)

  await recordValidateMetadata({subcommand: 'theme', result: overall, json: options.json})

  if (options.json) {
    outputResult(JSON.stringify({success, responses}, null, 2))
    if (!success) throw new AbortSilentError()
    return
  }

  const body = formatHumanBody(responses)

  if (!success) {
    renderError({headline: 'Theme validation failed.', body})
    throw new AbortSilentError()
  }

  if (overall === ValidationResult.INFORM) {
    renderWarning({headline: 'Theme validation passed with warnings.', body})
    return
  }

  renderSuccess({headline: 'Theme validation passed.', body})
}
