import * as port from 'get-port-please'

/**
 * Returns an available port in the current environment.
 * @returns {Promise<number>} A promise that resolves with an availabe port.
 */
export async function getRandomPort(): Promise<number> {
  return port.getRandomPort()
}
