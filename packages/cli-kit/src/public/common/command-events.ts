import {z} from 'zod'

/** Schema for a diagnostic emitted while a command executes. */
export const commandDiagnosticEventSchema = z
  .object({
    type: z.literal('diagnostic'),
    timestamp: z.string().datetime({offset: true}),
    level: z.enum(['debug', 'info', 'warning']),
    message: z.string(),
    code: z.string().optional(),
  })
  .strict()

/** Schema for a progress update emitted while a command executes. */
export const commandProgressEventSchema = z
  .object({
    type: z.literal('progress'),
    timestamp: z.string().datetime({offset: true}),
    message: z.string(),
    current: z.number().nonnegative().optional(),
    total: z.number().nonnegative().optional(),
  })
  .strict()

/** Schema for side events emitted while a command executes. */
export const commandEventSchema = z.discriminatedUnion('type', [
  commandDiagnosticEventSchema,
  commandProgressEventSchema,
])

/** A diagnostic emitted while a command executes. */
export type CommandDiagnosticEvent = z.infer<typeof commandDiagnosticEventSchema>

/** A progress update emitted while a command executes. */
export type CommandProgressEvent = z.infer<typeof commandProgressEventSchema>

/** A side event emitted while a command executes. */
export type CommandEvent = z.infer<typeof commandEventSchema>

/** An event before its emission timestamp is added. */
export type CommandEventInput<TEvent extends CommandEvent = CommandEvent> = TEvent extends unknown
  ? Omit<TEvent, 'timestamp'>
  : never

/** Presentation details that are not included in the emitted event. */
export interface CommandEventEmissionOptions {
  /** The event is already visible in the command's text UI. */
  alreadyRendered?: boolean
}

/** Receives one timestamped event from a command execution. */
export type CommandEventSink<TEvent extends CommandEvent = CommandEvent> = (
  event: TEvent,
  options?: CommandEventEmissionOptions,
) => void

/** Emits timestamped side events from one command execution. */
export interface CommandEventChannel<TEvent extends CommandEvent = CommandEvent> {
  emit: (event: CommandEventInput<TEvent>, options?: CommandEventEmissionOptions) => void
}

/** Supplies the current time when an event is emitted. */
export type CommandEventClock = () => Date

/** Options for a command event channel. */
export interface CommandEventChannelOptions<TEvent extends CommandEvent> {
  sink?: CommandEventSink<TEvent>
  clock?: CommandEventClock
}

/**
 * Creates a synchronous, execution-scoped channel for command side events.
 *
 * @param options - The event sink and clock used by the channel.
 * @returns A channel that adds an ISO timestamp before synchronously delivering each event.
 */
export function createCommandEventChannel<TEvent extends CommandEvent = CommandEvent>(
  options: CommandEventChannelOptions<TEvent> = {},
): CommandEventChannel<TEvent> {
  const sink = options.sink ?? (() => {})
  const clock = options.clock ?? (() => new Date())

  return {
    emit(event, emissionOptions) {
      const timestampedEvent = {...event, timestamp: clock().toISOString()} as TEvent
      if (emissionOptions === undefined) {
        sink(timestampedEvent)
      } else {
        sink(timestampedEvent, emissionOptions)
      }
    },
  }
}
