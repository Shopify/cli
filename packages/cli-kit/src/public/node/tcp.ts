import {sleep} from './system.js'
import {AbortError} from './error.js'
import {outputDebug, outputContent, outputToken} from '../../public/node/output.js'
import * as port from 'get-port-please'

interface GetTCPPortOptions {
  waitTimeInSeconds?: number
  maxTries?: number
}

const obtainedRandomPorts = new Set<number>()

/**
 * Returns an available port in the current environment.
 *
 * @param preferredPort - Number of the preferred port to be used if available.
 * @param options - Extra configuration for getting TCP ports.
 * @returns A promise that resolves with an availabe port.
 */
export async function getAvailableTCPPort(preferredPort?: number, options?: GetTCPPortOptions): Promise<number> {
  if (preferredPort && (await checkPortAvailability(preferredPort))) {
    outputDebug(outputContent`Port ${preferredPort.toString()} is free`)
    return preferredPort
  }
  outputDebug(outputContent`Getting a random port...`)
  let randomPort = await retryOnError(() => port.getRandomPort(host()), options?.maxTries, options?.waitTimeInSeconds)

  for (let i = 0; i < (options?.maxTries ?? 5); i++) {
    if (!obtainedRandomPorts.has(randomPort)) {
      break
    }
    // eslint-disable-next-line no-await-in-loop
    randomPort = await retryOnError(() => port.getRandomPort(host()), options?.maxTries, options?.waitTimeInSeconds)
  }

  outputDebug(outputContent`Random port obtained: ${outputToken.raw(`${randomPort}`)}`)
  obtainedRandomPorts.add(randomPort)
  return randomPort
}

/**
 * Checks if a port is available.
 *
 * @param portNumber - The port number to check.
 * @returns A promise that resolves with a boolean indicating if the port is available.
 */
export async function checkPortAvailability(portNumber: number): Promise<boolean> {
  return (await port.checkPort(portNumber, host())) === portNumber
}

function host(): string | undefined {
  // The get-port-please library does not work as expected when HOST env var is defined,
  // so explicitly set the host to localhost to avoid conflicts
  return 'localhost'
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
