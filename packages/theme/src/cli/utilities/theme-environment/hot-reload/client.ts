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

  // Situations where this script can run:
  // - Local preview in the CLI: the URL is like localhost:<port>
  // - OSE visual preview: the URL is a myshopify.com domain
  // - Theme Preview: the URL is a myshopify.com domain
  const isLocalPreview = Boolean(window.location.port)
  const isOSE = searchParams.has('oseid')

  if (isOSE && searchParams.get('source') === 'visualPreviewInitialLoad') {
    // OSE adds this extra iframe to the page and we don't need to hot reload it.
    return
  }

  const hrParam = 'hr'
  const hrKey = `__${hrParam}`

  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const hotReloadParam = searchParams.get(hrParam) || window.location.port || localStorage.getItem(hrKey)

  if (hotReloadParam) {
    // Store the hot reload port in localStorage to keep it after a page reload,
    // but remove it from the URL to avoid confusing the user in Theme Preview.
    localStorage.setItem(hrKey, hotReloadParam)
    if (!isLocalPreview && !isOSE && searchParams.has(hrParam)) {
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete(hrParam)
      window.history.replaceState({}, '', newUrl)
    }
  } else {
    // Note: this should fallback to window messages eventually for the Service Worker.
    logInfo('Disabled - No hot reload port specified.')
    return
  }

  let hotReloadOrigin = window.location.origin

  if (!isLocalPreview) {
    hotReloadOrigin = /^\d+$/.test(hotReloadParam) ? `http://localhost:${hotReloadParam}` : hotReloadParam
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
    if (isLocalPreview) {
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

  const oseActions = {
    startDataReload: async (signal: AbortSignal) => {
      if (!isOSE) return null

      // Force OSE to show the loading state
      window.dispatchEvent(new Event('pagehide'))

      return fetch(window.location.href, {
        // Note: enable these properties when we have access to replace_templates
        // method: 'POST',
        // body: storefrontReplaceTemplatesParams(data.replaceTemplates),
        // This is required to get the OnlineStoreEditorData script:
        headers: {Accept: 'text/html'},
        signal,
      })
        .then((response) => response.text())
        .catch((error) => {
          logError('Error fetching full page reload for section settings', error)
          return null
        })
    },
    finishDataReload: async (oseDataPromise: Promise<string | null>) => {
      if (!isOSE) return null

      const refreshedHtml = await oseDataPromise
      const newOSEData = new DOMParser()
        .parseFromString(refreshedHtml ?? '', 'text/html')
        .querySelector('#OnlineStoreEditorData')?.textContent

      if (newOSEData) {
        const oseDataElement = document.querySelector('#OnlineStoreEditorData')
        if (oseDataElement && newOSEData !== oseDataElement.textContent) {
          oseDataElement.textContent = newOSEData
          logInfo('OSE data updated')
        }
      }

      // OSE reads the new data after the page is loaded
      window.dispatchEvent(new Event('load'))
    },
    sendEvent: (payload: Pick<UpdateEvent, 'key'>) => {
      if (!isOSE) return
      window.parent.postMessage({type: 'StorefrontEvent::HotReload', payload}, `https://${window.Shopify.editorDomain}`)
    },
  }

  const refreshSections = async (data: UpdateEvent, elements: Element[]) => {
    // The current section hot reload logic creates small issues in OSE state.
    // For now, we reload the full page to workaround this problem finding a better solution:
    if (isOSE) fullPageReload(data.key)

    const controller = new AbortController()
    const oseDataPromise = isOSE ? oseActions.startDataReload(controller.signal) : null

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

    if (oseDataPromise) {
      await oseActions.finishDataReload(oseDataPromise)
    }
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

  const domActions = {
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

  let serverPid: string | undefined

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
    const [fileType, fileName] = data.key.split('/')

    // -- App extensions
    if (data.payload?.isAppExtension) {
      // App embed blocks come from local server. Skip remote sync:
      if (isRemoteSync) return

      if (fileType === 'blocks') return domActions.updateExtAppBlock(data)
      if (fileType === 'assets' && data.key.endsWith('.css')) return domActions.updateExtCss(data)

      return fullPageReload(data.key)
    }

    // -- Theme files
    if (fileType === 'sections') {
      // Sections come from local server only in local preview:
      if (isLocalPreview ? isRemoteSync : !isRemoteSync) return

      return domActions.updateSections(data)
    }

    if (fileType === 'assets') {
      const isLiquidAsset = data.key.endsWith('.liquid')
      const isCssAsset = data.key.endsWith('.css') || data.key.endsWith('.css.liquid')

      // Skip remote sync events for local preview unless it's a Liquid asset.
      // Skip local sync events for prod previews.
      if (isLocalPreview && !isLiquidAsset ? isRemoteSync : !isRemoteSync) return

      return isCssAsset ? domActions.updateCss(data) : fullPageReload(data.key)
    }

    if (fileType === 'config') {
      if (isOSE) oseActions.sendEvent({key: data.key})

      // No need to refresh previews for this file.
      if (fileName === 'settings_schema.json') return
    }

    // For other files, if there are replace templates, use local sync. Otherwise, wait for remote sync:
    const hasReplaceTemplates = Object.keys(data.payload?.replaceTemplates ?? {}).length > 0
    if (isLocalPreview && hasReplaceTemplates ? !isRemoteSync : isRemoteSync) {
      return fullPageReload(data.key)
    }
  }
}
