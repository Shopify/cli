import {GraphiQLAppContext, setupGraphiQLServer, TokenProvider} from './server.js'
import {graphiqlJsonOutputSchema, type GraphiQLRecordInput} from './schema.js'
import {AbortController, AbortSignal} from '../abort.js'
import {
  OutputMessage,
  flushStdout,
  outputContent,
  outputInfo,
  outputResult,
  outputToken,
  outputWarn,
} from '../output.js'
import {emitCommandEvent} from '../command-events.js'
import {isInputDisabled} from '../no-input.js'
import {formatJsonOutputTimestamp} from '../json-output-schema.js'
import {openURL} from '../system.js'
import {getAvailableTCPPort} from '../tcp.js'
import {extractMyshopifyHandle} from '../../common/url.js'
import {randomBytes} from 'crypto'
import {Writable} from 'stream'

export interface BuildGraphiQLUrlOptions {
  port: number
  key: string
  query?: string
  variables?: string
  apiVersion?: string
}

export interface RunGraphiQLSessionOptions {
  storeFqdn: string
  tokenProvider: TokenProvider
  key: string
  port?: number
  query?: string
  variables?: string
  apiVersion?: string
  appContext?: GraphiQLAppContext
  protectMutations?: boolean
  additionalReadyMessages?: OutputMessage[]
  abortSignal?: AbortSignal
  stdout?: Writable
  outputFormat?: 'text' | 'json'
}

/**
 * Generates a random key suitable for authenticating a single local GraphiQL session.
 *
 * @returns A 64-character hex string.
 */
export function generateRandomGraphiQLKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Builds the browser URL for a local GraphiQL session.
 *
 * @param options - The local port, key, and optional query string fields to prefill.
 * @returns The fully-qualified local GraphiQL URL.
 */
export function buildGraphiQLUrl(options: BuildGraphiQLUrlOptions): string {
  const url = new URL(`http://localhost:${options.port}/graphiql`)
  url.searchParams.set('key', options.key)
  if (options.query) url.searchParams.set('query', options.query)
  if (options.variables) url.searchParams.set('variables', options.variables)
  if (options.apiVersion) url.searchParams.set('api_version', options.apiVersion)
  return url.toString()
}

/**
 * Runs a local GraphiQL session until the user interrupts it or the supplied abort signal fires.
 *
 * @param options - The server, authentication, URL prefill, and output options for the session.
 */
export async function runGraphiQLSession(options: RunGraphiQLSessionOptions): Promise<void> {
  const json = options.outputFormat === 'json'
  const storeDomain = extractMyshopifyHandle(options.storeFqdn) ? options.storeFqdn : null
  const cancellation = createGraphiQLCancellation(options.abortSignal)
  let server: ReturnType<typeof setupGraphiQLServer> | undefined
  let failed = false
  let closing = false
  let serverError: Error | undefined
  const writeRecord = (record: GraphiQLRecordInput) => {
    if (!json) return
    const timestamp = formatJsonOutputTimestamp(new Date())
    outputResult(JSON.stringify(graphiqlJsonOutputSchema.validate({...record, timestamp})))
  }
  const onServerError = (error: Error) => {
    serverError = error
    cancellation.controller.abort()
  }
  const onServerClose = () => {
    if (!closing) onServerError(new Error('The GraphiQL server closed unexpectedly.'))
  }
  const throwIfServerFailed = () => {
    if (serverError) throw serverError
  }

  try {
    if (cancellation.controller.signal.aborted) return
    writeRecord({type: 'starting', storeDomain})
    const port = await getAvailableTCPPort(options.port)
    if (cancellation.controller.signal.aborted) return

    server = setupGraphiQLServer({
      stdout: options.stdout ?? process.stdout,
      port,
      storeFqdn: options.storeFqdn,
      tokenProvider: options.tokenProvider,
      key: options.key,
      appContext: options.appContext,
      protectMutations: options.protectMutations,
      json,
      onRequestError: json
        ? (message) => emitCommandEvent({type: 'diagnostic', level: 'error', code: 'graphiql-request-failed', message})
        : undefined,
    })
    server.on('error', onServerError)
    server.on('close', onServerClose)
    await waitForGraphiQLListening(server)
    throwIfServerFailed()
    if (cancellation.controller.signal.aborted) return

    const url = buildGraphiQLUrl({
      port,
      key: options.key,
      query: options.query,
      variables: options.variables,
      apiVersion: options.apiVersion,
    })
    writeRecord({
      type: 'ready',
      url,
      storeDomain,
      api: 'admin',
      apiVersion: options.apiVersion ?? null,
      mutationsAllowed: !options.protectMutations,
      app: options.appContext ? {name: options.appContext.appName, url: options.appContext.appUrl} : null,
    })
    if (!json) {
      outputInfo(outputContent`GraphiQL is running at ${outputToken.link(url)}`)
      options.additionalReadyMessages?.forEach((message) => outputInfo(message))
      outputInfo('Press Ctrl+C to stop.')
    }
    if (!isInputDisabled()) {
      const opened = await Promise.race([openURL(url), cancellation.stopped.then(() => true)])
      if (!opened) outputWarn('Browser did not open automatically. Open the URL above manually.')
    }
    await cancellation.stopped
    throwIfServerFailed()
  } catch (error) {
    failed = true
    throw error
  } finally {
    try {
      if (server) {
        closing = true
        const runningServer = server
        await new Promise<void>((resolve) => {
          runningServer.close(() => resolve())
          runningServer.closeAllConnections()
        })
        server.removeListener('error', onServerError)
        server.removeListener('close', onServerClose)
      }
      if (!failed) writeRecord({type: 'stopped', reason: cancellation.reason()})
      if (json) await flushStdout()
    } finally {
      cancellation.dispose()
    }
  }
}

