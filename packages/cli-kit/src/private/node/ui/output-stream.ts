import {commandEventOutputMode} from '../command-event-context.js'

/** Selects the stream used for interactive terminal UI. */
export function getUIOutputStream(stdout?: NodeJS.WriteStream): NodeJS.WriteStream {
  return stdout ?? (commandEventOutputMode() === 'json' ? process.stderr : process.stdout)
}
