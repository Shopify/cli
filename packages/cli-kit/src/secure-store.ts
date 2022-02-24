import keytar from 'keytar'

import constants from './constants'

/**
 * Fetches secured content from the system's keychain.
 * @param identifier {string} Identifier to identify the content.
 * @returns A promise that resolves with the content or null if it doesn't exist.
 */
export async function fetch(identifier: string): Promise<string | null> {
  const content = await keytar.getPassword(
    constants.keychain.service,
    identifier,
  )
  return content
}

/**
 * Securely stores the content under the given key.
 * @param identifier {string} Identifier to identify the content.
 * @param content {string} The content to be stored.
 * @returns A promise that resolves when the storing completes.
 */
export async function store(
  identifier: string,
  content: string,
): Promise<void> {
  await keytar.setPassword(constants.keychain.service, identifier, content)
}

/**
 * Removes the content with the given identifier.
 * @param identifier {string} Identifier to identify the content.
 * @returns A promise that resolves with true if the content was deleted.
 */
export async function remove(identifier: string): Promise<boolean> {
  const result = await keytar.deletePassword(
    constants.keychain.service,
    identifier,
  )
  return result
}
