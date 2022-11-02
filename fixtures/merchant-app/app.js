import express from 'express'
import {getWebhooksMiddleware} from '@shopify/app/merchant/webhook'

const app = express()

app.use(await getWebhooksMiddleware(import.meta.url))

app.get('/', (req, res) => {
  res.send('hello')
})

app.listen(process.env.PORT ?? 3000)

/**
 * Next
 * ====
 * 1. Webhook generation
 */
