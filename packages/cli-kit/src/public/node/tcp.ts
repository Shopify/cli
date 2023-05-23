import {sleep} from './system.js'
import {AbortError} from './error.js'
import {outputDebug, outputContent, outputToken} from '../../public/node/output.js'
import * as port from 'get-port-please'

/**
 * Returns an available port in the current environment.
 *
 * @returns A promise that resolves with an availabe port.
 * @example
 */
export async function getAvailableTCPPort(): Promise<number> {
  outputDebug(outputContent`Getting a random port...`)
  const randomPort = await retryOnError(() => port.getRandomPort('localhost'))
  outputDebug(outputContent`Random port obtained: ${outputToken.raw(`${randomPort}`)}`)
  return randomPort
}

/**
 * Checks if a port is available.
 *
 * @param portNumber - The port number to check.
 */
export async function checkPortAvailability(portNumber: number): Promise<boolean> {
  return (await port.checkPort(portNumber)) === portNumber
}

/**
 * Given a function, it runs it and retries in case of failiure up to the provided number of times.
 *
 * @param execute - The function to execute.
 * @param maxTries - The maximum retries.
 * @param waitTimeInSeconds - The time to wait between retries.
 */
async function retryOnError<T>(execute: () => T, maxTries = 5, waitTimeInSeconds = 1) {
  let retryCount = 1
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await execute()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (retryCount++ < maxTries) {
        outputDebug(outputContent`Unknown problem getting a random port: ${error.message}`)
        // eslint-disable-next-line no-await-in-loop
        await sleep(waitTimeInSeconds)
      } else {
        throw new AbortError(error.message)
      }
    }
  }
}
