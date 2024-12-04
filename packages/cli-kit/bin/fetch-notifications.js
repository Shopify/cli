import fetch from 'node-fetch'
import {notificationsUrl} from '../dist/public/node/notifications-system.js'
import {cacheStore} from '../dist/private/node/conf-store.js'

async function fetchNotifications() {
  try {
    const url = notificationsUrl()
    const response = await fetch(url, {signal: AbortSignal.timeout(3 * 1000)})
    if (response.status === 200) {
      cacheStore(`notifications-${url}`, await response.text())
      console.log(`Notifications from ${url} cached successfully`)
    }
  } catch (error) {
    const errorMessage = `Error fetching notifications: ${error.message}`
    console.error(errorMessage)
    const {sendErrorToBugsnag} = await import('../dist/public/node/error-handler.js')
    await sendErrorToBugsnag(errorMessage, 'unexpected_error')
  }
}

fetchNotifications()
