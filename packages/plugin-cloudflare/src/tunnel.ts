import {TUNNEL_PROVIDER} from './provider.js'
import {
  startTunnel,
  TunnelError,
  TunnelStartReturn,
  TunnelStatusType,
  TunnelClient,
} from '@shopify/cli-kit/node/plugins/tunnel'
import {err, ok} from '@shopify/cli-kit/node/result'
import {AbortController} from '@shopify/cli-kit/node/abort'
import WebSocket from 'ws'
import {fetch, FetchError} from '@shopify/cli-kit/node/http'
import {sleep} from '@shopify/cli-kit/node/system'
import crypto from 'crypto'

import {stdout} from 'node:process'
import {Writable} from 'stream'

const ARGUS_URL = process.env.WS_GRAPHQL_ENDPOINT ?? 'ws://localhost:48935/graphql'

// TODO: should be provided by the App toml (application_url)
const APPLICATION_URL = 'https://webhooks-websocket-demo.test'
const APP_ID = 905743398573

export default startTunnel({provider: TUNNEL_PROVIDER, action: hookStart})

export async function hookStart(port: number): Promise<TunnelStartReturn> {
  try {
    const client = new TunnelClientInstance(port)
    await client.startTunnel()
    return ok(client)
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const tunnelError = new TunnelError('unknown', error.message)
    return err(tunnelError)
  }
}

class TunnelClientInstance implements TunnelClient {
  port: number
  provider = TUNNEL_PROVIDER

  private currentStatus: TunnelStatusType = {status: 'not-started'}
  private abortController: AbortController | undefined = undefined
  private readonly ws: WebSocket

  constructor(port: number) {
    this.port = port
    this.ws = new WebSocket(ARGUS_URL)
  }

  async startTunnel() {
    try {
      this.tunnel()
      // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.currentStatus = {status: 'error', message: error.message, tryMessage: whatToTry()}
    }
  }

  getTunnelStatus(): TunnelStatusType {
    return this.currentStatus
  }

  stopTunnel() {
    this.abortController?.abort()
  }

  tunnel() {
    this.abortController = new AbortController()
    this.currentStatus = {status: 'starting'}

    const self = this

    // TODO: Keep the connection alive
    // TODO: Refresh the token if it expires afer 60 minutes
    this.ws.on('error', function (err) {
      console.error(err)
      self.currentStatus = {status: 'error', message: 'Could not start Cloudflare tunnel: URL not found.'}
    })

    this.ws.on('open', function open() {
      // console.log('connected')
      self.authenticate()
    })

    this.ws.on('message', function message(data) {
      // console.log('received: %s', data)
      const event = JSON.parse(data.toString())

      switch (event.type) {
        case 'connection_ack':
          self.subscribe('webhook')
          self.currentStatus = {status: 'connected', url: APPLICATION_URL}
          break
        case 'data':
          self.processWebhookEvent(event)
          break
      }
    })
  }

  private authenticate() {
    const token = getToken(
      {
        exp: 2524626000,
        bucket_id: `gid://shopify/App/${APP_ID}`,
        staff_id: 123,
        permissions: ['full'],
      },
      // TODO: API call to partners/Core API to get a valid token
      // Core would decide which bucket ID to use for Argus
      'so_secret',
    )
    return this.ws.send(
      JSON.stringify({
        type: 'connection_init',
        payload: {Authorization: token},
      }),
    )
  }

  private subscribe(eventName: string) {
    const msg = JSON.stringify({
      id: '1',
      type: 'start',
      payload: {
        query: `
          subscription {
            eventReceived(eventName: "${eventName}") {
              payload
              eventName
              eventScope
              eventSerialId
              eventSerialGroup
              eventSourceApp
              eventSourceHost
              eventTimestamp
              eventUuid
              internalSessionId
              remoteIp
              schemaVersion
              bucketId
              userId
            }
          }
        `,
      },
    })
    // console.log('sending', msg)
    return this.ws.send(msg)
  }

  private processWebhookEvent(event: WebhookEvent) {
    const webhook = JSON.parse(event.payload.data.eventReceived.payload)
    // console.log(webhook)
    // TODO: Switch on different types of events (e.g: flow, app proxy, payment apps etc)
    const payload: SampleWebhook = {
      headers: webhook.headers,
      samplePayload: webhook.payload,
      success: true,
      userErrors: [],
    }
    const address = webhook.uri.replace(APPLICATION_URL, `http://localhost:${this.port}`)
    // console.log(payload, address)
    triggerWebhook({address, stdout}, payload).catch(console.error)
  }
}

function whatToTry() {
  return [
    'What to try:',
    {
      list: {
        items: [
          ['Run the command again'],
          ['Add the flag', {command: '--tunnel-url {URL}'}, 'to use a custom tunnel URL'],
        ],
      },
    },
  ]
}

function getToken(
  tokenPayload: {exp: number; bucket_id: string; staff_id: number; permissions: string[]},
  secret: string,
) {
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64')
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('hex')
  return `${encodedPayload}--${signature}`
}

interface WebhookEvent {
  payload: {
    data: {
      eventReceived: {
        payload: string
      }
    }
  }
}

// // TODO: refactor below this line

export interface SampleWebhook {
  samplePayload: string
  headers: string
  success: boolean
  userErrors: UserErrors[]
}
export interface UserErrors {
  message: string
  fields: string[]
}

/**
 * Sends a POST request to a local endpoint with a webhook payload
 *
 * @param address - local address where to send the POST message to
 * @param body - Webhook payload
 * @param headers - Webhook headers
 * @returns true if the message was delivered
 */
export async function triggerLocalWebhook(address: string, body: string, headers: string) {
  const options = {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      ...JSON.parse(headers),
    },
  }
  const response = await fetch(address, options)
  return response.status >= 200 && response.status < 300
}

async function triggerWebhook(options: {address: string; stdout: Writable}, sample: SampleWebhook): Promise<boolean> {
  let tries = 0

  /* eslint-disable no-await-in-loop */
  while (tries < 3) {
    try {
      const result = await triggerLocalWebhook(options.address, sample.samplePayload, sample.headers)

      return result
    } catch (error) {
      if (error instanceof FetchError && error.code === 'ECONNREFUSED') {
        if (tries < 3) {
          options.stdout.write("App isn't responding yet, retrying in 5 seconds")
          await sleep(5)
        }
      } else {
        throw error
      }
    }

    tries++
  }
  /* eslint-enable no-await-in-loop */

  options.stdout.write("App hasn't started in time, giving up")

  return false
}
