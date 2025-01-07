// eslint-disable-next-line spaced-comment, @typescript-eslint/triple-slash-reference
/// <reference lib="dom" />

export interface HotReloadEventPayload {
  isAppExtension?: boolean
  sectionNames?: string[]
  replaceTemplates?: {[key: string]: string}
}

export type HotReloadEvent =
  | {
      type: 'open'
      pid: string
    }
  | {
      type: 'full'
      key: string
    }
  | {
      type: 'update' | 'delete'
      key: string
      sync: 'local' | 'remote'
      payload?: HotReloadEventPayload
    }

type UpdateEvent = HotReloadEvent & {type: 'update' | 'delete'}

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
  const logDebug = console.debug.bind(console, prefix)
  // eslint-disable-next-line no-console
  const logInfo = console.info.bind(console, prefix)
  // eslint-disable-next-line no-console
  const logError = console.error.bind(console, prefix)

  const searchParams = new URLSearchParams(window.location.search)
  const hotReloadParam = searchParams.get('hr')
  const isOSE = searchParams.has('oseid')

  if (isOSE && searchParams.get('source') === 'visualPreviewInitialLoad') {
    // OSE adds this extra iframe to the page and we don't need to hot reload it.
    return
  }

  let serverPid: string | undefined
  let hotReloadOrigin = window.location.origin

  if (isOSE) {
    if (!hotReloadParam) {
      logInfo('Disabled - No hot reload origin specified.')
      return
    }

    hotReloadOrigin = /^\d{4}$/.test(hotReloadParam) ? `http://localhost:${hotReloadParam}` : hotReloadParam
  }

  const evtSource = new EventSource(new URL('/__hot-reload/subscribe', hotReloadOrigin))

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

  const buildSectionHotReloadUrl = (sectionId: string, data: UpdateEvent) => {
    if (!isOSE) {
      // Note: Change this to mimic SFR API in CLI
      const prefix = data.payload?.isAppExtension ? 'app' : 'section'
      const params = [
        `section-id=${encodeURIComponent(sectionId)}`,
        `${prefix}-template-name=${encodeURIComponent(data.key)}`,
        `pathname=${encodeURIComponent(window.location.pathname)}`,
        `search=${encodeURIComponent(window.location.search)}`,
      ].join('&')

      return `${hotReloadOrigin}/__hot-reload/render?${params}`
    }

    const url = window.location.pathname
    const params = new URLSearchParams({
      _fd: '0',
      pb: '0',
    })

    for (const [key, value] of new URLSearchParams(window.location.search)) {
      params.append(key, value)
    }

    // The Section Rendering API takes precendence over the Block Rendering API.
    if (sectionId) {
      params.append('section_id', sectionId)
    }

    return `${url}?${params}`
  }

  const refreshSections = async (data: UpdateEvent, elements: Element[]) => {
    const controller = new AbortController()

    await Promise.all(
      elements.map(async (element) => {
        const sectionId = element.id.replace(/^shopify-section-/, '')

        // Note: sometimes SFR uses the old asset, even if this runs on sync:remote.
        // Perhaps SFR is still compiling the section and the new asset is not ready yet.
        // This workaround is a temporary fix until we can send replace_templates params.
        // if (isOSE) await new Promise((resolve) => setTimeout(resolve, 1000));

        const response = await fetch(buildSectionHotReloadUrl(sectionId, data), {signal: controller.signal})

        if (!response.ok) {
          throw new Error(`Hot reload request failed: ${response.statusText}`)
        }

        const updatedSection = await response.text()

        if (element.parentNode) {
          element.outerHTML = updatedSection
        }
      }),
    ).catch((error: Error) => {
      controller.abort('Request error')
      fullPageReload(data.key, error)
    })
  }

  const refreshAppEmbedBlock = async (data: UpdateEvent, block: Element) => {
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

  const refreshAppBlock = async (data: UpdateEvent, block: Element) => {
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

  const actions = {
    updateSections: async (data: UpdateEvent) => {
      const elements = data.payload?.sectionNames?.flatMap((name) =>
        Array.from(document.querySelectorAll(`[id^='shopify-section'][id$='${name}']`)),
      )

      if (elements?.length) {
        await refreshSections(data, elements)
        logInfo(`Updated sections for "${data.key}":`, data.payload?.sectionNames)
      } else {
        // No sections found. Possible scenarios:
        // - The section has been removed.
        // - There's a Liquid syntax error in place of the section.
        // - This is a full error page.
        fullPageReload(data.key)
      }
    },
    updateCss: async (data: UpdateEvent) => {
      const normalizedKey = data.key.replace(/.liquid$/, '')
      const elements: HTMLLinkElement[] = Array.from(
        document.querySelectorAll(`link[rel="stylesheet"][href*="${normalizedKey}?"]`),
      )

      refreshHTMLLinkElements(elements)
      logInfo(`Updated theme CSS: ${data.key}`)
    },
    updateExtCss: async (data: UpdateEvent) => {
      const normalizedKey = data.key.replace(/.liquid$/, '')
      const elements: HTMLLinkElement[] = Array.from(
        // Note: Remove /ext/cdn/ ?
        document.querySelectorAll(`link[rel="stylesheet"][href^="/ext/cdn/"][href*="${normalizedKey}?"]`),
      )

      refreshHTMLLinkElements(elements)
      logInfo(`Updated extension CSS: ${data.key}`)
    },
    updateExtAppBlock: async (data: UpdateEvent) => {
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

    const data: HotReloadEvent = JSON.parse(event.data)

    logDebug('Event data:', data)

    if (data.type === 'open') {
      serverPid ??= data.pid

      // If the server PID is different it means that the process has been restarted.
      // Trigger a full-refresh to get all the latest changes.
      if (serverPid !== data.pid) {
        fullPageReload('Reconnected to new server')
      }

      return
    }

    if (data.type === 'full') {
      return fullPageReload(data.key)
    }

    if (data.type !== 'update' && data.type !== 'delete') {
      return logDebug(`Unknown event "${data.type}"`)
    }

    const isRemoteSync = data.sync === 'remote'
    const [fileType] = data.key.split('/')

    // -- App extensions
    if (data.payload?.isAppExtension) {
      // App embed blocks come from local server. Skip remote sync:
      if (isRemoteSync) return

      if (fileType === 'blocks') return actions.updateExtAppBlock(data)
      if (fileType === 'assets' && data.key.endsWith('.css')) return actions.updateExtCss(data)

      return fullPageReload(data.key)
    }

    // -- Theme files
    if (fileType === 'sections') {
      // Sections come from local server unless in OSE:
      if (isOSE ? !isRemoteSync : isRemoteSync) return

      return actions.updateSections(data)
    }

    if (fileType === 'assets') {
      const isLiquidAsset = data.key.endsWith('.liquid')
      const isCssAsset = data.key.endsWith('.css') || data.key.endsWith('.css.liquid')

      // Skip local sync events for Liquid assets and OSE, since we need to wait for remote sync:
      if (isLiquidAsset || isOSE ? !isRemoteSync : isRemoteSync) return

      return isCssAsset ? actions.updateCss(data) : fullPageReload(data.key)
    }

    // For other files, if there are replace templates, use local sync. Otherwise, wait for remote sync:
    const hasReplaceTemplates = Object.keys(data.payload?.replaceTemplates ?? {}).length > 0
    if (hasReplaceTemplates && !isOSE ? !isRemoteSync : isRemoteSync) {
      return fullPageReload(data.key)
    }
  }
}
