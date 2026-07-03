import {EventEmitter} from 'events'

/**
 * Status shown live in the persistent theme-dev view's footer region.
 */
export interface DevSessionStatus {
  message: string
  type: 'loading' | 'success' | 'error'
}

/**
 * A mid-session banner surfaced as an in-tree node (rendered in Phase B).
 */
export interface DevSessionAlert {
  headline: string
  body?: string
}

export interface DevSessionOutputEvents {
  log: [line: string]
  status: [status: DevSessionStatus]
  alert: [alert: DevSessionAlert]
  // NOTE: intentionally NOT named `error`. Node's EventEmitter treats `'error'`
  // as a reserved event: `emit('error', …)` with no listener attached throws
  // (`ERR_UNHANDLED_ERROR`). The view subscribes in a `useEffect`, so an error
  // emitted before that effect runs (mount race) would crash the dev server.
  // Using a non-reserved name removes the throw-on-no-listener semantics.
  'session-error': [error: Error | string]
}

/**
 * Per-session output sink for the persistent `theme dev` Ink view.
 *
 * Live writers emit lines/events into this emitter; the view subscribes in a
 * `useEffect` and pushes them into React state so nothing writes raw bytes to
 * the terminal while the live region is mounted. It is injected per dev
 * session — non-dev callers of shared utilities never receive one, so their
 * behavior is unchanged.
 *
 * Reimplemented on node `events` (no app-private imports) mirroring the shape
 * of `app dev`'s `DevSessionStatusManager`.
 */
export class DevSessionOutput extends EventEmitter {
  log(line: string) {
    this.emit('log', line)
  }

  status(status: DevSessionStatus) {
    this.emit('status', status)
  }

  alert(alert: DevSessionAlert) {
    this.emit('alert', alert)
  }

  error(error: Error | string) {
    this.emit('session-error', error)
  }
}
