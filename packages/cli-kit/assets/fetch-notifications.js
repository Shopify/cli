import fetch from 'node-fetch'
import Conf from 'conf'

async function fetchNotifications() {
  try {
    const url = process.env.SHOPIFY_CLI_NOTIFICATIONS_URL ?? 'https://cdn.shopify.com/static/cli/notifications.json'
    const response = await fetch(url, {signal: AbortSignal.timeout(3 * 1000)})
    if (response.status === 200) {
      storeNotifications(url, await response.text())
      console.log(`Notifications from ${url} cached successfully`)
    }
  } catch (error) {
    const errorMessage = `Error fetching notifications: ${error.message}`
    console.error(errorMessage)
  }
}

function storeNotifications(url, notifications) {
  const config = new Conf({projectName: 'shopify-cli-kit'})
  const cache = config.get('cache') || {}
  cache[`notifications-${url}`] = {value: notifications, timestamp: Date.now()}
  config.set('cache', cache)
}

await fetchNotifications()
