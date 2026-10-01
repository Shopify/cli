import {FatalErrorType} from '../../public/node/error.js'
import {jsonErrorOutputSchema} from '../../public/node/error/schema.js'
import {errorToJson} from '../../public/node/error/serialization.js'
import {outputResult} from '../../public/node/output.js'

/**
 * Writes the public JSON representation of a fatal error to stdout.
 *
 * The allow-list mirrors the meaningful content of the regular fatal-error renderer.
 * Arbitrary error properties remain private and are never copied to stdout.
 *
 * @param error - Fatal error to serialize.
 */
export function renderFatalErrorAsJson(error: unknown): void {
  let serializedDocument: string
  try {
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === FatalErrorType.AbortSilent)
      return
    const document = {error: errorToJson(error)}
    serializedDocument = JSON.stringify(jsonErrorOutputSchema.validate(document))
    // Serialization must not replace the JSON contract with a text banner.
    // eslint-disable-next-line @shopify/cli/no-catch-all
  } catch {
    serializedDocument = JSON.stringify({error: {type: 'bug', message: 'Failed to serialize the error as JSON.'}})
  }

  // Keep write failures separate: retrying after a partial write could corrupt stdout.
  outputResult(serializedDocument)
}
