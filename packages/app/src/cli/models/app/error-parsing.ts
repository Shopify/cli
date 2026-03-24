import type {OutputMessage} from '@shopify/cli-kit/node/output'

interface UnionErrorIssue {
  path?: (string | number)[]
  message: string
  code?: string
}

interface UnionError {
  issues?: UnionErrorIssue[]
  name: string
}

interface ExtendedZodIssue {
  path?: (string | number)[]
  message?: string
  code?: string
  unionErrors?: UnionError[]
}

export interface AppValidationIssue {
  filePath: string
  path: (string | number)[]
  pathString: string
  message: string
  code?: string
}

export interface AppValidationFileIssues {
  filePath: string
  message: OutputMessage
  issues: AppValidationIssue[]
}

export function toRootValidationIssue(filePath: string, message: string): AppValidationIssue {
  return {
    filePath,
    path: [],
    pathString: 'root',
    message,
  }
}

/**
 * Finds the best matching variant from a union error by scoring each variant
 * based on how close it is to the user's likely intent.
 */
function findBestMatchingVariant(unionErrors: UnionError[]): UnionError | null {
  if (!unionErrors?.length) return null

  let bestVariant: UnionError | null = null
  let bestScore = -1

  for (const variant of unionErrors) {
    if (!variant.issues?.length) continue

    let missingFieldCount = 0
    let typeErrorCount = 0
    let otherErrorCount = 0

    for (const issue of variant.issues) {
      if (issue.message?.includes('Required') || issue.message?.includes('required')) {
        missingFieldCount++
      } else if (issue.message?.includes('Expected') && issue.message?.includes('received')) {
        typeErrorCount++
      } else {
        otherErrorCount++
      }
    }

    // Score variants: prefer those with missing fields over type errors
    let score
    if (missingFieldCount > 0) {
      score = 1000 - missingFieldCount * 10 - typeErrorCount - otherErrorCount
    } else if (typeErrorCount > 0) {
      score = 100 - typeErrorCount * 5 - otherErrorCount
    } else {
      score = 50 - otherErrorCount
    }

    if (score > bestScore) {
      bestScore = score
      bestVariant = variant
    }
  }

  return bestVariant
}

function getIssuePath(path?: (string | number)[]) {
  return path ?? []
}

function getIssuePathString(path?: (string | number)[]) {
  const resolvedPath = getIssuePath(path)
  return resolvedPath.length > 0 ? resolvedPath.map(String).join('.') : 'root'
}

/**
 * Formats an issue into a human-readable error line
 */
function formatErrorLine(issue: {path?: (string | number)[]; message?: string}, indent = '') {
  const pathString = getIssuePathString(issue.path)
  const message = issue.message ?? 'Unknown error'
  return `${indent}• [${pathString}]: ${message}\n`
}

function toStructuredIssue(filePath: string, issue: Pick<ExtendedZodIssue, 'path' | 'message' | 'code'>) {
  return {
    filePath,
    path: getIssuePath(issue.path),
    pathString: getIssuePathString(issue.path),
    message: issue.message ?? 'Unknown error',
    code: issue.code,
  }
}

export function parseStructuredErrors(issues: ExtendedZodIssue[], filePath: string): AppValidationIssue[] {
  return issues.flatMap((issue) => {
    if (issue.code === 'invalid_union' && issue.unionErrors) {
      // Intentionally mirror the current human-readable union selection heuristic
      // so structured/internal issues stay aligned with existing CLI behavior.
      // If we change this heuristic later, text and structured output should move together.
      const bestVariant = findBestMatchingVariant(issue.unionErrors)

      if (bestVariant?.issues?.length) {
        return bestVariant.issues.map((nestedIssue) => toStructuredIssue(filePath, nestedIssue))
      }

      const fallbackIssues = issue.unionErrors.flatMap((unionError) => unionError.issues ?? [])
      if (fallbackIssues.length > 0) {
        // Preserve any concrete nested issues we were able to recover before
        // falling back to a synthetic root issue. This structured path is still
        // internal, and retaining leaf issues is more actionable than erasing
        // them behind a generic union failure.
        return fallbackIssues.map((nestedIssue) => toStructuredIssue(filePath, nestedIssue))
      }

      return [
        toStructuredIssue(filePath, {
          path: issue.path,
          message: "Configuration doesn't match any expected format",
          code: issue.code,
        }),
      ]
    }

    return [toStructuredIssue(filePath, issue)]
  })
}

export function parseHumanReadableError(issues: ExtendedZodIssue[]) {
  let humanReadableError = ''

  issues.forEach((issue) => {
    // Handle union errors with smart variant detection
    if (issue.code === 'invalid_union' && issue.unionErrors) {
      // Find the variant that's most likely the intended one
      const bestVariant = findBestMatchingVariant(issue.unionErrors)

      if (bestVariant?.issues?.length) {
        // Show errors only for the best matching variant
        bestVariant.issues.forEach((nestedIssue) => {
          humanReadableError += formatErrorLine(nestedIssue)
        })
      } else {
        // Fallback: show all variants if we can't determine the best one
        humanReadableError += `• Configuration doesn't match any expected format:\n`
        issue.unionErrors.forEach((unionError, index: number) => {
          humanReadableError += `  Option ${index + 1}:\n`
          unionError.issues?.forEach((nestedIssue) => {
            humanReadableError += formatErrorLine(nestedIssue, '    ')
          })
        })
      }
    } else {
      // Handle regular issues
      humanReadableError += formatErrorLine(issue)
    }
  })

  return humanReadableError
}
