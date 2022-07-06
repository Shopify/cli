import {debug, content, token} from './output.js'
import {Abort} from './error.js'
import {sleep} from './system.js'
import * as port from 'get-port-please'

/**
 * Returns an available port in the current environment.
 * @returns {Promise<number>} A promise that resolves with an availabe port.
 */
export async function getRandomPort(): Promise<number> {
  debug(content`Getting a random port...`)
  const maxTries = 5
  const waitTimeInSeconds = 1
  let retryCount = 1
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const randomPort = await port.getRandomPort()
      debug(content`Random port obtained: ${token.raw(`${randomPort}`)}`)
      return randomPort
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (retryCount++ < maxTries) {
        debug(content`Unknown problem getting a random port: ${error.message}`)
        // eslint-disable-next-line no-await-in-loop
        await sleep(waitTimeInSeconds)
      } else {
        throw new Abort(error.message)
      }
    }
  }
}
