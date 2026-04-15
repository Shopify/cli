import {
  injectStandardEventsInspector,
  rewriteStandardEventsRuntimeReferences,
  standardEventsInspectorScriptId,
  standardEventsInspectorUrl,
  standardEventsRuntimeDevUrl,
  standardEventsRuntimeUrl,
} from './standard-events.js'
import {describe, expect, test} from 'vitest'

describe('injectStandardEventsInspector', () => {
  test('injects the inspector script at the beginning of the head element', () => {
    const html = '<html><head><meta charset="utf-8"></head><body></body></html>'

    expect(injectStandardEventsInspector(html)).toBe(
      `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script><meta charset="utf-8"></head><body></body></html>`,
    )
  })

  test('does not rewrite standard-events.js when injecting the inspector', () => {
    const html = `<html><head><script src="${standardEventsRuntimeUrl}"></script></head><body></body></html>`

    expect(injectStandardEventsInspector(html)).toBe(
      `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script><script src="${standardEventsRuntimeUrl}"></script></head><body></body></html>`,
    )
  })

  test('does not inject the inspector twice', () => {
    const html = `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script></head><body></body></html>`

    expect(injectStandardEventsInspector(html)).toBe(html)
  })

  test('does not treat a plain inspector URL string as an existing inspector script', () => {
    const html = `<html><head><script>window.inspectorUrl = "${standardEventsInspectorUrl}"</script></head><body></body></html>`

    expect(injectStandardEventsInspector(html)).toBe(
      `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script><script>window.inspectorUrl = "${standardEventsInspectorUrl}"</script></head><body></body></html>`,
    )
  })

  test('leaves standard-events.js unchanged when the inspector is already present', () => {
    const html = `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script><script src="${standardEventsRuntimeUrl}"></script></head><body></body></html>`

    expect(injectStandardEventsInspector(html)).toBe(html)
  })
})

describe('rewriteStandardEventsRuntimeReferences', () => {
  test('rewrites standard-events.js to standard-events.dev.js', () => {
    const html = `<html><head><script src="${standardEventsRuntimeUrl}"></script></head><body></body></html>`

    expect(rewriteStandardEventsRuntimeReferences(html)).toBe(
      `<html><head><script src="${standardEventsRuntimeDevUrl}"></script></head><body></body></html>`,
    )
  })

  test('rewrites multiple standard-events.js references', () => {
    const content = `"${standardEventsRuntimeUrl}" import("${standardEventsRuntimeUrl}")`

    expect(rewriteStandardEventsRuntimeReferences(content)).toBe(
      `"${standardEventsRuntimeDevUrl}" import("${standardEventsRuntimeDevUrl}")`,
    )
  })
})
