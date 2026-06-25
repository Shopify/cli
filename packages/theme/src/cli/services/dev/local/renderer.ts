import {RenderRequest, RenderResult, ThemeRenderer} from './types.js'

/**
 * Draft renderer for the local dev server.
 *
 * It returns a static "hello world" HTML document with the live-reload client
 * script injected before `</head>`. Real local Liquid rendering is out of
 * scope for this first draft and will implement the same `ThemeRenderer`
 * interface later, so the server and middleware never need to change.
 *
 * @param clientScript - The reload client script (from the transport) injected
 * into the page so the browser can subscribe to reload events.
 */
export function helloWorldRenderer(clientScript: string): ThemeRenderer {
  return {
    async render(_request: RenderRequest): Promise<RenderResult> {
      const body = renderHelloWorldDocument(clientScript)

      return {
        body,
        status: 200,
        headers: {'content-type': 'text/html; charset=utf-8'},
      }
    },
  }
}

/**
 * Builds the hello-world document and injects the reload client script before
 * the closing `</head>` tag, matching how the remote flow injects its own
 * hot-reload script.
 */
function renderHelloWorldDocument(clientScript: string): string {
  const head = `<head>\n<meta charset="utf-8" />\n<title>Shopify theme dev (local)</title>\n<script>${clientScript}</script>\n</head>`

  return `<!DOCTYPE html>\n<html lang="en">\n${head}\n<body>\n<h1>hello world</h1>\n</body>\n</html>\n`
}
