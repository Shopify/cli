import {commandEventOutputMode} from '../command-events.js'
import {outputInfo} from '../output.js'
import {exec} from '../system.js'
import {Writable} from 'node:stream'

/**
 * Keeps package-manager output off the result channel in JSON mode.
 *
 * @returns Streams for package-manager diagnostics, or the original terminal streams.
 */
export function upgradeOutputStreams(): {stdout: Writable; stderr: Writable} {
  if (commandEventOutputMode() !== 'json') return {stdout: process.stdout, stderr: process.stderr}

  const diagnostics = new Writable({
    write(chunk, _encoding, callback) {
      outputInfo(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk))
      callback()
    },
  })
  return {stdout: diagnostics, stderr: diagnostics}
}

/**
 * Runs a global upgrade with terminal input and format-appropriate diagnostics.
 *
 * @param command - The package-manager executable.
 * @param args - The install arguments.
 */
export async function execUpgradeCommand(command: string, args: string[]): Promise<void> {
  const streams = upgradeOutputStreams()
  await exec(command, args, streams.stdout === process.stdout ? {stdio: 'inherit'} : {stdin: 'inherit', ...streams})
}
