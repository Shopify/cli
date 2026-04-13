import {STORE_AUTH_CALLBACK_PATH, maskToken} from './config.js'
import {retryStoreAuthWithPermanentDomainError} from './recovery.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {timingSafeEqual} from 'crypto'
import {createServer} from 'http'

export interface WaitForAuthCodeOptions {
  store: string
  state: string
  port: number
  timeoutMs?: number
  onListening?: () => void | Promise<void>
}

function renderAuthCallbackPage(title: string, message: string): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safeMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Shopify bag icon SVG — same asset used by accounts.shopify.com/activate
  const shopifyLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 28" width="80" height="90"><path fill="#95BF47" fill-rule="evenodd" d="M17.836 27.059l-.062-23.736c-.16-.16-.472-.112-.594-.076l-.813.252a5.675 5.675 0 00-.39-.957c-.576-1.1-1.42-1.682-2.44-1.683h-.003c-.068 0-.136.006-.204.012h-.008a2.234 2.234 0 00-.092-.105C12.786.29 12.216.059 11.533.079c-1.318.038-2.63.99-3.693 2.679-.75 1.19-1.318 2.683-1.48 3.84L3.767 7.4c-.764.24-.788.263-.888.982C2.803 8.928.806 24.377.806 24.377l16.743 2.895.287-.213zM12.35 1.163a1.347 1.347 0 00-.792-.208c-2.033.06-3.807 3.235-4.26 5.352l1.949-.604.347-.107c.255-1.344.896-2.738 1.733-3.636a3.821 3.821 0 011.023-.797zm-1.793 4.135l2.796-.866c.009-.728-.07-1.805-.435-2.565-.388.16-.715.44-.95.691-.628.675-1.14 1.705-1.41 2.74zM14.23 4.16l1.299-.403c-.208-.674-.7-1.805-1.7-1.994.311.802.391 1.73.4 2.397z" clip-rule="evenodd"/><path fill="#5E8E3E" d="M21.587 5.088c-.099-.008-2.035-.037-2.035-.037s-1.619-1.573-1.778-1.733a.399.399 0 00-.225-.103v24.053l7.256-1.804S21.844 5.447 21.825 5.31a.263.263 0 00-.238-.222z"/><path fill="#fff" d="M13.528 8.824l-.843 3.153s-.94-.429-2.054-.358c-1.635.103-1.652 1.134-1.636 1.392.09 1.41 3.799 1.718 4.008 5.021.163 2.599-1.379 4.376-3.601 4.516-2.667.169-4.135-1.405-4.135-1.405l.565-2.404s1.478 1.115 2.66 1.04c.773-.048 1.05-.677 1.021-1.121-.116-1.84-3.137-1.731-3.328-4.754-.16-2.544 1.51-5.12 5.196-5.353 1.42-.09 2.147.273 2.147.273"/></svg>`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        background-color: rgb(10, 19, 20);
        color: rgb(32, 34, 35);
      }
      body {
        background: radial-gradient(53.91% 53.91% at 50% 22.36%, rgb(10, 19, 20) 50%, rgb(2, 9, 10) 100%);
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 20px;
        -webkit-font-smoothing: antialiased;
      }
      .page-main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .header {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .card {
        background: #fff;
        border-radius: 24px;
        box-shadow: rgba(26, 26, 26, 0.24) 0px 12px 20px -8px,
                    rgba(204, 204, 204, 0.5) 0px 1px 0px 0px inset,
                    rgba(0, 0, 0, 0.17) 0px -1px 0px 0px inset,
                    rgba(0, 0, 0, 0.13) -1px 0px 0px 0px inset,
                    rgba(0, 0, 0, 0.13) 1px 0px 0px 0px inset;
        max-width: 476px;
        width: calc(100% - 2rem);
        margin-top: 28px;
        padding: 40px;
      }
      h1 {
        font-size: 24px;
        font-weight: 600;
        line-height: 28.8px;
        color: rgb(32, 34, 35);
        margin-bottom: 12px;
      }
      p {
        font-size: 14px;
        line-height: 20px;
        color: rgb(109, 113, 117);
      }
      .footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px 20px;
        font-size: 12px;
        line-height: 16px;
        color: rgb(191, 199, 200);
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="page-main">
      <header class="header">${shopifyLogo}</header>
      <main class="card">
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
      </main>
    </div>
    <footer class="footer">Shopify CLI</footer>
  </body>
</html>`
}

export async function waitForStoreAuthCode({
  store,
  state,
  port,
  timeoutMs = 5 * 60 * 1000,
  onListening,
}: WaitForAuthCodeOptions): Promise<string> {
  const normalizedStore = normalizeStoreFqdn(store)

  return new Promise<string>((resolve, reject) => {
    let settled = false
    let isListening = false

    const timeout = setTimeout(() => {
      settleWithError(new AbortError('Timed out waiting for OAuth callback.'))
    }, timeoutMs)

    const server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)

      if (requestUrl.pathname !== STORE_AUTH_CALLBACK_PATH) {
        res.statusCode = 404
        res.end('Not found')
        return
      }

      const {searchParams} = requestUrl

      const fail = (error: AbortError | string, tryMessage?: string) => {
        const abortError = typeof error === 'string' ? new AbortError(error, tryMessage) : error

        res.statusCode = 400
        res.setHeader('Content-Type', 'text/html')
        res.setHeader('Connection', 'close')
        res.once('finish', () => settleWithError(abortError))
        res.end(renderAuthCallbackPage('Authentication failed', abortError.message))
      }

      const returnedStore = searchParams.get('shop')
      outputDebug(outputContent`Received OAuth callback for shop ${outputToken.raw(returnedStore ?? 'unknown')}`)

      if (!returnedStore) {
        fail('OAuth callback store does not match the requested store.')
        return
      }

      const normalizedReturnedStore = normalizeStoreFqdn(returnedStore)
      if (normalizedReturnedStore !== normalizedStore) {
        fail(retryStoreAuthWithPermanentDomainError(normalizedReturnedStore))
        return
      }

      const returnedState = searchParams.get('state')
      if (!returnedState || !constantTimeEqual(returnedState, state)) {
        fail('OAuth callback state does not match the original request.')
        return
      }

      const error = searchParams.get('error')
      if (error) {
        fail(`Shopify returned an OAuth error: ${error}`)
        return
      }

      const code = searchParams.get('code')
      if (!code) {
        fail('OAuth callback did not include an authorization code.')
        return
      }

      outputDebug(outputContent`Received authorization code ${outputToken.raw(maskToken(code))}`)

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.setHeader('Connection', 'close')
      res.once('finish', () => settle(() => resolve(code)))
      res.end(
        renderAuthCallbackPage('Authentication succeeded', 'You can close this window and return to the terminal.'),
      )
    })

    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)

      const finalize = () => {
        callback()
      }

      if (!isListening) {
        finalize()
        return
      }

      server.close(() => {
        isListening = false
        finalize()
      })
      server.closeIdleConnections?.()
    }

    const settleWithError = (error: Error) => {
      settle(() => reject(error))
    }

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        settleWithError(
          new AbortError(
            `Port ${port} is already in use.`,
            `Free port ${port} and re-run ${outputToken.genericShellCommand(`shopify store auth --store ${store} --scopes <comma-separated-scopes>`).value}. Ensure that redirect URI is allowed in the app configuration.`,
          ),
        )
        return
      }

      settleWithError(error)
    })

    server.listen(port, '127.0.0.1', () => {
      isListening = true
      outputDebug(
        outputContent`PKCE callback server listening on http://127.0.0.1:${outputToken.raw(String(port))}${outputToken.raw(STORE_AUTH_CALLBACK_PATH)}`,
      )

      if (!onListening) return

      Promise.resolve(onListening()).catch((error: unknown) => {
        settleWithError(error instanceof Error ? error : new Error(String(error)))
      })
    })
  })
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}
