import {
  createCommandEventChannel,
  type CommandEvent,
  type CommandEventChannel,
  type CommandEventChannelOptions,
  type CommandEventEmissionOptions,
  type CommandEventInput,
} from '../../public/common/command-events.js'
import {AsyncLocalStorage} from 'node:async_hooks'

export type CommandEventOutputMode = 'text' | 'json'

interface CommandEventContext {
  channel: CommandEventChannel
  outputMode: CommandEventOutputMode
}

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
  return getCommandEventStorage().run(
    {
      channel: createCommandEventChannel(options),
      outputMode: options.outputMode ?? 'text',
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
  getCommandEventStorage().getStore()?.channel.emit(event, options)
}

/**
 * Returns how command events are presented for the current execution.
 *
 * @returns The current event output mode, or undefined outside a command event context.
 */
export function commandEventOutputMode(): CommandEventOutputMode | undefined {
  return getCommandEventStorage().getStore()?.outputMode
}

function getCommandEventStorage(): AsyncLocalStorage<CommandEventContext> {
  const key = Symbol.for('command-event-storage')
  const sharedGlobal = globalThis as typeof globalThis & {
    [key]?: AsyncLocalStorage<CommandEventContext>
  }

  // cli-kit can be loaded both externally and inside the bundled CLI. Both copies must observe
  // the same command execution context so output helpers consistently emit JSON events.
  sharedGlobal[key] ??= new AsyncLocalStorage<CommandEventContext>()
  return sharedGlobal[key]
}
