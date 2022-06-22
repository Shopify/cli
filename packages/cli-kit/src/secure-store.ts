import constants from './constants'
import {content as outputContent, debug} from './output'

/**
 * Fetches secured content from the system's keychain.
 * @param identifier {string} Identifier to identify the content.
 * @returns A promise that resolves with the content or null if it doesn't exist.
 */
export async function fetch(identifier: string): Promise<string | null> {
  debug(outputContent`Reading ${identifier} from the secure store...`)
  try {
    const keytar = await import('keytar')
    const content = await keytar.getPassword(constants.keychain.service, identifier)
    return content
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Unable to read from the secure store'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    debug(message)
    return null
  }
}

/**
 * Securely stores the content under the given key.
 * @param identifier {string} Identifier to identify the content.
 * @param content {string} The content to be stored.
 * @returns A promise that resolves when the storing completes.
 */
export async function store(identifier: string, content: string): Promise<void> {
  debug(outputContent`Updating ${identifier} in the secure store with new content...`)
  try {
    const keytar = await import('keytar')
    await keytar.default.setPassword(constants.keychain.service, identifier, content)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Unable to update the secure store'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    debug(message)
  }
}

/**
 * Removes the content with the given identifier.
 * @param identifier {string} Identifier to identify the content.
 * @returns A promise that resolves with true if the content was deleted.
 */
export async function remove(identifier: string): Promise<boolean> {
  debug(outputContent`Removing ${identifier} from the secure store...`)
  try {
    const keytar = await import('keytar')
    const result = await keytar.default.deletePassword(constants.keychain.service, identifier)
    return result
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Unable to remove from the secure store'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    debug(message)
    return false
  }
}
