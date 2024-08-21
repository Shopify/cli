// eslint-disable-next-line spaced-comment, @typescript-eslint/triple-slash-reference
/// <reference lib="dom" />

export type HotReloadEvent =
  | {
      type: 'open'
      pid: string
    }
  | {
      type: 'section'
      key: string
      names: string[]
    }
  | {
      type: 'css'
      key: string
    }
  | {
      type: 'full'
      key: string
    }

export function getClientScripts() {
  return injectFunction(hotReloadScript)
}

function injectFunction(fn: () => void) {
  return `<script>(${fn.toString()})()</script>`
}

/**
 * The following are functions serialized and injected into the client's HTML.
 * Therefore, do not use any imports or references to external variables here.
 */
function hotReloadScript() {
  const prefix = '[HotReload]'
  // eslint-disable-next-line no-console
  const logInfo = console.info.bind(console, prefix)
  // eslint-disable-next-line no-console
  const logError = console.error.bind(console, prefix)

  const fullPageReload = (key: string, error?: Error) => {
    if (error) logError(error)
    logInfo('Full reload:', key)
    window.location.reload()
  }

  let serverPid: string | undefined
  const evtSource = new EventSource('/__hot-reload/subscribe', {withCredentials: true})

  evtSource.onopen = () => logInfo('Connected')
  evtSource.onerror = (event) => {
    if (event.eventPhase === EventSource.CLOSED) {
      logError('Connection closed by the server, attempting to reconnect...')
    } else {
      logError('Error occurred, attempting to reconnect...')
    }
  }

  evtSource.onmessage = async (event) => {
    if (!event.data || typeof event.data !== 'string') return

    if (document.body.id === 'full-error-page') {
      return fullPageReload('Error page update')
    }

    const data = JSON.parse(event.data) as HotReloadEvent
    logInfo('Event data:', data)

    if (data.type === 'open') {
      serverPid ??= data.pid
      // If the server PID is different it means that the process has been restarted.
      // Trigger a full-refresh to get all the latest changes.
      if (serverPid !== data.pid) fullPageReload('Reconnected to new server')
    } else if (data.type === 'section') {
      const elements = data.names.flatMap((name) =>
        Array.from(document.querySelectorAll(`[id^='shopify-section'][id$='${name}']`)),
      )

      if (elements.length > 0) {
        const controller = new AbortController()

        await Promise.all(
          elements.map(async (element) => {
            const sectionId = element.id.replace(/^shopify-section-/, '')
            const response = await fetch(
              `/__hot-reload/render?section-id=${encodeURIComponent(
                sectionId,
              )}&section-template-name=${encodeURIComponent(data.key)}`,
              {signal: controller.signal},
            )

            if (!response.ok) {
              throw new Error(`Hot reload request failed: ${response.statusText}`)
            }

            const updatedSection = await response.text()

            // SFR will send a header to indicate it used the replace-templates
            // to render the section. If it didn't, we need to do a full reload.
            if (response.headers.get('x-templates-from-params') === '1') {
              // eslint-disable-next-line require-atomic-updates
              element.outerHTML = updatedSection
            } else {
              controller.abort('Full reload required')
              fullPageReload(data.key, new Error('Hot reload not supported for this section.'))
            }
          }),
        ).catch((error: Error) => {
          controller.abort('Request error')
          fullPageReload(data.key, error)
        })

        logInfo(`Updated sections for "${data.key}":`, data.names)
      } else {
        // No sections found, this might be due to a syntax error in the section file.
        // In this case, the rendered page does not include the section ID in the DOM,
        // only a syntax error message as a text node. Check the outerText of the document,
        // which is the shortest string that contains text nodes:
        const documentText = document.documentElement.outerText
        if (documentText.includes('Liquid syntax error')) {
          fullPageReload(data.key, new Error('Syntax error in document'))
        }
      }
    } else if (data.type === 'css') {
      const elements: HTMLLinkElement[] = Array.from(
        document.querySelectorAll(`link[rel="stylesheet"][href^="/cdn/"][href*="${data.key}?"]`),
      )

      for (const element of elements) {
        // The `href` property prepends the host to the pathname. Use attributes instead:
        element.setAttribute('href', element.getAttribute('href')!.replace(/v=\d+$/, `v=${Date.now()}`))
        logInfo('Updated CSS:', data.key)
      }
    } else if (data.type === 'full') {
      fullPageReload(data.key)
    }
  }
}
