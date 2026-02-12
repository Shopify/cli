// import * as mimeTypes from 'mrmime'
import {lookup, mimes} from 'mrmime'

/**
 * Returns the MIME type for a filename.
 *
 * @param fileName - Filename.
 * @returns The mime type.
 */
export function lookupMimeType(fileName: string): string {
  return lookup(fileName) || 'application/octet-stream'
}

/**
 * Adds MIME type(s) to the dictionary.
 *
 * @param newTypes - Object of key-values where key is extension and value is mime type.
 */
export function setMimeTypes(newTypes: {[key: string]: string}): void {
  Object.entries(newTypes).forEach(([extension, mimeType]) => {
    mimes[extension] = mimeType
  })
}
