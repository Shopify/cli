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
      token: string
      cookies: string
      sectionNames: string[]
      replaceTemplates: {[key: string]: string}
    }
  | {
      type: 'css'
      key: string
    }
  | {
      type: 'full'
      key: string
    }
  | {
      type: 'extCss'
      key: string
    }
  | {
      type: 'extAppBlock'
      key: string
    }

type HotReloadActionMap = {
  [T in HotReloadEvent['type']]: (data: HotReloadEvent & {type: T}) => Promise<void>
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
  let serverPid: string | undefined

  const prefix = '[HotReload]'
  const evtSource = new EventSource('/__hot-reload/subscribe', {withCredentials: true})

  // eslint-disable-next-line no-console
  const logInfo = console.info.bind(console, prefix)

  // eslint-disable-next-line no-console
  const logError = console.error.bind(console, prefix)

  const fullPageReload = (key: string, error?: Error) => {
    if (error) logError(error)
    logInfo('Full reload:', key)
    window.location.reload()
  }

  const refreshHTMLLinkElements = (elements: HTMLLinkElement[]) => {
    for (const element of elements) {
      // The `href` property prepends the host to the pathname. Use attributes instead.
      // Note: when a .liquid asset is requested but not found in SFR, it will be rendered as
      // `.../assets/file.css?1234` instead of `.../assets/file.css?v=1234`. Ensure we target both.
      element.setAttribute(
        'href',
        (element.getAttribute('href') ?? '').replace(/(\?|&)(?:v=)?\d+$/, `$1v=${Date.now()}`),
      )
    }
  }

  const refreshSections = async (data: HotReloadEvent & {type: 'section' | 'extAppBlock'}, elements: Element[]) => {
    const controller = new AbortController()

    await Promise.all(
      elements.map(async (element) => {
        const prefix = data.type === 'section' ? 'section' : 'app'
        const sectionId = element.id.replace(/^shopify-section-/, '')
        const params = [
          `section-id=${encodeURIComponent(sectionId)}`,
          `${prefix}-template-name=${encodeURIComponent(data.key)}`,
          `pathname=${encodeURIComponent(window.location.pathname)}`,
          `search=${encodeURIComponent(window.location.search)}`,
        ].join('&')

        const response = await fetch(`/__hot-reload/render?${params}`, {signal: controller.signal})

        if (!response.ok) {
          throw new Error(`Hot reload request failed: ${response.statusText}`)
        }

        const updatedSection = await response.text()

        // eslint-disable-next-line require-atomic-updates
        element.outerHTML = updatedSection
      }),
    ).catch((error: Error) => {
      controller.abort('Request error')
      fullPageReload(data.key, error)
    })
  }

  const refreshAppEmbedBlock = async (data: HotReloadEvent & {type: 'extAppBlock'}, block: Element) => {
    const controller = new AbortController()

    const appEmbedBlockId = block.id.replace(/^shopify-block-/, '')
    const params = [
      `app-block-id=${encodeURIComponent(appEmbedBlockId)}`,
      `pathname=${encodeURIComponent(window.location.pathname)}`,
      `search=${encodeURIComponent(window.location.search)}`,
    ].join('&')

    const response = await fetch(`/__hot-reload/render?${params}`, {signal: controller.signal})

    if (!response.ok) {
      controller.abort('Request error')
      fullPageReload(data.key)
    }

    // eslint-disable-next-line require-atomic-updates
    block.outerHTML = await response.text()
  }

  const refreshAppBlock = async (data: HotReloadEvent & {type: 'extAppBlock'}, block: Element) => {
    const blockSection = block.closest(`[id^=shopify-section-]`)
    const isAppEmbed = blockSection === null

    if (isAppEmbed) {
      // App embed blocks rely on the app block rendering API to hot reload
      return refreshAppEmbedBlock(data, block)
    } else {
      // Regular section blocks rely on the section rendering API to hot reload
      return refreshSections(data, [blockSection])
    }
  }

  const action: HotReloadActionMap = {
    open: async (data) => {
      serverPid ??= data.pid

      // If the server PID is different it means that the process has been restarted.
      // Trigger a full-refresh to get all the latest changes.
      if (serverPid !== data.pid) {
        fullPageReload('Reconnected to new server')
      }
    },
    section: async (data) => {
      const elements = data.sectionNames
        .map(([name]) => Array.from(document.querySelectorAll(`[id^='shopify-section'][id$='${name}']`)))
        .flat()

      if (elements.length > 0) {
        await refreshSections(data, elements)
        logInfo(`Updated sections for "${data.key}":`, data.sectionNames)
      } else {
        // No sections found. Possible scenarios:
        // - The section has been removed.
        // - There's a Liquid syntax error in place of the section.
        // - This is a full error page.
        fullPageReload(data.key)
      }
    },
    css: async (data) => {
      const elements: HTMLLinkElement[] = Array.from(
        document.querySelectorAll(`link[rel="stylesheet"][href^="/cdn/"][href*="${data.key}?"]`),
      )

      refreshHTMLLinkElements(elements)
      logInfo(`Updated theme CSS: ${data.key}`)
    },
    full: async (data) => {
      fullPageReload(data.key)
    },
    extCss: async (data) => {
      const elements: HTMLLinkElement[] = Array.from(
        document.querySelectorAll(`link[rel="stylesheet"][href^="/ext/cdn/"][href*="${data.key}?"]`),
      )

      refreshHTMLLinkElements(elements)
      logInfo(`Updated extension CSS: ${data.key}`)
    },
    extAppBlock: async (data) => {
      const blockHandle = data.key.match(/\/(\w+)\.liquid$/)?.[1]
      const blockElements = Array.from(document.querySelectorAll(`[data-block-handle$='${blockHandle}']`))

      await Promise.all([
        blockElements.map((block) => {
          return refreshAppBlock(data, block)
        }),
      ])

      logInfo(`Updated blocks for ${data.key}`)
    },
  }

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

    const data = JSON.parse(event.data)

    logInfo('Event data:', data)

    const actionFn = action[data.type as HotReloadEvent['type']]
    await actionFn(data)
  }
}
