import {validateSingleOperation} from './helpers.js'
import {AbortError, BugError} from '../../error.js'
import {fileExists, readFile} from '../../fs.js'
import {outputContent, outputToken} from '../../output.js'

/**
 * Inputs for resolving a bulk operation's GraphQL query.
 */
interface ResolveBulkOperationQueryInput {
  /** Inline GraphQL operation string. */
  query?: string
  /** Path to a file containing the GraphQL operation. */
  queryFile?: string
}

/**
 * Resolves the GraphQL operation for a bulk command from either an inline `--query` value or a
 * `--query-file` path, validating that it's non-empty and contains exactly one operation.
 *
 * Centralizes the read-and-validate logic shared by the app and store bulk execute commands.
 *
 * @param input - The inline query and/or the query file path (exactly one is expected).
 * @returns The validated GraphQL operation string.
 * @throws AbortError if the value/file is empty or missing, or the operation is invalid.
 * @throws BugError if neither input was provided (oclif's exactlyOne constraint should prevent this).
 */
export async function resolveBulkOperationQuery(input: ResolveBulkOperationQueryInput): Promise<string> {
  let query: string

  if (input.query !== undefined) {
    if (!input.query.trim()) {
      throw new AbortError('The --query flag value is empty. Please provide a valid GraphQL query or mutation.')
    }
    query = input.query
  } else if (input.queryFile) {
    if (!(await fileExists(input.queryFile))) {
      throw new AbortError(
        outputContent`Query file not found at ${outputToken.path(input.queryFile)}. Please check the path and try again.`,
      )
    }
    const fileContents = await readFile(input.queryFile, {encoding: 'utf8'})
    if (!fileContents.trim()) {
      throw new AbortError(
        outputContent`Query file at ${outputToken.path(
          input.queryFile,
        )} is empty. Please provide a valid GraphQL query or mutation.`,
      )
    }
    query = fileContents
  } else {
    throw new BugError(
      'Query should have been provided via --query or --query-file flags due to exactlyOne constraint. This indicates the oclif flag validation failed.',
    )
  }

  validateSingleOperation(query)

  return query
}
