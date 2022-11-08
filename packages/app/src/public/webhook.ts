export type WebhookTopic = 'products/create'

export interface WebhookProductsCreatePayload {
  id: string
  title: string
  vendor: string
}

export type WebhookPayload<T extends WebhookTopic> = T extends 'products/create'
  ? WebhookProductsCreatePayload
  : unknown

export async function defineWebhook<T extends WebhookTopic = 'products/create'>(
  topic: T,
  handler: (payload: WebhookPayload<T>) => Promise<void> | void,
) {
  return handler
}
