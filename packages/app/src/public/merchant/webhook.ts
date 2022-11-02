import {path} from '@shopify/cli-kit'
import {Request, Response, NextFunction} from 'express'
import {fileURLToPath} from 'node:url'

export interface WebhookOrdersCreatePayload {
  id: string
  total_price: number
}

export interface WebhookProductsUpdatePayload {
  id: string
  title: string
}

export async function defineOrdersCreateWebhook(
  handler: (payload: WebhookOrdersCreatePayload) => Promise<void> | void,
) {
  return handler
}

export async function defineProductsUpdateWebhook(
  handler: (payload: WebhookProductsUpdatePayload) => Promise<void> | void,
) {
  return handler
}

export async function getWebhooksMiddleware(moduleURL: URL) {
  const directory = fileURLToPath(new URL('.', moduleURL))
  const webhooksDirectory = path.join(directory, 'webhooks')
  const webhooks = await path.glob(path.join(webhooksDirectory, '**/*.js'))
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/webhooks') {
      res.write('success')
      return res.end()
    } else {
      return next()
    }
  }
}
