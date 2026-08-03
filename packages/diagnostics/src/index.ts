/* eslint-disable no-catch-all/no-catch-all */

/**
 * Data-only, synchronous diagnostic primitives for the event-sink PoC.
 *
 * This module intentionally has no imports. Domain packages can depend on this leaf without
 * introducing terminal, renderer, or domain dependencies.
 */
export type DiagnosticLevel = 'debug' | 'info' | 'warning'

/**
 * Data emitted by command execution to describe a diagnostic.
 *
 * Domain-specific events can extend this shape with a discriminant and structured fields. The
 * event carries no terminal or renderer objects, so adapters can render, suppress, record, or
 * route it without changing the execution code.
 */
export interface DiagnosticEvent {
  readonly level: DiagnosticLevel
  readonly message: string
}

/** Receives one diagnostic from an execution channel. */
export type DiagnosticObserver<TEvent extends DiagnosticEvent = DiagnosticEvent> = (event: TEvent) => void

/**
 * Delivers diagnostics from execution to one or more observers.
 *
 * This PoC delivers events synchronously. Async delivery can remain a compatible future extension
 * without making execution depend on an async channel API today.
 */
export interface SyncDiagnosticChannel<TEvent extends DiagnosticEvent = DiagnosticEvent> {
  emit(event: TEvent): void
}

/**
 * Creates a synchronous channel that calls observers in registration order.
 *
 * Diagnostic observers are advisory. A failing observer is isolated so it cannot change the
 * command result or prevent later observers from receiving the event.
 */
export function createSyncDiagnosticChannel<TEvent extends DiagnosticEvent = DiagnosticEvent>(
  ...observers: DiagnosticObserver<TEvent>[]
): SyncDiagnosticChannel<TEvent> {
  return {
    emit(event) {
      for (const observer of observers) {
        try {
          observer(event)
        } catch {
          // Optional diagnostic observers must not change the command result.
        }
      }
    },
  }
}
