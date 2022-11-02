import {path, file} from '@shopify/cli-kit'
import express, {Request, Response, NextFunction} from 'express'
import {fileURLToPath} from 'node:url'

export interface WebhookOrdersCreatePayload {
  id: string
  total_price: number
}

export interface WebhookProductsCreatePayload {
  id: string
  title: string
  vendor: string
}

export async function defineOrdersCreateWebhook(
  handler: (payload: WebhookOrdersCreatePayload) => Promise<void> | void,
) {
  return handler
}

export async function defineProductsCreateWebhook(
  handler: (payload: WebhookProductsCreatePayload) => Promise<void> | void,
) {
  return handler
}

export async function getWebhooksMiddleware(moduleURL: URL) {
  const directory = fileURLToPath(new URL('.', moduleURL))
  const webhooksDirectory = path.join(directory, 'webhooks')
  const webhooks = await path.glob(path.join(webhooksDirectory, '**/*.js'))
  return [
    express.json(),
    async (req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/webhooks') {
        const topic = req.headers['x-shopify-topic'] as string
        const webhookModulePath = path.join(webhooksDirectory, `${topic}.js`)
        if (await file.exists(webhookModulePath)) {
          const module = await import(webhookModulePath)
          await (
            await module.default
          )(req.body)
        } else {
          console.log(`Webhook with topic ${topic} received but there's no handler defined for it`)
        }
        res.write('success')
        return res.end()
      } else {
        return next()
      }
    },
  ]
}
