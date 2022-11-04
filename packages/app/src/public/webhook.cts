async function defineOrdersCreateWebhook(
  handler: (payload: {id: string; total_price: number}) => Promise<void> | void,
) {
  return handler
}

async function defineProductsCreateWebhook(
  handler: (payload: {id: string; title: string; vendor: string}) => Promise<void> | void,
) {
  return handler
}

module.exports = {
  defineOrdersCreateWebhook,
  defineProductsCreateWebhook,
}
