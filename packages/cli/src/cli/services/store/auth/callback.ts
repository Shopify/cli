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

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f6f6f7;color:#202223;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <main style="max-width:32rem;margin:12vh auto;padding:0 1rem;">
      <section style="background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:1.5rem 1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <h1 style="margin:0 0 0.75rem 0;font-size:1.375rem;line-height:1.2;">${safeTitle}</h1>
        <p style="margin:0;font-size:1rem;line-height:1.5;">${safeMessage}</p>
      </section>
    </main>
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
