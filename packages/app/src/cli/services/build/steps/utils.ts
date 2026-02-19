/**
 * Resolves a dot-separated path from a config object.
 *
 * When `arrayIndex` is provided, any array encountered mid-path is indexed
 * into using that value rather than plucking the key across all elements.
 * When omitted, the original plucking behaviour is preserved (used by
 * copy_files and other callers that need all values from an array field).
 */
export function getNestedValue(obj: {[key: string]: unknown}, path: string, arrayIndex?: number): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }

    if (Array.isArray(current)) {
      if (arrayIndex !== undefined) {
        const item = current[arrayIndex]
        if (item == null || typeof item !== 'object') return undefined
        current = (item as {[key: string]: unknown})[part]
      } else {
        const plucked = current
          .map((item) => {
            if (typeof item === 'object' && item !== null && part in (item as object)) {
              return (item as {[key: string]: unknown})[part]
            }
            return undefined
          })
          .filter((item): item is NonNullable<unknown> => item !== undefined)
        current = plucked.length > 0 ? plucked : undefined
      }
      continue
    }

    if (typeof current === 'object' && part in current) {
      current = (current as {[key: string]: unknown})[part]
    } else {
      return undefined
    }
  }

  return current
}
