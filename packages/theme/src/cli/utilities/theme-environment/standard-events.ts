const headTagRE = /<head(\s[^>]*)?>/i

export const standardEventsBaseUrl = 'https://cdn.shopify.com/storefront'
export const standardEventsRuntimeUrl = `${standardEventsBaseUrl}/standard-events.js`
export const standardEventsRuntimeDevUrl = `${standardEventsBaseUrl}/standard-events.dev.js`
export const standardEventsInspectorUrl = `${standardEventsBaseUrl}/standard-events-inspector.js`
export const standardEventsInspectorScriptId = 'shopify-cli-standard-events-inspector'
const standardEventsInspectorScriptRE = new RegExp(
  `<script\\b[^>]*(?:\\bid=["']${escapeRegExp(standardEventsInspectorScriptId)}["']|\\bsrc=["']${escapeRegExp(
    standardEventsInspectorUrl,
  )}["'])[^>]*>`,
  'i',
)
const standardEventsRuntimeRE = new RegExp(escapeRegExp(standardEventsRuntimeUrl), 'g')

export function injectStandardEventsInspector(html: string) {
  if (standardEventsInspectorScriptRE.test(html)) {
    return html
  }

  return html.replace(
    headTagRE,
    (headTag: string) =>
      `${headTag}<script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script>`,
  )
}

export function rewriteStandardEventsRuntimeReferences(content: string) {
  return content.replace(standardEventsRuntimeRE, standardEventsRuntimeDevUrl)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