function waitForGraphiQLListening(server: ReturnType<typeof setupGraphiQLServer>): Promise<void> {
  return new Promise((resolve) => {
    const settled = () => {
      server.removeListener('listening', settled)
      server.removeListener('error', settled)
      resolve()
    }
    server.once('listening', settled)
    server.once('error', settled)
  })
}

function createGraphiQLCancellation(externalSignal?: AbortSignal) {
  const controller = new AbortController()
  let reason: 'cancelled' | 'sigint' | 'sigterm' | 'sigquit' = 'cancelled'
  const processEvents: NodeJS.EventEmitter = process
  const onSignal = (signal: string) => {
    if (controller.signal.aborted) return
    switch (signal) {
      case 'SIGINT':
        reason = 'sigint'
        process.exitCode = 130
        break
      case 'SIGTERM':
        reason = 'sigterm'
        process.exitCode = 143
        break
      case 'SIGQUIT':
        reason = 'sigquit'
        process.exitCode = 131
        break
      default:
        return
    }
    controller.abort()
  }
  const onSigint = () => onSignal('SIGINT')
  const onSigterm = () => onSignal('SIGTERM')
  const onSigquit = () => onSignal('SIGQUIT')
  const onAbort = () => controller.abort()
  process.on('SIGINT', onSigint)
  process.on('SIGTERM', onSigterm)
  process.on('SIGQUIT', onSigquit)
  processEvents.on('shopify:signal', onSignal)
  externalSignal?.addEventListener('abort', onAbort, {once: true})
  const stopped = new Promise<void>((resolve) =>
    controller.signal.addEventListener('abort', () => resolve(), {once: true}),
  )
  if (externalSignal?.aborted) controller.abort()
  return {
    controller,
    stopped,
    reason: () => reason,
    dispose: () => {
      process.removeListener('SIGINT', onSigint)
      process.removeListener('SIGTERM', onSigterm)
      process.removeListener('SIGQUIT', onSigquit)
      processEvents.removeListener('shopify:signal', onSignal)
      externalSignal?.removeEventListener('abort', onAbort)
    },
  }
}

/**
 * Resolves when the process receives SIGINT or when the supplied abort signal fires.
 *
 * @param externalSignal - Optional signal used by tests or callers to stop the session.
 */
export async function waitForGraphiQLAbort(externalSignal?: AbortSignal): Promise<void> {
  const controller = new AbortController()

  const onSigint = () => controller.abort()
  const onAbort = () => controller.abort()
  process.once('SIGINT', onSigint)

  try {
    await new Promise<void>((resolve) => {
      if (controller.signal.aborted || externalSignal?.aborted) {
        resolve()
        return
      }
      controller.signal.addEventListener('abort', () => resolve(), {once: true})
      externalSignal?.addEventListener('abort', onAbort, {once: true})
    })
  } finally {
    process.removeListener('SIGINT', onSigint)
    externalSignal?.removeEventListener('abort', onAbort)
  }
}
