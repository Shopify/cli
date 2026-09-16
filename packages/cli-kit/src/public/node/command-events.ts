import {outputDebug, outputInfo, outputWarn} from './output.js'
import {jsonOutputEnabled} from './environment.js'
import {defineJsonOutputSchema} from './json-output-schema.js'
import {
  commandDiagnosticEventSchema,
  commandEventSchema,
  commandProgressEventSchema,
  type CommandEvent,
} from '../common/command-events.js'
import {outputCommandEventAsJson} from '../../private/node/command-event-output.js'
import {output} from '../../private/node/output.js'
import {commandEventOutputMode, runWithCommandEvents} from '../../private/node/command-event-context.js'

export {
  commandEventOutputMode,
  emitCommandEvent,
  runWithCommandEvents,
  type CommandEventOutputMode,
} from '../../private/node/command-event-context.js'

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
    outputInfo(event.message ?? event.operation)
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
    case 'error':
      output(event.message, 'error')
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
