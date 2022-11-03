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
