import {keychainConstants} from './constants.js'
import {outputContent, outputDebug} from '../../public/node/output.js'
import {AbortError} from '../../public/node/error.js'

/**
 * Fetches secured content from the system's keychain.
 * @param identifier - Identifier to identify the content.
 * @returns A promise that resolves with the content or null if it doesn't exist.
 */
export async function secureStoreFetch(identifier: string): Promise<string | null> {
  outputDebug(outputContent`Reading ${identifier} from the secure store...`)
  try {
    const keytar = await import('keytar')
    const content = await keytar.getPassword(keychainConstants.service, identifier)
    return content
  } catch (error) {
    throw createAbort(error, 'Unable to read from the secure store')
  }
}

/**
 * Securely stores the content under the given key.
 * @param identifier - Identifier to identify the content.
 * @param content - The content to be stored.
 * @returns A promise that resolves when the storing completes.
 */
export async function secureStoreSave(identifier: string, content: string): Promise<void> {
  outputDebug(outputContent`Updating ${identifier} in the secure store with new content...`)
  try {
    const keytar = await import('keytar')
    await keytar.default.setPassword(keychainConstants.service, identifier, content)
  } catch (error) {
    throw createAbort(error, 'Unable to update the secure store')
  }
}

/**
 * Removes the content with the given identifier.
 * @param identifier - Identifier to identify the content.
 * @returns A promise that resolves with true if the content was deleted.
 */
export async function secureStoreRemove(identifier: string): Promise<boolean> {
  outputDebug(outputContent`Removing ${identifier} from the secure store...`)
  try {
    const keytar = await import('keytar')
    const result = await keytar.default.deletePassword(keychainConstants.service, identifier)
    return result
  } catch (error) {
    throw createAbort(error, 'Unable to remove from the secure store')
  }
}

function createAbort(error: unknown, message: string) {
  let newMessage = message
  let stack: string | undefined = ''
  if (error instanceof Error) {
    newMessage = message.concat(`: ${error.message}`)
    stack = error.stack
  }
  const abort = new AbortError(newMessage)
  abort.stack = stack
  return abort
}
