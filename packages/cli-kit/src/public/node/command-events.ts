import {outputDebug, outputInfo, outputWarn} from './output.js'
import {jsonOutputEnabled} from './environment.js'
import {defineJsonOutputSchema} from './json-output-schema.js'
import {
  commandDiagnosticEventSchema,
  commandEventSchema,
  commandProgressEventSchema,
  type CommandEvent,
  type CommandEventChannelOptions,
  type CommandEventEmissionOptions,
  type CommandEventInput,
} from '../common/command-events.js'
import {outputCommandEventAsJson} from '../../private/node/command-event-output.js'
import {
  commandEventOutputMode as currentCommandEventOutputMode,
  emitCommandEvent as emitCommandEventInContext,
  runWithCommandEvents as runWithCommandEventContext,
  type CommandEventOutputMode,
} from '../../private/node/command-event-context.js'

export type {CommandEventOutputMode} from '../../private/node/command-event-context.js'

interface RunWithCommandEventsOptions extends CommandEventChannelOptions<CommandEvent> {
  outputMode?: CommandEventOutputMode
}

/**
 * Runs a command execution with an event channel available to all nested asynchronous work.
 *
 * @param options - The event sink, clock, and output mode used by the channel.
 * @param execute - The command execution to run with the channel.
 * @returns The result of the command execution.
 */
export function runWithCommandEvents<TResult>(options: RunWithCommandEventsOptions, execute: () => TResult): TResult {
  return runWithCommandEventContext(options, execute)
}

/**
 * Runs the complete CLI lifecycle with the event presentation selected by its arguments.
 *
 * @param argv - The command arguments used to determine whether JSON output is enabled.
 * @param execute - The command lifecycle to run.
 * @returns The result of the command lifecycle.
 */
export function runWithCommandEventsForCommand<TResult>(argv: string[], execute: () => TResult): TResult {
  if (commandEventOutputMode() !== undefined) return execute()

  const outputMode = jsonOutputEnabled(process.env, argv) ? 'json' : 'text'
  return runWithCommandEvents(
    {
      outputMode,
      sink:
        outputMode === 'json'
          ? renderCommandEventAsJson
          : (event, options) => {
              if (!options?.alreadyRendered) renderCommandEvent(event)
            },
    },
    execute,
  )
}

/**
 * Emits an event for the current command execution.
 *
 * Events emitted outside a command execution are ignored.
 *
 * @param event - The event to emit before its timestamp is added.
 * @param options - Presentation details that are not included in the event.
 */
export function emitCommandEvent(event: CommandEventInput, options?: CommandEventEmissionOptions): void {
  emitCommandEventInContext(event, options)
}

/**
 * Returns how command events are presented for the current execution.
 *
 * @returns The current event output mode, or undefined outside a command event context.
 */
export function commandEventOutputMode(): CommandEventOutputMode | undefined {
  return currentCommandEventOutputMode()
}

export const commandEventOutputSchema = defineJsonOutputSchema({
  name: 'CommandEvent',
  schema: commandEventSchema,
  definitions: {
    CommandDiagnosticEvent: commandDiagnosticEventSchema,
    CommandProgressEvent: commandProgressEventSchema,
  },
})

/**
 * Renders a command side event to stderr using the existing CLI output behavior.
 *
 * @param event - The event to render.
 */
export function renderCommandEvent(event: CommandEvent): void {
  if (event.type === 'progress') {
    outputInfo(event.message)
    return
  }

  switch (event.level) {
    case 'debug':
      outputDebug(event.message)
      break
    case 'info':
      outputInfo(event.message)
      break
    case 'warning':
      outputWarn(event.message)
      break
  }
}

/**
 * Renders a command side event as compact JSON to stderr.
 *
 * @param event - The event to render.
 */
export function renderCommandEventAsJson(event: CommandEvent): void {
  outputCommandEventAsJson(event)
}
