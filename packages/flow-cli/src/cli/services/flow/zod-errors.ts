import type {zod} from '@shopify/cli-kit/node/schema'

/**
 * Format a ZodError into a single human-readable string suitable for an
 * AbortError detail line. Each issue is rendered as `<path>: <message>`,
 * joined with `; `. Paths are dotted (`workflows.dir`) or `(root)` for
 * top-level errors.
 */
export function formatZodErrors(error: zod.ZodError): string {
  return error.errors
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}
