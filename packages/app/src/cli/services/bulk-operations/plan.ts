import {BulkMutationPlanOperation, isMutation} from '@shopify/cli-kit/node/api/bulk-operations'
import {readFile, fileExists} from '@shopify/cli-kit/node/fs'
import {dirname, isAbsolutePath, joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

/**
 * A single entry in a `--plan-file`. Each operation provides its mutation document (inline or via a
 * file) and its JSONL variables (inline or via a file). Files are resolved relative to the plan
 * file's own directory.
 */
interface PlanFileEntry {
  mutation?: string
  mutationFile?: string
  variables?: string[]
  variableFile?: string
}

const NAMED_MUTATION_RE = /(?:^|\W)mutation\s+[A-Za-z_][A-Za-z0-9_]*/

/**
 * Reads and validates a `--plan-file`, returning the ordered operations for a
 * `bulkOperationRunMutations` plan. Order is significant: `$ref` values resolve against operations
 * declared earlier in the list.
 *
 * @param planFile - Absolute path to the plan JSON file.
 * @returns The ordered operations, each with its resolved mutation document and JSONL variables.
 */
export async function resolveBulkPlan(planFile: string): Promise<BulkMutationPlanOperation[]> {
  if (!(await fileExists(planFile))) {
    throw new AbortError(
      outputContent`Plan file not found at ${outputToken.path(planFile)}. Please check the path and try again.`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(planFile, {encoding: 'utf8'}))
  } catch (error) {
    throw new AbortError(
      outputContent`Plan file ${outputToken.path(planFile)} is not valid JSON.`,
      (error as Error).message,
    )
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new AbortError(
      outputContent`Plan file ${outputToken.path(planFile)} must contain a non-empty JSON array of operations.`,
    )
  }

  const baseDir = dirname(planFile)
  return Promise.all(parsed.map((entry, index) => resolveEntry(entry as PlanFileEntry, index, baseDir)))
}

async function resolveEntry(entry: PlanFileEntry, index: number, baseDir: string): Promise<BulkMutationPlanOperation> {
  const position = `operation ${index + 1}`
  const mutation = await resolveMutation(entry, position, baseDir)
  const variablesJsonl = await resolveVariables(entry, position, baseDir)
  return {mutation, variablesJsonl}
}

async function resolveMutation(entry: PlanFileEntry, position: string, baseDir: string): Promise<string> {
  if (entry.mutation && entry.mutationFile) {
    throw new AbortError(invalidPlanMessage(position, 'set only one of "mutation" or "mutationFile".'))
  }

  let mutation: string
  if (entry.mutationFile) {
    mutation = await readPlanFile(entry.mutationFile, baseDir, position, 'mutationFile')
  } else if (entry.mutation) {
    mutation = entry.mutation
  } else {
    throw new AbortError(invalidPlanMessage(position, 'is missing a mutation. Provide "mutation" or "mutationFile".'))
  }

  if (!isMutation(mutation)) {
    throw new AbortError(invalidPlanMessage(position, 'must be a GraphQL mutation, not a query.'))
  }
  if (!NAMED_MUTATION_RE.test(mutation)) {
    throw new AbortError(
      invalidPlanMessage(
        position,
        "must be a named mutation (for example `mutation SetProducts(...)`). Anonymous operations aren't allowed in a plan.",
      ),
    )
  }
  return mutation
}

async function resolveVariables(entry: PlanFileEntry, position: string, baseDir: string): Promise<string> {
  if (entry.variables && entry.variableFile) {
    throw new AbortError(invalidPlanMessage(position, 'set only one of "variables" or "variableFile".'))
  }

  let variablesJsonl: string
  if (entry.variableFile) {
    variablesJsonl = await readPlanFile(entry.variableFile, baseDir, position, 'variableFile')
  } else if (entry.variables) {
    variablesJsonl = entry.variables.join('\n')
  } else {
    throw new AbortError(invalidPlanMessage(position, 'is missing variables. Provide "variableFile" or "variables".'))
  }

  if (variablesJsonl.trim().length === 0) {
    throw new AbortError(
      invalidPlanMessage(position, 'has empty variables. Each operation needs at least one JSONL row.'),
    )
  }
  return variablesJsonl
}

async function readPlanFile(
  relativeOrAbsolute: string,
  baseDir: string,
  position: string,
  field: string,
): Promise<string> {
  const path = isAbsolutePath(relativeOrAbsolute) ? relativeOrAbsolute : joinPath(baseDir, relativeOrAbsolute)
  if (!(await fileExists(path))) {
    throw new AbortError(
      outputContent`${position}: ${outputToken.yellow(field)} not found at ${outputToken.path(path)}.`,
    )
  }
  return readFile(path, {encoding: 'utf8'})
}

function invalidPlanMessage(position: string, detail: string): ReturnType<typeof outputContent> {
  return outputContent`Invalid plan: ${position} ${detail}`
}
