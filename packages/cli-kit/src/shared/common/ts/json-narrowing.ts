import {BugError} from '../../node/error.js'

/**
 * Asserts that the unknownBlob is a string map. Used to validate JSON objects received over the wire.
 *
 * @param unknownBlob - The unknown object to validate.
 * @throws BugError - Thrown if the unknownBlob is not a string map.
 */
export function assertStringMap(unknownBlob: unknown): asserts unknownBlob is {[key: string]: string} {
  if (typeof unknownBlob !== 'object' || unknownBlob === null) {
    throw new BugError('Expected an object.')
  }
}
