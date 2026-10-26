import {AsyncLocalStorage} from 'node:async_hooks'

export interface ConcurrentOutputContext {
  outputPrefix?: string
  /** Controls ANSI stripping for terminal output. JSON diagnostics are always unstyled. */
  stripAnsi?: boolean
  /** Captures console messages before the terminal renderer handles them. */
  consoleWarn?: (message: string) => void
}

const outputContextStore = new AsyncLocalStorage<ConcurrentOutputContext>()

export function useConcurrentOutputContext<T>(context: ConcurrentOutputContext, callback: () => T): T {
  return outputContextStore.run(context, callback)
}

/** Returns the source and styling context for the current output write. */
export function getConcurrentOutputContext(): ConcurrentOutputContext | undefined {
  return outputContextStore.getStore()
}
