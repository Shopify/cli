interface UnionError {
  issues?: {path?: (string | number)[]; message: string}[]
  name: string
}

interface ExtendedZodIssue {
  path?: (string | number)[]
  message?: string
  code?: string
  unionErrors?: UnionError[]
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

/**
 * Formats an issue into a human-readable error line
 */
function formatErrorLine(issue: {path?: (string | number)[]; message?: string}, indent = '') {
  const path = issue.path && issue.path.length > 0 ? issue.path.map(String).join('.') : 'root'
  const message = issue.message ?? 'Unknown error'
  return `${indent}• [${path}]: ${message}\n`
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
