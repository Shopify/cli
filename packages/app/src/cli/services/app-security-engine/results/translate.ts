import {findingsDocumentSchemaV1} from './schema.js'
import {FINDINGS_SCHEMA_VERSION} from '../types.js'
import type {FindingsDocument} from '../types.js'
import type {zod} from '@shopify/cli-kit/node/schema'

export type TranslateFindingsDocumentResult = {ok: true; document: FindingsDocument} | {ok: false; errors: string[]}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const describeJsonType = (value: unknown): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/** Renders a Zod issue as `path: message` (e.g. `checks[0].snapshot.title: Required`), or the message alone at the root. */
function describeIssue(issue: zod.ZodIssue): string {
  const path = issue.path
    .map((segment, index) => {
      if (typeof segment === 'number') return `[${segment}]`
      return index === 0 ? String(segment) : `.${segment}`
    })
    .join('')
  return path.length === 0 ? issue.message : `${path}: ${issue.message}`
}

/**
 * Parse a stored findings document (deterministic-findings.json or agent-findings.json) into the internal type.
 *
 * Dispatches on `schema_version`. Only version 1 exists today; a future version adds its own parser and a
 * mapping to the internal type, while writers always write the latest version. Old formats are unprocessable.
 */
export function translateFindingsDocument(value: unknown): TranslateFindingsDocumentResult {
  if (!isJsonObject(value)) {
    return {ok: false, errors: [`expected a JSON object, received ${describeJsonType(value)}`]}
  }
  if (value.schema_version !== FINDINGS_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`unsupported schema_version: ${String(value.schema_version)} (expected ${FINDINGS_SCHEMA_VERSION})`],
    }
  }

  const parsed = findingsDocumentSchemaV1.safeParse(value)
  if (!parsed.success) return {ok: false, errors: parsed.error.issues.map(describeIssue)}
  return {ok: true, document: parsed.data}
}
