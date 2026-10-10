import {commandEventOutputMode} from '../command-events.js'
import {outputInfo} from '../output.js'
import {exec} from '../system.js'
import {Writable} from 'node:stream'
import {StringDecoder} from 'node:string_decoder'

/**
 * Keeps package-manager output off the result channel in JSON mode.
 *
 * @returns Streams for package-manager diagnostics, or the original terminal streams.
 */
export function upgradeOutputStreams(): {stdout: Writable; stderr: Writable} {
  if (commandEventOutputMode() !== 'json') return {stdout: process.stdout, stderr: process.stderr}

  return {stdout: diagnosticStream(), stderr: diagnosticStream()}
}

function diagnosticStream(): Writable {
  const decoder = new StringDecoder('utf8')
  return new Writable({
    write(chunk, _encoding, callback) {
      const message = decoder.write(chunk)
      if (message) outputInfo(message)
      callback()
    },
    final(callback) {
      const message = decoder.end()
      if (message) outputInfo(message)
      callback()
    },
  })
}

/**
 * Runs a global upgrade with terminal input and format-appropriate diagnostics.
 *
 * @param command - The package-manager executable.
 * @param args - The install arguments.
 */
export async function execUpgradeCommand(command: string, args: string[]): Promise<void> {
  const streams = upgradeOutputStreams()
  try {
    await exec(command, args, streams.stdout === process.stdout ? {stdio: 'inherit'} : {stdin: 'inherit', ...streams})
  } finally {
    if (streams.stdout !== process.stdout) streams.stdout.end()
    if (streams.stderr !== process.stderr) streams.stderr.end()
  }
}
