// TODO: Should probably be a tunnel plugin?

import {SampleWebhook} from './services/webhook/request-sample.js'
import {triggerLocalWebhook} from './services/webhook/trigger-local-webhook.js'
import WebSocket from 'ws'
import {FetchError} from '@shopify/cli-kit/node/http'
import {sleep} from '@shopify/cli-kit/node/system'
import crypto from 'crypto'
import {stdout} from 'node:process'
import {Writable} from 'stream'

// TODO: For prod will be te URL of Argus
const websocketURL = process.env.WS_GRAPHQL_ENDPOINT ?? 'ws://localhost:48935/graphql'
// const websocketURL = 'ws://localhost:48935/graphql'

// TODO: Port would be passed in from CLI
const webhookEndpoint = process.env.WEBHOOK_ENDPOINT ?? 'http://localhost:4000/webhooks'
// const webhookEndpoint = 'http://localhost:4000/webhooks'

// TODO: STORE_FQDN provided by App toml
const storeFQDN = process.env.STORE_FQDN ?? 'test.myshopify.com'

const ws = new WebSocket(websocketURL)

// TODO: Keep the connection alive
// TODO: Refresh the token if it expires afer 60 minutes
ws.on('error', console.error)

ws.on('open', function open() {
  console.log('connected')
  authenticate()
})

ws.on('message', function message(data) {
  console.log('received: %s', data)
  const event = JSON.parse(data.toString())

  switch (event.type) {
    case 'connection_ack':
      subscribe('webhook')
      break
    case 'data':
      processWebhookEvent(event)
      break
  }
})

function authenticate() {
  const token = getToken(
    {
      exp: 2524626000,
      bucket_id: 'gid://shopify/Shop/12345',
      staff_id: 123,
      permissions: ['full'],
    },
    // TODO: API call to partners/Core API to get a valid token
    // Core would decide which bucket ID to use for Argus
    'so_secret',
  )
  return ws.send(
    JSON.stringify({
      type: 'connection_init',
      payload: {Authorization: token},
    }),
  )
}

function subscribe(eventName: string) {
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
  console.log('sending', msg)
  return ws.send(msg)
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

function processWebhookEvent(event: WebhookEvent) {
  const webhook = JSON.parse(event.payload.data.eventReceived.payload)
  // TODO: Switch on different types of events (e.g: flow, app proxy, payment apps etc)
  const payload: SampleWebhook = {
    headers: webhook.headers,
    samplePayload: webhook.payload,
    success: true,
    userErrors: [],
  }
  console.log(payload)
  triggerWebhook({address: webhookEndpoint, storeFqdn: storeFQDN, stdout}, payload)
    .then(console.log)
    .catch(console.error)
}

async function triggerWebhook(
  options: {address: string; storeFqdn: string; stdout: Writable},
  sample: SampleWebhook,
): Promise<boolean> {
  let tries = 0

  /* eslint-disable no-await-in-loop */
  while (tries < 3) {
    try {
      const result = await triggerLocalWebhook(
        options.address,
        sample.samplePayload,
        JSON.stringify({
          ...JSON.parse(sample.headers),

          // TODO: Should come from the Argus message
          'X-Shopify-Shop-Domain': options.storeFqdn,
        }),
      )

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
