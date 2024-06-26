import {versionSatisfies} from './node-package-manager.js'
import {renderInfo} from './ui.js'
import {CLI_KIT_VERSION} from '../common/version.js'

interface Notifications {
  notifications: Notification[]
}

interface Notification {
  message: string
  type: 'info' | 'warning' | 'error'
  title?: string
  minVersion?: string
  maxVersion?: string
  minDate?: string
  maxDate?: string
  commands?: string[]
  surface?: 'app' | 'theme' | 'hydrogen' | string
  frequency?: 'always' | 'once_a_day' | 'once_a_week'
}

/**
 * Shows notifications to the user if they meet the criteria specified in the notifications.json file.
 *
 * @param commandId - The command ID that triggered the notifications.
 * @param _surface - The surface that triggered the notifications.
 * @returns - A promise that resolves when the notifications have been shown.
 */
export async function showNotificationsIfNeeded(commandId: string, _surface?: string): Promise<void> {
  const response = await fetch(
    'https://raw.githubusercontent.com/Shopify/cli/4d32b20d28d0c3a89b411e8e1062df3377d552ac/notifications.json',
  )
  const notifications = await (response.json() as Promise<Notifications>)

  const notificationsToShow = notifications.notifications
    .filter(filterByVersion)
    .filter(filterByDate)
    .filter((notification) => {
      return !notification.commands || notification.commands?.includes(commandId)
    })

  notificationsToShow.forEach((notification) => {
    renderInfo({
      headline: notification.title,
      body: notification.message,
    })
  })
}

/**
 * Filters notifications based on the version of the CLI.
 *
 * @param notification - The notification to filter.
 */
function filterByVersion(notification: Notification) {
  const minVersion = !notification.minVersion || versionSatisfies(CLI_KIT_VERSION, `>=${notification.minVersion}`)
  const maxVersion = !notification.maxVersion || versionSatisfies(CLI_KIT_VERSION, `<=${notification.maxVersion}`)
  return minVersion && maxVersion
}

const today = new Date()

/**
 * Filters notifications based on the date.
 *
 * @param notification - The notification to filter.
 */
function filterByDate(notification: Notification) {
  const minDate = !notification.minDate || new Date(notification.minDate) >= today
  const maxDate = !notification.maxDate || new Date(notification.maxDate) <= today
  return minDate && maxDate
}
