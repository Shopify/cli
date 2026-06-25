import {isMutation} from '@shopify/cli-kit/node/api/bulk-operations'
import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Creates formatted info list items for bulk operations.
 * Includes store and optionally API version information.
 *
 * @param options - The operation context information.
 * @returns Array of formatted strings for display.
 */
export function formatOperationInfo(options: {storeFqdn: string; version?: string}): string[] {
  const {storeFqdn, version} = options

  const items = [`Store: ${storeFqdn}`]

  if (version) {
    items.push(`API version: ${version}`)
  }

  return items
}

/**
 * Validates that bulk mutations are only run when the user has explicitly opted in.
 * Mutations modify store data, so they're disabled by default.
 *
 * @param graphqlOperation - The GraphQL operation to validate.
 * @param allowMutations - Whether the user has opted in to running mutations.
 * @throws AbortError if attempting to run a mutation without opting in.
 */
export function validateMutationsAllowed(graphqlOperation: string, allowMutations = false): void {
  if (isMutation(graphqlOperation) && !allowMutations) {
    throw new AbortError(
      'Mutations are disabled by default for shopify store bulk execute.',
      'Re-run with --allow-mutations if you intend to modify store data.',
    )
  }
}
