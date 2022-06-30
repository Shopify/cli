import {debug, content, token} from './output.js'
import * as port from 'get-port-please'

/**
 * Returns an available port in the current environment.
 * @returns {Promise<number>} A promise that resolves with an availabe port.
 */
export async function getRandomPort(): Promise<number> {
  debug(content`Getting a random port...`)
  const randomPort = await port.getRandomPort()
  debug(content`Random port obtained: ${token.raw(`${randomPort}`)}`)
  return randomPort
}
