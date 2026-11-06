import {isSecretFile, redactLines} from '../rules/secret-rules.js'
import {isSensitiveConfigFile, isSourceCodeFile} from '../scanners/discover.js'
import type {FindingsDocument, CodeExcerptLine, Issue} from '../types.js'

/** How many lines above and below a finding's line its excerpt holds, when it holds more than the line. */
const FINDING_CONTEXT_LINES = 2

/** A longer line is cut, so a minified file can't make a results file too large to read. */
export const MAX_EXCERPT_LINE_LENGTH = 500

/** Reads a file by its project-relative path. `undefined` when the file can't be read. */
export type SourceTextReader = (file: string) => string | undefined

/**
 * The redacted lines that findings cite, which `review` can match without reading a source file. Each one is
 * `undefined` when there is no line, or when the file can't be read, holds secrets in every value (an environment
 * file), or doesn't have the line.
 */
export interface CodeExcerpts {
  /**
   * A finding's line and up to two lines above and below it. Only its line for a committed secret, whose neighbours
   * are often secrets too, and in a file that isn't source code and may hold secrets on any line, such as configuration.
   */
  finding(file: string, line: number | undefined, checkId: string): CodeExcerptLine[] | undefined
  /** An evidence line alone. */
  evidence(file: string, line: number | undefined): CodeExcerptLine[] | undefined
}

/** Reads and redacts each file once, however many findings cite it. */
export function createCodeExcerpts(readSourceText: SourceTextReader): CodeExcerpts {
  const linesByFile = new Map<string, string[] | undefined>()
  const redactedLinesOf = (file: string): string[] | undefined => {
    if (!linesByFile.has(file)) {
      const text = isSecretFile(file) ? undefined : readSourceText(file)
      linesByFile.set(file, text === undefined ? undefined : excerptLines(text, isSourceCodeFile(file)))
    }
    return linesByFile.get(file)
  }
  const excerpt = (file: string, line: number | undefined, context: number): CodeExcerptLine[] | undefined => {
    if (line === undefined) return undefined
    const lines = redactedLinesOf(file)
    if (lines === undefined || line > lines.length) return undefined
    const firstLine = Math.max(1, line - context)
    return lines.slice(firstLine - 1, line + context).map((text, index) => ({line: firstLine + index, text}))
  }
  return {
    finding: (file, line, checkId) =>
      excerpt(file, line, checkId === 'COMMITTED_SECRET' || isSensitiveConfigFile(file) ? 0 : FINDING_CONTEXT_LINES),
    evidence: (file, line) => excerpt(file, line, 0),
  }
}

/** The redacted lines, without line endings or the empty line after a final newline, each cut to length. */
function excerptLines(text: string, sourceCode: boolean): string[] {
  const lines = redactLines(text, {sourceCode}).map((line) => {
    const content = line.replace(/\r$/, '')
    return content.length > MAX_EXCERPT_LINE_LENGTH ? `${content.slice(0, MAX_EXCERPT_LINE_LENGTH)}…` : content
  })
  return text.endsWith('\n') ? lines.slice(0, -1) : lines
}

/** The `code_excerpt` property when there is an excerpt, so the property is never written as `undefined`. */
export function codeExcerptField(excerpt: CodeExcerptLine[] | undefined): {code_excerpt?: CodeExcerptLine[]} {
  return excerpt === undefined ? {} : {code_excerpt: excerpt}
}

/** The issue with the excerpts of its line and of each evidence line. */
export function withCodeExcerpts(issue: Issue, excerpts: CodeExcerpts): Issue {
  return {
    ...issue,
    ...codeExcerptField(excerpts.finding(issue.location.file, issue.location.line, issue.id)),
    ...(issue.evidence === undefined
      ? {}
      : {
          evidence: issue.evidence.map((evidence) => ({
            ...evidence,
            ...codeExcerptField(excerpts.evidence(evidence.location.file, evidence.location.line)),
          })),
        }),
  }
}

/** The document as it would be if no cited file could be read. */
export function withoutCodeExcerpts<TDocument extends FindingsDocument>(document: TDocument): TDocument {
  return {
    ...document,
    checks: document.checks.map((check) => ({
      ...check,
      findings: check.findings.map(({code_excerpt: _findingExcerpt, ...finding}) => ({
        ...finding,
        evidence: finding.evidence.map(({code_excerpt: _evidenceExcerpt, ...evidence}) => evidence),
      })),
    })),
  }
}
