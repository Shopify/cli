import {ReloadEvent} from './types.js'
import {createEventStream, defineEventHandler, type EventHandler} from 'h3'
import {renderWarning} from '@shopify/cli-kit/node/ui'

import EventEmitter from 'node:events'

/**
 * The endpoint the browser opens an `EventSource` against. Namespaced so it
 * cannot collide with a real theme route.
 */
export const RELOAD_ENDPOINT = '/__local_reload'

/* Internal EventEmitter channel name. */
const RELOAD_EVENT = 'reload'

/**
 * The live-reload transport for the local dev server.
 *
 * This is the fast-refresh contract: the server pushes reload events to the
 * browser over Server-Sent Events, fed by an in-process `EventEmitter`. We do
 * NOT reuse the external `@shopify/theme-hot-reload` client — its wire protocol
 * assumes remote-SFR section payloads. Instead the transport owns a tiny
 * injected client script and a simpler event contract.
 *
 * The draft only ever triggers a full-page reload; the `ReloadEvent` union
 * leaves room for granular events later.
 */
export interface ReloadTransport {
  /* SSE endpoint handler; mount on RELOAD_ENDPOINT. */
  handler: EventHandler
  /* Push a reload event to every connected browser. */
  triggerReload(event: ReloadEvent): void
  /* Client script injected into rendered HTML by the renderer. */
  clientScript: string
}

export function createReloadTransport(): ReloadTransport {
  const eventEmitter = new EventEmitter()

  /* Many SSE clients can connect; lift the default 10-listener cap so a few
     open tabs don't print a spurious MaxListeners warning. */
  eventEmitter.setMaxListeners(0)

  const handler = defineEventHandler((event) => {
    const isEventSourceConnection = event.headers.get('accept') === 'text/event-stream'

    if (!isEventSourceConnection) {
      return
    }

    const eventStream = createEventStream(event)

    const onReload = (reloadEvent: ReloadEvent) => {
      eventStream.push(JSON.stringify(reloadEvent)).catch((error: Error) => {
        renderWarning({headline: 'Failed to send reload event.', body: error.stack})
      })
    }

    eventEmitter.on(RELOAD_EVENT, onReload)

    /* Stop pushing once the browser disconnects so the emitter doesn't leak
       listeners for closed connections. */
    eventStream.onClosed(() => {
      eventEmitter.off(RELOAD_EVENT, onReload)
    })

    return eventStream.send().then(() => eventStream.flush())
  })

  return {
    handler,
    triggerReload(event: ReloadEvent) {
      eventEmitter.emit(RELOAD_EVENT, event)
    },
    clientScript: buildClientScript(RELOAD_ENDPOINT),
  }
}

/**
 * The injected browser runtime. It subscribes to the SSE endpoint and does a
 * full-page reload on any event. Auto-reconnect is handled by `EventSource`
 * itself; we only guard against a noisy console on transient errors.
 */
function buildClientScript(endpoint: string): string {
  return `(function () {
  var source = new EventSource(${JSON.stringify(endpoint)});
  source.onmessage = function () {
    window.location.reload();
  };
  source.onerror = function () {
    /* EventSource retries automatically; swallow transient errors. */
  };
})();`
}
