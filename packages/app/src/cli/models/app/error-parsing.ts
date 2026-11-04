interface ParsedIssue {
  path?: (string | number)[]
  message: string
  code?: string
}

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

export function parseStructuredErrors(issues: ExtendedZodIssue[]): ParsedIssue[] {
  return issues.flatMap((issue) => {
    if (issue.code !== 'invalid_union' || !issue.unionErrors) {
      return {path: issue.path, message: issue.message ?? 'Unknown error', code: issue.code}
    }

    const bestVariant = findBestMatchingVariant(issue.unionErrors)
    if (!bestVariant?.issues?.length) {
      return {
        path: issue.path,
        message: issue.message ?? "Configuration doesn't match any expected format",
        code: issue.code,
      }
    }

    return bestVariant.issues.map((nested) => ({path: nested.path, message: nested.message, code: issue.code}))
  })
}
