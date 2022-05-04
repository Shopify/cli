import {randomUUID} from 'crypto'

/**
 * Generates and returns a random UUID.
 * @returns {string} The random UUID generated.
 */
export const generateRandomUUID = (): string => {
  return randomUUID()
}
